/**
 * Opcode Execution Engine
 *
 * Executes decoded Z-machine instructions by dispatching to
 * the appropriate opcode handler.
 *
 * Reference: Z-Machine Specification §14-15
 *
 * @module
 */

import {
  ByteAddress,
  DecodedInstruction,
  ExecutionResult,
  HeaderFlags,
  Operand,
  OperandType,
  RandomLCG,
  TrueColor,
  ZSCII,
  ZVersion,
} from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { Header } from '../memory/Header';
import { Stack } from '../cpu/Stack';
import { Variables } from '../variables/Variables';
import { toSigned16, unpackRoutineAddress } from '../memory/AddressUtils';
import { ZCharDecoder } from '../text/ZCharDecoder';
import { IOAdapter } from '../../io/IOAdapter';
import { ObjectTable } from '../objects/ObjectTable';
import { Properties } from '../objects/Properties';
import { Dictionary } from '../dictionary/Dictionary';
import { Tokenizer } from '../dictionary/Tokenizer';
import { encodeText } from '../text/ZCharEncoder';
import { createQuetzalSave, parseQuetzalSave, verifySaveCompatibility } from '../state/Quetzal';
import { OpcodeError } from '../errors/ZMachineError';

/**
 * Handler function for an opcode
 */
export type OpcodeHandler = (
  instruction: DecodedInstruction
) => ExecutionResult | Promise<ExecutionResult>;

/**
 * Execution state after running an instruction
 */
export interface ExecutionState {
  /** Current program counter */
  pc: ByteAddress;
  /** True if waiting for input */
  waiting: boolean;
  /** True if game has ended */
  halted: boolean;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Options for Executor configuration
 */
export interface ExecutorOptions {
  /**
   * Enable debug tracking of opcode statistics and execution trace.
   * When disabled (default), avoids performance overhead of tracking.
   * @default false
   */
  debug?: boolean;
}

/**
 * Executes Z-machine instructions
 */
export class Executor {
  readonly memory: Memory;
  readonly header: Header;
  readonly stack: Stack;
  readonly variables: Variables;
  readonly version: ZVersion;
  readonly io: IOAdapter;
  readonly textDecoder: ZCharDecoder;
  readonly objectTable: ObjectTable;
  readonly properties: Properties;
  readonly dictionary: Dictionary;
  readonly tokenizer: Tokenizer;

  /** Whether debug tracking is enabled */
  private readonly debugEnabled: boolean;

  private handlers: Map<string, OpcodeHandler> = new Map();

  // Output stream state
  private streamEnabled: boolean[] = [false, true, false, false, false]; // Streams 1-4 (index 0 unused)
  private stream3Stack: Array<{ table: number; pos: number }> = []; // Memory stream is stackable

  constructor(
    memory: Memory,
    header: Header,
    stack: Stack,
    variables: Variables,
    version: ZVersion,
    io: IOAdapter,
    textDecoder: ZCharDecoder,
    objectTable?: ObjectTable,
    properties?: Properties,
    dictionary?: Dictionary,
    tokenizer?: Tokenizer,
    options?: ExecutorOptions
  ) {
    this.memory = memory;
    this.header = header;
    this.stack = stack;
    this.variables = variables;
    this.version = version;
    this.io = io;
    this.textDecoder = textDecoder;
    this.debugEnabled = options?.debug ?? false;

    // Create object table if not provided
    this.objectTable = objectTable ?? new ObjectTable(memory, version, header.objectTableAddress);
    this.properties = properties ?? new Properties(memory, version, this.objectTable);
    this.dictionary = dictionary ?? new Dictionary(memory, version, header.dictionaryAddress);
    this.tokenizer = tokenizer ?? new Tokenizer(memory, version, this.dictionary);

    this.registerHandlers();
  }

  /** Undo state for save_undo/restore_undo */
  private undoState: {
    memory: Uint8Array;
    stack: { data: number[]; framePointers: number[] };
    pc: ByteAddress;
  } | null = null;

  // Debug tracking state (only used when debugEnabled is true)
  /** DEBUG: Opcode frequency counter */
  private opcodeCount: Map<string, number> = new Map();
  private totalOps: number = 0;

  /** DEBUG: Unknown opcode details */
  private unknownOpcodes: Map<number, { address: number; count: number }> = new Map();

  /** DEBUG: Last 20 executed PCs */
  private recentPCs: ByteAddress[] = [];
  private lastExecutedPC: ByteAddress = 0;

  /**
   * Get opcode statistics and execution trace.
   * Only meaningful when debug mode is enabled.
   */
  getOpcodeStats(): {
    total: number;
    counts: Map<string, number>;
    unknowns: Map<number, { address: number; count: number }>;
    recentPCs: ByteAddress[];
    lastPC: ByteAddress;
  } {
    return {
      total: this.totalOps,
      counts: this.opcodeCount,
      unknowns: this.unknownOpcodes,
      recentPCs: this.recentPCs,
      lastPC: this.lastExecutedPC,
    };
  }

  /**
   * Execute a decoded instruction
   */
  async execute(instruction: DecodedInstruction): Promise<ExecutionResult> {
    // Track debug info only when enabled (avoids performance overhead)
    if (this.debugEnabled) {
      // Track recent PCs for debugging
      this.recentPCs.push(instruction.address);
      if (this.recentPCs.length > 20) {
        this.recentPCs.shift();
      }
      this.lastExecutedPC = instruction.address;

      // Track opcode frequency
      this.totalOps++;
      const count = this.opcodeCount.get(instruction.opcodeName) || 0;
      this.opcodeCount.set(instruction.opcodeName, count + 1);

      // Track unknown opcodes
      if (instruction.opcodeName === 'unknown') {
        const existing = this.unknownOpcodes.get(instruction.opcode);
        if (!existing) {
          this.unknownOpcodes.set(instruction.opcode, { address: instruction.address, count: 1 });
        } else {
          existing.count++;
        }
      }
    }

    const handler = this.handlers.get(instruction.opcodeName);
    const nextPC = instruction.address + instruction.length;

    if (!handler) {
      return {
        nextPC,
        error: `Unimplemented opcode: ${instruction.opcodeName}`,
      };
    }

    try {
      return await handler(instruction);
    } catch (error) {
      return {
        nextPC,
        error: `Error executing ${instruction.opcodeName}: ${error}`,
      };
    }
  }

  /**
   * Print text respecting output streams
   * Stream 1: Screen (default)
   * Stream 2: Transcript (passed to IO)
   * Stream 3: Memory table (stackable, highest priority)
   * Stream 4: Player input script (passed to IO)
   */
  private printText(text: string): void {
    // Stream 3 (memory) takes priority and is exclusive when active
    if (this.stream3Stack.length > 0) {
      const stream = this.stream3Stack[this.stream3Stack.length - 1];
      // Write characters to the memory table
      // Format: word 0 = length, then ZSCII chars
      for (const char of text) {
        const zscii = char.charCodeAt(0);
        this.memory.writeByte(stream.table + 2 + stream.pos, zscii);
        stream.pos++;
      }
      // Update length word
      this.memory.writeWord(stream.table, stream.pos);
      return; // Stream 3 is exclusive
    }

    // Stream 1 (screen) - default output
    if (this.streamEnabled[1]) {
      this.io.print(text);
    }

    // Stream 2 (transcript) and 4 (script) would be handled by IO adapter
    // We pass them through if the IO adapter supports setOutputStream
  }

  /**
   * Get the value of an operand
   */
  getOperandValue(operand: Operand): number {
    switch (operand.type) {
      case OperandType.LargeConstant:
      case OperandType.SmallConstant:
        return operand.value;
      case OperandType.Variable:
        return this.variables.load(operand.value);
      default:
        throw new OpcodeError(`Invalid operand type: ${operand.type}`, 'getOperandValue', 0);
    }
  }

  /**
   * Store a result value
   */
  storeResult(instruction: DecodedInstruction, value: number): void {
    if (instruction.storeVariable !== undefined) {
      this.variables.store(instruction.storeVariable, value & 0xffff);
    }
  }

  /**
   * Store a result value and continue to the next instruction.
   * Common pattern for opcodes that store a result.
   */
  private storeAndContinue(ins: DecodedInstruction, value: number): ExecutionResult {
    this.storeResult(ins, value);
    return { nextPC: ins.address + ins.length };
  }

  /**
   * Perform a branch based on condition
   */
  branch(instruction: DecodedInstruction, condition: boolean): ExecutionResult {
    const nextPC = instruction.address + instruction.length;

    if (!instruction.branch) {
      return { nextPC };
    }

    const shouldBranch = condition === instruction.branch.branchOnTrue;

    if (!shouldBranch) {
      return { nextPC };
    }

    const offset = instruction.branch.offset;

    // Special returns
    if (offset === 0) {
      return this.doReturn(0);
    }
    if (offset === 1) {
      return this.doReturn(1);
    }

    // Branch to offset (relative to instruction end, minus 2)
    return { nextPC: nextPC + offset - 2 };
  }

  /**
   * Perform a return from routine
   */
  doReturn(value: number): ExecutionResult {
    const frame = this.stack.popFrame();

    // Store return value if needed
    if (frame.storeVariable !== undefined) {
      this.variables.store(frame.storeVariable, value & 0xffff);
    }

    return { nextPC: frame.returnPC };
  }

  /**
   * Handle save/restore result based on Z-machine version.
   * V1-3: Uses branch semantics
   * V4+: Uses store semantics with 0/1/2 values
   *
   * @param ins The instruction
   * @param success Whether the operation succeeded
   * @param isRestore If true and successful, returns 2 instead of 1 for V4+
   * @returns ExecutionResult for branching, or undefined if stored
   */
  private handleSaveRestoreResult(
    ins: DecodedInstruction,
    success: boolean,
    isRestore: boolean = false
  ): ExecutionResult | undefined {
    if (this.version <= 3) {
      return this.branch(ins, success);
    } else {
      // V4+: 0 = failed, 1 = saved, 2 = restored
      const value = success ? (isRestore ? 2 : 1) : 0;
      this.storeResult(ins, value);
      return undefined;
    }
  }

  /**
   * Call a routine
   */
  callRoutine(
    packedAddress: number,
    args: number[],
    storeVariable: number | undefined,
    nextPC: ByteAddress
  ): ExecutionResult {
    // Calling address 0 returns 0 immediately
    if (packedAddress === 0) {
      if (storeVariable !== undefined) {
        this.variables.store(storeVariable, 0);
      }
      return { nextPC };
    }

    const routineAddr = unpackRoutineAddress(packedAddress, this.version);

    // Read routine header
    const localCount = this.memory.readByte(routineAddr);

    // In V1-4, locals have initial values in the routine
    const initialLocals: number[] = [];
    let codeStart = routineAddr + 1;

    if (this.version <= 4) {
      for (let i = 0; i < localCount; i++) {
        initialLocals.push(this.memory.readWord(codeStart));
        codeStart += 2;
      }
    } else {
      // V5+: locals start at 0
      for (let i = 0; i < localCount; i++) {
        initialLocals.push(0);
      }
    }

    // Override with arguments
    for (let i = 0; i < Math.min(args.length, localCount); i++) {
      initialLocals[i] = args[i];
    }

    // Push new frame
    this.stack.pushFrame(nextPC, storeVariable, localCount, args.length);

    // Set local values
    for (let i = 0; i < localCount; i++) {
      this.stack.currentFrame.setLocal(i, initialLocals[i]);
    }

    return { nextPC: codeStart };
  }

  /**
   * Register all opcode handlers
   */
  private registerHandlers(): void {
    // 2OP opcodes
    this.handlers.set('je', this.op_je.bind(this));
    this.handlers.set('jl', this.op_jl.bind(this));
    this.handlers.set('jg', this.op_jg.bind(this));
    this.handlers.set('dec_chk', this.op_dec_chk.bind(this));
    this.handlers.set('inc_chk', this.op_inc_chk.bind(this));
    this.handlers.set('jin', this.op_jin.bind(this));
    this.handlers.set('test', this.op_test.bind(this));
    this.handlers.set('or', this.op_or.bind(this));
    this.handlers.set('and', this.op_and.bind(this));
    this.handlers.set('test_attr', this.op_test_attr.bind(this));
    this.handlers.set('set_attr', this.op_set_attr.bind(this));
    this.handlers.set('clear_attr', this.op_clear_attr.bind(this));
    this.handlers.set('store', this.op_store.bind(this));
    this.handlers.set('insert_obj', this.op_insert_obj.bind(this));
    this.handlers.set('loadw', this.op_loadw.bind(this));
    this.handlers.set('loadb', this.op_loadb.bind(this));
    this.handlers.set('get_prop', this.op_get_prop.bind(this));
    this.handlers.set('get_prop_addr', this.op_get_prop_addr.bind(this));
    this.handlers.set('get_next_prop', this.op_get_next_prop.bind(this));
    this.handlers.set('add', this.op_add.bind(this));
    this.handlers.set('sub', this.op_sub.bind(this));
    this.handlers.set('mul', this.op_mul.bind(this));
    this.handlers.set('div', this.op_div.bind(this));
    this.handlers.set('mod', this.op_mod.bind(this));
    this.handlers.set('call_2s', this.op_call_2s.bind(this));
    this.handlers.set('call_2n', this.op_call_2n.bind(this));
    this.handlers.set('set_colour', this.op_set_colour.bind(this));

    // 1OP opcodes
    this.handlers.set('jz', this.op_jz.bind(this));
    this.handlers.set('get_sibling', this.op_get_sibling.bind(this));
    this.handlers.set('get_child', this.op_get_child.bind(this));
    this.handlers.set('get_parent', this.op_get_parent.bind(this));
    this.handlers.set('get_prop_len', this.op_get_prop_len.bind(this));
    this.handlers.set('inc', this.op_inc.bind(this));
    this.handlers.set('dec', this.op_dec.bind(this));
    this.handlers.set('print_addr', this.op_print_addr.bind(this));
    this.handlers.set('call_1s', this.op_call_1s.bind(this));
    this.handlers.set('remove_obj', this.op_remove_obj.bind(this));
    this.handlers.set('print_obj', this.op_print_obj.bind(this));
    this.handlers.set('ret', this.op_ret.bind(this));
    this.handlers.set('jump', this.op_jump.bind(this));
    this.handlers.set('print_paddr', this.op_print_paddr.bind(this));
    this.handlers.set('load', this.op_load.bind(this));
    this.handlers.set('not', this.op_not.bind(this));
    this.handlers.set('call_1n', this.op_call_1n.bind(this));

    // 0OP opcodes
    this.handlers.set('rtrue', this.op_rtrue.bind(this));
    this.handlers.set('rfalse', this.op_rfalse.bind(this));
    this.handlers.set('print', this.op_print.bind(this));
    this.handlers.set('print_ret', this.op_print_ret.bind(this));
    this.handlers.set('nop', this.op_nop.bind(this));
    this.handlers.set('save', this.op_save.bind(this));
    this.handlers.set('restore', this.op_restore.bind(this));
    this.handlers.set('restart', this.op_restart.bind(this));
    this.handlers.set('ret_popped', this.op_ret_popped.bind(this));
    this.handlers.set('pop', this.op_pop.bind(this));
    this.handlers.set('quit', this.op_quit.bind(this));
    this.handlers.set('new_line', this.op_new_line.bind(this));
    this.handlers.set('show_status', this.op_show_status.bind(this));
    this.handlers.set('verify', this.op_verify.bind(this));

    // VAR opcodes
    this.handlers.set('call', this.op_call.bind(this));
    this.handlers.set('call_vs', this.op_call.bind(this)); // Same as call
    this.handlers.set('storew', this.op_storew.bind(this));
    this.handlers.set('storeb', this.op_storeb.bind(this));
    this.handlers.set('put_prop', this.op_put_prop.bind(this));
    this.handlers.set('sread', this.op_sread.bind(this));
    this.handlers.set('aread', this.op_aread.bind(this));
    this.handlers.set('print_char', this.op_print_char.bind(this));
    this.handlers.set('print_num', this.op_print_num.bind(this));
    this.handlers.set('random', this.op_random.bind(this));
    this.handlers.set('push', this.op_push.bind(this));
    this.handlers.set('pull', this.op_pull.bind(this));
    this.handlers.set('split_window', this.op_split_window.bind(this));
    this.handlers.set('set_window', this.op_set_window.bind(this));
    this.handlers.set('call_vs2', this.op_call.bind(this)); // Same as call
    this.handlers.set('erase_window', this.op_erase_window.bind(this));
    this.handlers.set('set_cursor', this.op_set_cursor.bind(this));
    this.handlers.set('get_cursor', this.op_get_cursor.bind(this));
    this.handlers.set('set_text_style', this.op_set_text_style.bind(this));
    this.handlers.set('buffer_mode', this.op_buffer_mode.bind(this));
    this.handlers.set('output_stream', this.op_output_stream.bind(this));
    this.handlers.set('input_stream', this.op_input_stream.bind(this));
    this.handlers.set('sound_effect', this.op_sound_effect.bind(this));
    this.handlers.set('read_char', this.op_read_char.bind(this));
    this.handlers.set('scan_table', this.op_scan_table.bind(this));
    this.handlers.set('call_vn', this.op_call_vn.bind(this));
    this.handlers.set('call_vn2', this.op_call_vn.bind(this));
    this.handlers.set('tokenise', this.op_tokenise.bind(this));
    this.handlers.set('encode_text', this.op_encode_text.bind(this));
    this.handlers.set('copy_table', this.op_copy_table.bind(this));
    this.handlers.set('print_table', this.op_print_table.bind(this));
    this.handlers.set('check_arg_count', this.op_check_arg_count.bind(this));

    // Extended opcodes (V5+)
    this.handlers.set('log_shift', this.op_log_shift.bind(this));
    this.handlers.set('art_shift', this.op_art_shift.bind(this));
    this.handlers.set('set_font', this.op_set_font.bind(this));
    this.handlers.set('save_undo', this.op_save_undo.bind(this));
    this.handlers.set('restore_undo', this.op_restore_undo.bind(this));
    this.handlers.set('print_unicode', this.op_print_unicode.bind(this));
    this.handlers.set('check_unicode', this.op_check_unicode.bind(this));
    this.handlers.set('set_true_colour', this.op_set_true_colour.bind(this));

    // V5+ control flow
    this.handlers.set('catch', this.op_catch.bind(this));
    this.handlers.set('throw', this.op_throw.bind(this));

    // Misc V4+/V5+ opcodes
    this.handlers.set('piracy', this.op_piracy.bind(this));
    this.handlers.set('erase_line', this.op_erase_line.bind(this));
  }

  // ============================================
  // 2OP Opcode Implementations
  // ============================================

  private op_je(ins: DecodedInstruction): ExecutionResult {
    const a = this.getOperandValue(ins.operands[0]);
    // je can have 2-4 operands, branch if first equals any of the rest
    for (let i = 1; i < ins.operands.length; i++) {
      if (a === this.getOperandValue(ins.operands[i])) {
        return this.branch(ins, true);
      }
    }
    return this.branch(ins, false);
  }

  private op_jl(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    return this.branch(ins, a < b);
  }

  private op_jg(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    return this.branch(ins, a > b);
  }

  private op_dec_chk(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    const check = toSigned16(this.getOperandValue(ins.operands[1]));
    this.variables.decrement(varNum);
    const value = toSigned16(this.variables.peek(varNum));
    return this.branch(ins, value < check);
  }

  private op_inc_chk(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    const check = toSigned16(this.getOperandValue(ins.operands[1]));
    this.variables.increment(varNum);
    const value = toSigned16(this.variables.peek(varNum));
    return this.branch(ins, value > check);
  }

  private op_jin(ins: DecodedInstruction): ExecutionResult {
    // jin obj1 obj2 ?(label) - jump if obj1's parent is obj2
    const obj1 = this.getOperandValue(ins.operands[0]);
    const obj2 = this.getOperandValue(ins.operands[1]);
    const parent = this.objectTable.getParent(obj1);
    return this.branch(ins, parent === obj2);
  }

  private op_test(ins: DecodedInstruction): ExecutionResult {
    const bitmap = this.getOperandValue(ins.operands[0]);
    const flags = this.getOperandValue(ins.operands[1]);
    return this.branch(ins, (bitmap & flags) === flags);
  }

  private op_or(ins: DecodedInstruction): ExecutionResult {
    const a = this.getOperandValue(ins.operands[0]);
    const b = this.getOperandValue(ins.operands[1]);
    return this.storeAndContinue(ins, a | b);
  }

  private op_and(ins: DecodedInstruction): ExecutionResult {
    const a = this.getOperandValue(ins.operands[0]);
    const b = this.getOperandValue(ins.operands[1]);
    return this.storeAndContinue(ins, a & b);
  }

  private op_test_attr(ins: DecodedInstruction): ExecutionResult {
    // test_attr object attribute ?(label) - jump if object has attribute
    const obj = this.getOperandValue(ins.operands[0]);
    const attr = this.getOperandValue(ins.operands[1]);
    const hasAttr = this.objectTable.testAttribute(obj, attr);
    return this.branch(ins, hasAttr);
  }

  private op_set_attr(ins: DecodedInstruction): ExecutionResult {
    // set_attr object attribute - set attribute on object
    const obj = this.getOperandValue(ins.operands[0]);
    const attr = this.getOperandValue(ins.operands[1]);
    this.objectTable.setAttribute(obj, attr);
    return { nextPC: ins.address + ins.length };
  }

  private op_clear_attr(ins: DecodedInstruction): ExecutionResult {
    // clear_attr object attribute - clear attribute on object
    const obj = this.getOperandValue(ins.operands[0]);
    const attr = this.getOperandValue(ins.operands[1]);
    this.objectTable.clearAttribute(obj, attr);
    return { nextPC: ins.address + ins.length };
  }

  private op_store(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    const value = this.getOperandValue(ins.operands[1]);
    // store (variable) value - indirect store
    this.variables.write(varNum, value);
    return { nextPC: ins.address + ins.length };
  }

  private op_insert_obj(ins: DecodedInstruction): ExecutionResult {
    // insert_obj object destination - make object first child of destination
    const obj = this.getOperandValue(ins.operands[0]);
    const dest = this.getOperandValue(ins.operands[1]);
    this.objectTable.insertObject(obj, dest);
    return { nextPC: ins.address + ins.length };
  }

  private op_loadw(ins: DecodedInstruction): ExecutionResult {
    const array = this.getOperandValue(ins.operands[0]);
    const wordIndex = this.getOperandValue(ins.operands[1]);
    const value = this.memory.readWord(array + wordIndex * 2);
    return this.storeAndContinue(ins, value);
  }

  private op_loadb(ins: DecodedInstruction): ExecutionResult {
    const array = this.getOperandValue(ins.operands[0]);
    const byteIndex = this.getOperandValue(ins.operands[1]);
    const value = this.memory.readByte(array + byteIndex);
    return this.storeAndContinue(ins, value);
  }

  private op_get_prop(ins: DecodedInstruction): ExecutionResult {
    // get_prop object property -> (result) - get property value or default
    const obj = this.getOperandValue(ins.operands[0]);
    const prop = this.getOperandValue(ins.operands[1]);
    const value = this.properties.getProperty(obj, prop);
    return this.storeAndContinue(ins, value);
  }

  private op_get_prop_addr(ins: DecodedInstruction): ExecutionResult {
    // get_prop_addr object property -> (result) - get address of property data
    const obj = this.getOperandValue(ins.operands[0]);
    const prop = this.getOperandValue(ins.operands[1]);
    const addr = this.properties.getPropertyAddress(obj, prop);
    return this.storeAndContinue(ins, addr);
  }

  private op_get_next_prop(ins: DecodedInstruction): ExecutionResult {
    // get_next_prop object property -> (result) - get next property number
    const obj = this.getOperandValue(ins.operands[0]);
    const prop = this.getOperandValue(ins.operands[1]);
    const nextProp = this.properties.getNextProperty(obj, prop);
    return this.storeAndContinue(ins, nextProp);
  }

  private op_add(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    return this.storeAndContinue(ins, a + b);
  }

  private op_sub(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    return this.storeAndContinue(ins, a - b);
  }

  private op_mul(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    return this.storeAndContinue(ins, a * b);
  }

  private op_div(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    if (b === 0) {
      return { nextPC: ins.address + ins.length, error: 'Division by zero' };
    }
    // Integer division truncates towards zero
    const result = Math.trunc(a / b);
    this.storeResult(ins, result);
    return { nextPC: ins.address + ins.length };
  }

  private op_mod(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    if (b === 0) {
      return { nextPC: ins.address + ins.length, error: 'Division by zero' };
    }
    // Remainder has same sign as dividend
    const result = a % b;
    return this.storeAndContinue(ins, result);
  }

  private op_call_2s(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    const arg = this.getOperandValue(ins.operands[1]);
    return this.callRoutine(routine, [arg], ins.storeVariable, ins.address + ins.length);
  }

  private op_call_2n(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    const arg = this.getOperandValue(ins.operands[1]);
    return this.callRoutine(routine, [arg], undefined, ins.address + ins.length);
  }

  private op_set_colour(ins: DecodedInstruction): ExecutionResult {
    const foreground = this.getOperandValue(ins.operands[0]);
    const background = this.getOperandValue(ins.operands[1]);

    // Z-machine colors: 0=current, 1=default, 2=black, 3=red, 4=green,
    // 5=yellow, 6=blue, 7=magenta, 8=cyan, 9=white
    if (this.io.setForegroundColor && foreground !== 0) {
      this.io.setForegroundColor(foreground);
    }
    if (this.io.setBackgroundColor && background !== 0) {
      this.io.setBackgroundColor(background);
    }

    return { nextPC: ins.address + ins.length };
  }

  // ============================================
  // 1OP Opcode Implementations
  // ============================================

  private op_jz(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    return this.branch(ins, value === 0);
  }

  private op_get_sibling(ins: DecodedInstruction): ExecutionResult {
    // get_sibling object -> (result) ?(label) - get sibling, branch if non-zero
    const obj = this.getOperandValue(ins.operands[0]);
    const sibling = this.objectTable.getSibling(obj);
    this.storeResult(ins, sibling);
    return this.branch(ins, sibling !== 0);
  }

  private op_get_child(ins: DecodedInstruction): ExecutionResult {
    // get_child object -> (result) ?(label) - get first child, branch if non-zero
    const obj = this.getOperandValue(ins.operands[0]);
    const child = this.objectTable.getChild(obj);
    this.storeResult(ins, child);
    return this.branch(ins, child !== 0);
  }

  private op_get_parent(ins: DecodedInstruction): ExecutionResult {
    // get_parent object -> (result) - get parent object
    const obj = this.getOperandValue(ins.operands[0]);
    const parent = this.objectTable.getParent(obj);
    return this.storeAndContinue(ins, parent);
  }

  private op_get_prop_len(ins: DecodedInstruction): ExecutionResult {
    // get_prop_len property-address -> (result) - get length of property data
    const propAddr = this.getOperandValue(ins.operands[0]);
    // Special case: address 0 returns length 0
    const length = propAddr === 0 ? 0 : this.properties.getPropertyLength(propAddr);
    return this.storeAndContinue(ins, length);
  }

  private op_inc(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    this.variables.increment(varNum);
    return { nextPC: ins.address + ins.length };
  }

  private op_dec(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    this.variables.decrement(varNum);
    return { nextPC: ins.address + ins.length };
  }

  private op_print_addr(ins: DecodedInstruction): ExecutionResult {
    const addr = this.getOperandValue(ins.operands[0]);
    const result = this.textDecoder.decode(addr);
    this.printText(result.text);
    return { nextPC: ins.address + ins.length };
  }

  private op_call_1s(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    return this.callRoutine(routine, [], ins.storeVariable, ins.address + ins.length);
  }

  private op_remove_obj(ins: DecodedInstruction): ExecutionResult {
    // remove_obj object - remove object from its parent's child list
    const obj = this.getOperandValue(ins.operands[0]);
    this.objectTable.removeFromParent(obj);
    return { nextPC: ins.address + ins.length };
  }

  private op_print_obj(ins: DecodedInstruction): ExecutionResult {
    // print_obj object - print object's short name
    const obj = this.getOperandValue(ins.operands[0]);
    const nameInfo = this.objectTable.getShortNameAddress(obj);
    if (nameInfo.lengthBytes > 0) {
      const result = this.textDecoder.decode(nameInfo.address);
      this.printText(result.text);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_ret(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    return this.doReturn(value);
  }

  private op_jump(ins: DecodedInstruction): ExecutionResult {
    const offset = toSigned16(this.getOperandValue(ins.operands[0]));
    // Jump is relative to the instruction *after* the operand
    return { nextPC: ins.address + ins.length + offset - 2 };
  }

  private op_print_paddr(ins: DecodedInstruction): ExecutionResult {
    const packedAddr = this.getOperandValue(ins.operands[0]);
    // Convert packed address to byte address based on version
    let byteAddr: number;
    if (this.version <= 3) {
      byteAddr = packedAddr * 2;
    } else if (this.version <= 5) {
      byteAddr = packedAddr * 4;
    } else {
      byteAddr = packedAddr * 8;
    }
    const result = this.textDecoder.decode(byteAddr);
    this.printText(result.text);
    return { nextPC: ins.address + ins.length };
  }

  private op_load(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    // load (variable) -> (result) - indirect load
    const value = this.variables.peek(varNum);
    return this.storeAndContinue(ins, value);
  }

  private op_not(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    return this.storeAndContinue(ins, ~value & 0xffff);
  }

  private op_call_1n(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    return this.callRoutine(routine, [], undefined, ins.address + ins.length);
  }

  // ============================================
  // 0OP Opcode Implementations
  // ============================================

  private op_rtrue(_ins: DecodedInstruction): ExecutionResult {
    return this.doReturn(1);
  }

  private op_rfalse(_ins: DecodedInstruction): ExecutionResult {
    return this.doReturn(0);
  }

  private op_print(ins: DecodedInstruction): ExecutionResult {
    if (ins.text) {
      this.printText(ins.text);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_print_ret(ins: DecodedInstruction): ExecutionResult {
    if (ins.text) {
      this.printText(ins.text);
    }
    this.printText('\n');
    return this.doReturn(1);
  }

  private op_nop(ins: DecodedInstruction): ExecutionResult {
    return { nextPC: ins.address + ins.length };
  }

  private async op_save(ins: DecodedInstruction): Promise<ExecutionResult> {
    // V3: save branches, V4+: save stores
    // Uses Quetzal save format for portability:
    // - IFhd chunk: release, serial, checksum, PC
    // - UMem chunk: uncompressed dynamic memory
    // - Stks chunk: stack state
    const nextPC = ins.address + ins.length;

    if (!this.io.save) {
      return this.handleSaveRestoreResult(ins, false) ?? { nextPC };
    }

    // Create Quetzal save file with PC pointing after this instruction
    const saveData = createQuetzalSave(this.memory, this.stack.snapshot(), nextPC);
    const saved = await this.io.save(saveData);

    return this.handleSaveRestoreResult(ins, saved) ?? { nextPC };
  }

  private async op_restore(ins: DecodedInstruction): Promise<ExecutionResult> {
    // V3: restore branches, V4+: restore stores
    // Parses Quetzal save format
    const nextPC = ins.address + ins.length;

    if (!this.io.restore) {
      return this.handleSaveRestoreResult(ins, false) ?? { nextPC };
    }

    const data = await this.io.restore();
    if (!data) {
      return this.handleSaveRestoreResult(ins, false) ?? { nextPC };
    }

    try {
      // Parse Quetzal save file
      const saveState = parseQuetzalSave(data);

      // Verify this save is for the same game
      if (!verifySaveCompatibility(saveState, this.memory)) {
        return this.handleSaveRestoreResult(ins, false) ?? { nextPC };
      }

      // Restore dynamic memory
      const staticBase = this.header.staticMemoryBase;
      const restoreSize = Math.min(saveState.dynamicMemory.length, staticBase);
      for (let i = 0; i < restoreSize; i++) {
        this.memory.writeByte(i, saveState.dynamicMemory[i]);
      }

      // Restore call stack
      this.stack.restore(saveState.callStack);

      // For V4+, store 2 to indicate successful restore
      // (handled by handleSaveRestoreResult with isRestore=true)
      this.handleSaveRestoreResult(ins, true, true);

      // Return to the saved PC
      return { nextPC: saveState.gameId.pc };
    } catch {
      // Failed to parse save file
      return this.handleSaveRestoreResult(ins, false) ?? { nextPC };
    }
  }

  private op_restart(_ins: DecodedInstruction): ExecutionResult {
    this.memory.restart();
    this.stack.initialize(0);
    this.io.restart();
    return { nextPC: this.header.initialPC };
  }

  private op_ret_popped(_ins: DecodedInstruction): ExecutionResult {
    const value = this.stack.pop();
    return this.doReturn(value);
  }

  private op_pop(ins: DecodedInstruction): ExecutionResult {
    this.stack.pop();
    return { nextPC: ins.address + ins.length };
  }

  private op_quit(_ins: DecodedInstruction): ExecutionResult {
    this.io.quit();
    return { nextPC: 0, halted: true };
  }

  private op_new_line(ins: DecodedInstruction): ExecutionResult {
    this.printText('\n');
    return { nextPC: ins.address + ins.length };
  }

  private op_show_status(ins: DecodedInstruction): ExecutionResult {
    if (this.io.showStatusLine) {
      // Get location object (global var 0 = var 16)
      const locationObj = this.variables.load(16);

      // Get location name
      let locationName = 'Unknown';
      if (locationObj !== 0) {
        const nameInfo = this.objectTable.getShortNameAddress(locationObj);
        if (nameInfo.lengthBytes > 0) {
          const result = this.textDecoder.decode(nameInfo.address);
          locationName = result.text;
        }
      }

      // Get score/time values (global vars 1 and 2 = vars 17 and 18)
      const scoreOrHours = toSigned16(this.variables.load(17));
      const turnsOrMinutes = this.variables.load(18);

      // Check if time game (bit 1 of flags1)
      const isTimeGame = (this.header.flags1 & HeaderFlags.FLAGS1_TIME_GAME) !== 0;

      this.io.showStatusLine(locationName, scoreOrHours, turnsOrMinutes, isTimeGame);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_verify(ins: DecodedInstruction): ExecutionResult {
    // Always pass for now
    return this.branch(ins, true);
  }

  // ============================================
  // VAR Opcode Implementations
  // ============================================

  private op_call(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    const args: number[] = [];
    for (let i = 1; i < ins.operands.length; i++) {
      args.push(this.getOperandValue(ins.operands[i]));
    }
    return this.callRoutine(routine, args, ins.storeVariable, ins.address + ins.length);
  }

  private op_storew(ins: DecodedInstruction): ExecutionResult {
    const array = this.getOperandValue(ins.operands[0]);
    const wordIndex = this.getOperandValue(ins.operands[1]);
    const value = this.getOperandValue(ins.operands[2]);
    this.memory.writeWord(array + wordIndex * 2, value);
    return { nextPC: ins.address + ins.length };
  }

  private op_storeb(ins: DecodedInstruction): ExecutionResult {
    const array = this.getOperandValue(ins.operands[0]);
    const byteIndex = this.getOperandValue(ins.operands[1]);
    const value = this.getOperandValue(ins.operands[2]);
    this.memory.writeByte(array + byteIndex, value & 0xff);
    return { nextPC: ins.address + ins.length };
  }

  private op_put_prop(ins: DecodedInstruction): ExecutionResult {
    // put_prop object property value - set property value
    const obj = this.getOperandValue(ins.operands[0]);
    const prop = this.getOperandValue(ins.operands[1]);
    const value = this.getOperandValue(ins.operands[2]);
    this.properties.putProperty(obj, prop, value);
    return { nextPC: ins.address + ins.length };
  }

  /**
   * Shared implementation for sread and aread opcodes
   * §15: Read and tokenize player input
   */
  private async readInput(
    ins: DecodedInstruction,
    useTerminator: boolean
  ): Promise<ExecutionResult> {
    const textBuffer = this.getOperandValue(ins.operands[0]);
    const parseBuffer = this.getOperandValue(ins.operands[1]);
    // time and routine operands are for timed input (not fully implemented)

    const maxLen = this.memory.readByte(textBuffer);
    const result = await this.io.readLine(maxLen);

    // Store text in buffer (lowercase)
    const text = result.text.toLowerCase();

    if (this.version >= 5) {
      // V5+: byte 1 = length, text starts at byte 2
      this.memory.writeByte(textBuffer + 1, text.length);
      for (let i = 0; i < text.length; i++) {
        this.memory.writeByte(textBuffer + 2 + i, text.charCodeAt(i));
      }
    } else {
      // V1-4: text starts at byte 1, null-terminated
      for (let i = 0; i < text.length; i++) {
        this.memory.writeByte(textBuffer + 1 + i, text.charCodeAt(i));
      }
      this.memory.writeByte(textBuffer + 1 + text.length, 0);
    }

    // Tokenize if parse buffer provided
    if (parseBuffer !== 0) {
      this.tokenizer.tokenizeBuffer(textBuffer, parseBuffer);
    }

    // V5+ returns the terminating character (newline by default)
    if (this.version >= 5 && ins.storeVariable !== undefined) {
      const terminator = useTerminator ? result.terminator || ZSCII.NEWLINE : ZSCII.NEWLINE;
      this.storeResult(ins, terminator);
    }

    return { nextPC: ins.address + ins.length };
  }

  private async op_sread(ins: DecodedInstruction): Promise<ExecutionResult> {
    // §15: sread - V1-4: sread text parse, V5+: aread text parse time routine -> (result)
    return this.readInput(ins, true);
  }

  private async op_aread(ins: DecodedInstruction): Promise<ExecutionResult> {
    // V4+ read opcode: aread text parse time routine -> (result)
    return this.readInput(ins, false);
  }

  private op_print_char(ins: DecodedInstruction): ExecutionResult {
    const zscii = this.getOperandValue(ins.operands[0]);
    // Convert ZSCII to Unicode
    const char = String.fromCharCode(zscii);
    this.printText(char);
    return { nextPC: ins.address + ins.length };
  }

  private op_print_num(ins: DecodedInstruction): ExecutionResult {
    const num = toSigned16(this.getOperandValue(ins.operands[0]));
    this.printText(num.toString());
    return { nextPC: ins.address + ins.length };
  }

  private randomSeed: number = Date.now();
  private randomMode: 'random' | 'predictable' = 'random';

  /**
   * Simple Linear Congruential Generator for predictable random mode
   * Uses the same constants as glibc
   */
  private nextPredictableRandom(): number {
    // LCG: seed = (a * seed + c) mod m
    // Using glibc constants
    this.randomSeed =
      ((this.randomSeed * RandomLCG.MULTIPLIER + RandomLCG.INCREMENT) >>> 0) & RandomLCG.MODULUS;
    return this.randomSeed;
  }

  private op_random(ins: DecodedInstruction): ExecutionResult {
    const range = toSigned16(this.getOperandValue(ins.operands[0]));

    if (range <= 0) {
      // Seed the random number generator
      if (range === 0) {
        this.randomMode = 'random';
        this.randomSeed = Date.now();
      } else {
        this.randomMode = 'predictable';
        this.randomSeed = -range; // Use negative as seed
      }
      this.storeResult(ins, 0);
    } else {
      // Generate random number from 1 to range
      let result: number;
      if (this.randomMode === 'random') {
        result = Math.floor(Math.random() * range) + 1;
      } else {
        // Use seeded PRNG for predictable mode
        result = (this.nextPredictableRandom() % range) + 1;
      }
      this.storeResult(ins, result);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_push(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    this.stack.push(value);
    return { nextPC: ins.address + ins.length };
  }

  private op_pull(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    const value = this.stack.pop();
    this.variables.write(varNum, value);
    return { nextPC: ins.address + ins.length };
  }

  private op_split_window(ins: DecodedInstruction): ExecutionResult {
    const lines = this.getOperandValue(ins.operands[0]);
    if (this.io.splitWindow) {
      this.io.splitWindow(lines);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_set_window(ins: DecodedInstruction): ExecutionResult {
    const window = this.getOperandValue(ins.operands[0]);
    if (this.io.setWindow) {
      this.io.setWindow(window);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_erase_window(ins: DecodedInstruction): ExecutionResult {
    // Window is signed: -1 = unsplit and clear all, -2 = clear all, 0/1 = clear specific window
    const window = toSigned16(this.getOperandValue(ins.operands[0]));
    if (this.io.eraseWindow) {
      this.io.eraseWindow(window);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_set_cursor(ins: DecodedInstruction): ExecutionResult {
    const line = this.getOperandValue(ins.operands[0]);
    const column = this.getOperandValue(ins.operands[1]);
    if (this.io.setCursor) {
      this.io.setCursor(line, column);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_get_cursor(ins: DecodedInstruction): ExecutionResult {
    // §15: get_cursor array - writes row and column to array
    const array = this.getOperandValue(ins.operands[0]);
    let row = 1,
      column = 1;
    if (this.io.getCursor) {
      const cursor = this.io.getCursor();
      row = cursor.line;
      column = cursor.column;
    }
    // Write cursor position as two words
    this.memory.writeWord(array, row);
    this.memory.writeWord(array + 2, column);
    return { nextPC: ins.address + ins.length };
  }

  private op_set_text_style(ins: DecodedInstruction): ExecutionResult {
    const style = this.getOperandValue(ins.operands[0]);
    if (this.io.setTextStyle) {
      this.io.setTextStyle(style);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_buffer_mode(ins: DecodedInstruction): ExecutionResult {
    const mode = this.getOperandValue(ins.operands[0]);
    if (this.io.setBufferMode) {
      this.io.setBufferMode(mode !== 0);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_output_stream(ins: DecodedInstruction): ExecutionResult {
    const stream = toSigned16(this.getOperandValue(ins.operands[0]));
    const table = ins.operands.length > 1 ? this.getOperandValue(ins.operands[1]) : undefined;

    if (stream > 0) {
      // Enable stream
      if (stream === 3 && table !== undefined) {
        // Stream 3 is stackable - push new table
        this.stream3Stack.push({ table, pos: 0 });
        // Initialize the word count at the start of the table to 0
        this.memory.writeWord(table, 0);
      } else {
        this.streamEnabled[stream] = true;
      }
    } else if (stream < 0) {
      // Disable stream
      const absStream = Math.abs(stream);
      if (absStream === 3) {
        // Pop the stream 3 stack
        this.stream3Stack.pop();
      } else {
        this.streamEnabled[absStream] = false;
      }
    }

    // Also notify IO adapter for streams it handles (transcript, etc.)
    if (this.io.setOutputStream) {
      this.io.setOutputStream(Math.abs(stream), stream > 0, table);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_input_stream(ins: DecodedInstruction): ExecutionResult {
    const stream = this.getOperandValue(ins.operands[0]);
    if (this.io.setInputStream) {
      this.io.setInputStream(stream);
    }
    return { nextPC: ins.address + ins.length };
  }

  private op_sound_effect(ins: DecodedInstruction): ExecutionResult {
    const number = this.getOperandValue(ins.operands[0]);
    const effect = ins.operands.length > 1 ? this.getOperandValue(ins.operands[1]) : 0;
    const volume = ins.operands.length > 2 ? this.getOperandValue(ins.operands[2]) : 0;
    if (this.io.soundEffect) {
      this.io.soundEffect(number, effect, volume);
    }
    return { nextPC: ins.address + ins.length };
  }

  private async op_read_char(ins: DecodedInstruction): Promise<ExecutionResult> {
    // Operand 0 is always 1 (read from keyboard)
    const timeout = ins.operands.length > 1 ? this.getOperandValue(ins.operands[1]) : 0;
    const char = await this.io.readChar(timeout);
    return this.storeAndContinue(ins, char);
  }

  private op_scan_table(ins: DecodedInstruction): ExecutionResult {
    const x = this.getOperandValue(ins.operands[0]);
    const table = this.getOperandValue(ins.operands[1]);
    const len = this.getOperandValue(ins.operands[2]);
    const form = ins.operands.length > 3 ? this.getOperandValue(ins.operands[3]) : 0x82;

    const entryLen = form & 0x7f;
    const isWord = (form & 0x80) !== 0;

    for (let i = 0; i < len; i++) {
      const addr = table + i * entryLen;
      const value = isWord ? this.memory.readWord(addr) : this.memory.readByte(addr);
      if (value === x) {
        this.storeResult(ins, addr);
        return this.branch(ins, true);
      }
    }

    this.storeResult(ins, 0);
    return this.branch(ins, false);
  }

  private op_call_vn(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    const args: number[] = [];
    for (let i = 1; i < ins.operands.length; i++) {
      args.push(this.getOperandValue(ins.operands[i]));
    }
    return this.callRoutine(routine, args, undefined, ins.address + ins.length);
  }

  private op_tokenise(ins: DecodedInstruction): ExecutionResult {
    // tokenise text parse dictionary flag
    // Tokenize text buffer into parse buffer, optionally using custom dictionary
    const textBuffer = this.getOperandValue(ins.operands[0]);
    const parseBuffer = this.getOperandValue(ins.operands[1]);
    const dictionaryAddr = ins.operands.length > 2 ? this.getOperandValue(ins.operands[2]) : 0;
    const skipUnknown =
      ins.operands.length > 3 ? this.getOperandValue(ins.operands[3]) !== 0 : false;

    this.tokenizer.tokenizeBuffer(textBuffer, parseBuffer, dictionaryAddr, skipUnknown);
    return { nextPC: ins.address + ins.length };
  }

  private op_encode_text(ins: DecodedInstruction): ExecutionResult {
    // encode_text zscii-text length from coded-text
    // Encode a string from ZSCII to dictionary format
    const zsciiText = this.getOperandValue(ins.operands[0]);
    const length = this.getOperandValue(ins.operands[1]);
    const from = this.getOperandValue(ins.operands[2]);
    const codedText = this.getOperandValue(ins.operands[3]);

    // Read the ZSCII characters
    let text = '';
    for (let i = 0; i < length; i++) {
      const c = this.memory.readByte(zsciiText + from + i);
      text += String.fromCharCode(c);
    }

    // Encode to Z-characters (dictionary format)
    const encoded = encodeText(text, this.version);

    // Write encoded bytes (4 bytes for V3, 6 for V4+)
    for (let i = 0; i < encoded.length; i++) {
      this.memory.writeByte(codedText + i, encoded[i]);
    }

    return { nextPC: ins.address + ins.length };
  }

  private op_copy_table(ins: DecodedInstruction): ExecutionResult {
    const first = this.getOperandValue(ins.operands[0]);
    const second = this.getOperandValue(ins.operands[1]);
    const size = toSigned16(this.getOperandValue(ins.operands[2]));

    if (second === 0) {
      // Zero the table
      for (let i = 0; i < Math.abs(size); i++) {
        this.memory.writeByte(first + i, 0);
      }
    } else if (size > 0 && second > first) {
      // Copy backwards to handle overlaps
      for (let i = size - 1; i >= 0; i--) {
        this.memory.writeByte(second + i, this.memory.readByte(first + i));
      }
    } else {
      // Copy forwards
      const len = Math.abs(size);
      for (let i = 0; i < len; i++) {
        this.memory.writeByte(second + i, this.memory.readByte(first + i));
      }
    }

    return { nextPC: ins.address + ins.length };
  }

  private op_print_table(ins: DecodedInstruction): ExecutionResult {
    const zsciiText = this.getOperandValue(ins.operands[0]);
    const width = this.getOperandValue(ins.operands[1]);
    const height = ins.operands.length > 2 ? this.getOperandValue(ins.operands[2]) : 1;
    const skip = ins.operands.length > 3 ? this.getOperandValue(ins.operands[3]) : 0;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const byte = this.memory.readByte(zsciiText + row * (width + skip) + col);
        this.printText(String.fromCharCode(byte));
      }
      if (row < height - 1) {
        this.printText('\n');
      }
    }

    return { nextPC: ins.address + ins.length };
  }

  private op_check_arg_count(ins: DecodedInstruction): ExecutionResult {
    const argNum = this.getOperandValue(ins.operands[0]);
    const argCount = this.stack.currentFrame.argumentCount;
    return this.branch(ins, argNum <= argCount);
  }

  // ============================================
  // Extended Opcode Implementations (V5+)
  // ============================================

  private op_log_shift(ins: DecodedInstruction): ExecutionResult {
    const number = this.getOperandValue(ins.operands[0]);
    const places = toSigned16(this.getOperandValue(ins.operands[1]));

    let result: number;
    if (places >= 0) {
      // Left shift (logical)
      result = (number << places) & 0xffff;
    } else {
      // Right shift (logical - zero fill)
      result = (number >>> -places) & 0xffff;
    }

    return this.storeAndContinue(ins, result);
  }

  private op_art_shift(ins: DecodedInstruction): ExecutionResult {
    const number = toSigned16(this.getOperandValue(ins.operands[0]));
    const places = toSigned16(this.getOperandValue(ins.operands[1]));

    let result: number;
    if (places >= 0) {
      // Left shift (arithmetic = same as logical)
      result = (number << places) & 0xffff;
    } else {
      // Right shift (arithmetic - sign extend)
      result = (number >> -places) & 0xffff;
    }

    return this.storeAndContinue(ins, result);
  }

  private op_set_font(ins: DecodedInstruction): ExecutionResult {
    const font = this.getOperandValue(ins.operands[0]);

    // Only fonts 1 (normal) and 4 (fixed-pitch) are typically supported
    // Return previous font, or 0 if font change failed
    if (font === 0) {
      // Query current font
      this.storeResult(ins, 1); // Always normal
    } else if (font === 1 || font === 4) {
      this.storeResult(ins, 1); // Was normal, now font
    } else {
      this.storeResult(ins, 0); // Font not available
    }

    return { nextPC: ins.address + ins.length };
  }

  private op_save_undo(ins: DecodedInstruction): ExecutionResult {
    // Save current state for undo
    const dynamicEnd = this.header.staticMemoryBase;
    const memorySnapshot = new Uint8Array(dynamicEnd);
    for (let i = 0; i < dynamicEnd; i++) {
      memorySnapshot[i] = this.memory.readByte(i);
    }

    // Save stack state (simplified - store raw data)
    const stackSnapshot = this.stack.serialize();

    this.undoState = {
      memory: memorySnapshot,
      stack: stackSnapshot,
      pc: ins.address + ins.length,
    };

    // Return 1 for success (returning normally)
    this.storeResult(ins, 1);
    return { nextPC: ins.address + ins.length };
  }

  private op_restore_undo(ins: DecodedInstruction): ExecutionResult {
    if (!this.undoState) {
      // No undo state available
      this.storeResult(ins, 0);
      return { nextPC: ins.address + ins.length };
    }

    // Restore memory
    for (let i = 0; i < this.undoState.memory.length; i++) {
      this.memory.writeByte(i, this.undoState.memory[i]);
    }

    // Restore stack
    this.stack.deserialize(this.undoState.stack);

    // Return 2 to indicate successful restore
    // (distinguished from save_undo which returns 1)
    this.storeResult(ins, 2);

    // Jump to saved PC
    return { nextPC: this.undoState.pc };
  }

  private op_print_unicode(ins: DecodedInstruction): ExecutionResult {
    const charCode = this.getOperandValue(ins.operands[0]);
    this.printText(String.fromCodePoint(charCode));
    return { nextPC: ins.address + ins.length };
  }

  private op_check_unicode(ins: DecodedInstruction): ExecutionResult {
    const charCode = this.getOperandValue(ins.operands[0]);

    // Bits: 0 = can print, 1 = can read
    // We support printing all Unicode but reading only ASCII
    let result = 0;
    if (charCode >= 0 && charCode <= 0x10ffff) {
      result |= 1; // Can print
    }
    if (charCode >= 32 && charCode <= 126) {
      result |= 2; // Can read (ASCII)
    }

    return this.storeAndContinue(ins, result);
  }

  // ============================================
  // V5+ Control Flow Opcodes
  // ============================================

  /**
   * catch -> (result)
   * Store the current stack frame pointer for use with throw
   */
  private op_catch(ins: DecodedInstruction): ExecutionResult {
    const framePointer = this.stack.getFramePointer();
    return this.storeAndContinue(ins, framePointer);
  }

  /**
   * throw value stack-frame
   * Unwind the stack to the given frame and return the value
   */
  private op_throw(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    const framePointer = this.getOperandValue(ins.operands[1]);

    // Unwind to the frame and get return info
    const frame = this.stack.unwindTo(framePointer);

    // Store return value if needed
    if (frame.storeVariable !== undefined) {
      this.variables.store(frame.storeVariable, value & 0xffff);
    }

    return { nextPC: frame.returnPC };
  }

  /**
   * piracy ?(label)
   * Copy protection check - always branch (we're not pirates!)
   */
  private op_piracy(ins: DecodedInstruction): ExecutionResult {
    // Always return true (disk is genuine)
    return this.branch(ins, true);
  }

  /**
   * erase_line value
   * Erase from cursor to end of line in upper window
   */
  private op_erase_line(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);

    if (value === 1) {
      // Erase from cursor to end of line
      this.io.eraseLine?.();
    }
    // Other values are reserved

    return { nextPC: ins.address + ins.length };
  }

  /**
   * set_true_colour foreground background
   * Set 15-bit RGB colors (V5+)
   */
  private op_set_true_colour(ins: DecodedInstruction): ExecutionResult {
    const foreground = this.getOperandValue(ins.operands[0]);
    const background = this.getOperandValue(ins.operands[1]);

    // Convert 15-bit color to 24-bit RGB
    // Format: 0bBBBBBGGGGGRRRRR
    const toRGB = (color15: number): string | undefined => {
      if (color15 === TrueColor.KEEP_CURRENT) {
        return undefined; // Keep current color
      }
      if (color15 === TrueColor.USE_DEFAULT) {
        return undefined; // Use default
      }

      const r = (color15 & 0x1f) << 3;
      const g = ((color15 >> 5) & 0x1f) << 3;
      const b = ((color15 >> 10) & 0x1f) << 3;
      return `rgb(${r}, ${g}, ${b})`;
    };

    const fg = toRGB(foreground);
    const bg = toRGB(background);

    if (fg !== undefined) {
      this.io.setForegroundColor?.(foreground);
    }
    if (bg !== undefined) {
      this.io.setBackgroundColor?.(background);
    }

    return { nextPC: ins.address + ins.length };
  }
}
