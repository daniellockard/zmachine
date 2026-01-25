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
  Operand,
  OperandType,
  ZVersion,
} from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { Header } from '../memory/Header';
import { Stack } from '../cpu/Stack';
import { Variables } from '../variables/Variables';
import { toSigned16, unpackRoutineAddress } from '../memory/AddressUtils';
import { ZCharDecoder } from '../text/ZCharDecoder';
import { IOAdapter } from '../../io/IOAdapter';

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

  private handlers: Map<string, OpcodeHandler> = new Map();

  constructor(
    memory: Memory,
    header: Header,
    stack: Stack,
    variables: Variables,
    version: ZVersion,
    io: IOAdapter,
    textDecoder: ZCharDecoder
  ) {
    this.memory = memory;
    this.header = header;
    this.stack = stack;
    this.variables = variables;
    this.version = version;
    this.io = io;
    this.textDecoder = textDecoder;

    this.registerHandlers();
  }

  /**
   * Execute a decoded instruction
   */
  async execute(instruction: DecodedInstruction): Promise<ExecutionResult> {
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
        throw new Error(`Invalid operand type: ${operand.type}`);
    }
  }

  /**
   * Store a result value
   */
  storeResult(instruction: DecodedInstruction, value: number): void {
    if (instruction.storeVariable !== undefined) {
      this.variables.store(instruction.storeVariable, value & 0xFFFF);
    }
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
      this.variables.store(frame.storeVariable, value & 0xFFFF);
    }

    return { nextPC: frame.returnPC };
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
    // TODO: Implement object tree
    return this.branch(ins, false);
  }

  private op_test(ins: DecodedInstruction): ExecutionResult {
    const bitmap = this.getOperandValue(ins.operands[0]);
    const flags = this.getOperandValue(ins.operands[1]);
    return this.branch(ins, (bitmap & flags) === flags);
  }

  private op_or(ins: DecodedInstruction): ExecutionResult {
    const a = this.getOperandValue(ins.operands[0]);
    const b = this.getOperandValue(ins.operands[1]);
    this.storeResult(ins, a | b);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_and(ins: DecodedInstruction): ExecutionResult {
    const a = this.getOperandValue(ins.operands[0]);
    const b = this.getOperandValue(ins.operands[1]);
    this.storeResult(ins, a & b);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_test_attr(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object attributes
    return this.branch(ins, false);
  }

  private op_set_attr(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object attributes
    return { nextPC: (ins.address + ins.length) };
  }

  private op_clear_attr(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object attributes
    return { nextPC: (ins.address + ins.length) };
  }

  private op_store(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    const value = this.getOperandValue(ins.operands[1]);
    // store (variable) value - indirect store
    this.variables.write(varNum, value);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_insert_obj(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object tree
    return { nextPC: (ins.address + ins.length) };
  }

  private op_loadw(ins: DecodedInstruction): ExecutionResult {
    const array = this.getOperandValue(ins.operands[0]);
    const wordIndex = this.getOperandValue(ins.operands[1]);
    const value = this.memory.readWord(array + wordIndex * 2);
    this.storeResult(ins, value);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_loadb(ins: DecodedInstruction): ExecutionResult {
    const array = this.getOperandValue(ins.operands[0]);
    const byteIndex = this.getOperandValue(ins.operands[1]);
    const value = this.memory.readByte(array + byteIndex);
    this.storeResult(ins, value);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_get_prop(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object properties
    this.storeResult(ins, 0);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_get_prop_addr(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object properties
    this.storeResult(ins, 0);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_get_next_prop(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object properties
    this.storeResult(ins, 0);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_add(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    this.storeResult(ins, a + b);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_sub(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    this.storeResult(ins, a - b);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_mul(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    this.storeResult(ins, a * b);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_div(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    if (b === 0) {
      return { nextPC: (ins.address + ins.length), error: 'Division by zero' };
    }
    // Integer division truncates towards zero
    const result = Math.trunc(a / b);
    this.storeResult(ins, result);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_mod(ins: DecodedInstruction): ExecutionResult {
    const a = toSigned16(this.getOperandValue(ins.operands[0]));
    const b = toSigned16(this.getOperandValue(ins.operands[1]));
    if (b === 0) {
      return { nextPC: (ins.address + ins.length), error: 'Division by zero' };
    }
    // Remainder has same sign as dividend
    const result = a % b;
    this.storeResult(ins, result);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_call_2s(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    const arg = this.getOperandValue(ins.operands[1]);
    return this.callRoutine(routine, [arg], ins.storeVariable, (ins.address + ins.length));
  }

  private op_call_2n(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    const arg = this.getOperandValue(ins.operands[1]);
    return this.callRoutine(routine, [arg], undefined, (ins.address + ins.length));
  }

  // ============================================
  // 1OP Opcode Implementations
  // ============================================

  private op_jz(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    return this.branch(ins, value === 0);
  }

  private op_get_sibling(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object tree
    this.storeResult(ins, 0);
    return this.branch(ins, false);
  }

  private op_get_child(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object tree
    this.storeResult(ins, 0);
    return this.branch(ins, false);
  }

  private op_get_parent(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object tree
    this.storeResult(ins, 0);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_get_prop_len(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object properties
    this.storeResult(ins, 0);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_inc(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    this.variables.increment(varNum);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_dec(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    this.variables.decrement(varNum);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_print_addr(ins: DecodedInstruction): ExecutionResult {
    const addr = this.getOperandValue(ins.operands[0]);
    const result = this.textDecoder.decode(addr);
    this.io.print(result.text);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_call_1s(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    return this.callRoutine(routine, [], ins.storeVariable, (ins.address + ins.length));
  }

  private op_remove_obj(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object tree
    return { nextPC: (ins.address + ins.length) };
  }

  private op_print_obj(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object names
    return { nextPC: (ins.address + ins.length) };
  }

  private op_ret(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    return this.doReturn(value);
  }

  private op_jump(ins: DecodedInstruction): ExecutionResult {
    const offset = toSigned16(this.getOperandValue(ins.operands[0]));
    // Jump is relative to the instruction *after* the operand
    return { nextPC: (ins.address + ins.length) + offset - 2 };
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
    this.io.print(result.text);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_load(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    // load (variable) -> (result) - indirect load
    const value = this.variables.peek(varNum);
    this.storeResult(ins, value);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_not(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    this.storeResult(ins, ~value & 0xFFFF);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_call_1n(ins: DecodedInstruction): ExecutionResult {
    const routine = this.getOperandValue(ins.operands[0]);
    return this.callRoutine(routine, [], undefined, (ins.address + ins.length));
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
      this.io.print(ins.text);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_print_ret(ins: DecodedInstruction): ExecutionResult {
    if (ins.text) {
      this.io.print(ins.text);
    }
    this.io.newLine();
    return this.doReturn(1);
  }

  private op_nop(ins: DecodedInstruction): ExecutionResult {
    return { nextPC: (ins.address + ins.length) };
  }

  private async op_save(ins: DecodedInstruction): Promise<ExecutionResult> {
    // V3: save branches, V4+: save stores
    if (this.io.save) {
      // TODO: Create save data
      const saved = await this.io.save(new Uint8Array(0));
      if (this.version <= 3) {
        return this.branch(ins, saved);
      } else {
        this.storeResult(ins, saved ? 1 : 0);
      }
    } else {
      if (this.version <= 3) {
        return this.branch(ins, false);
      } else {
        this.storeResult(ins, 0);
      }
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private async op_restore(ins: DecodedInstruction): Promise<ExecutionResult> {
    // V3: restore branches, V4+: restore stores
    if (this.io.restore) {
      const data = await this.io.restore();
      if (data) {
        // TODO: Restore game state
        if (this.version <= 3) {
          return this.branch(ins, true);
        } else {
          this.storeResult(ins, 2);
        }
      } else {
        if (this.version <= 3) {
          return this.branch(ins, false);
        } else {
          this.storeResult(ins, 0);
        }
      }
    } else {
      if (this.version <= 3) {
        return this.branch(ins, false);
      } else {
        this.storeResult(ins, 0);
      }
    }
    return { nextPC: (ins.address + ins.length) };
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
    return { nextPC: (ins.address + ins.length) };
  }

  private op_quit(_ins: DecodedInstruction): ExecutionResult {
    this.io.quit();
    return { nextPC: 0, halted: true };
  }

  private op_new_line(ins: DecodedInstruction): ExecutionResult {
    this.io.newLine();
    return { nextPC: (ins.address + ins.length) };
  }

  private op_show_status(ins: DecodedInstruction): ExecutionResult {
    if (this.io.showStatusLine) {
      // TODO: Get actual status from game state
      this.io.showStatusLine('Unknown', 0, 0, false);
    }
    return { nextPC: (ins.address + ins.length) };
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
    return this.callRoutine(routine, args, ins.storeVariable, (ins.address + ins.length));
  }

  private op_storew(ins: DecodedInstruction): ExecutionResult {
    const array = this.getOperandValue(ins.operands[0]);
    const wordIndex = this.getOperandValue(ins.operands[1]);
    const value = this.getOperandValue(ins.operands[2]);
    this.memory.writeWord(array + wordIndex * 2, value);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_storeb(ins: DecodedInstruction): ExecutionResult {
    const array = this.getOperandValue(ins.operands[0]);
    const byteIndex = this.getOperandValue(ins.operands[1]);
    const value = this.getOperandValue(ins.operands[2]);
    this.memory.writeByte(array + byteIndex, value & 0xFF);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_put_prop(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement object properties
    return { nextPC: (ins.address + ins.length) };
  }

  private async op_sread(ins: DecodedInstruction): Promise<ExecutionResult> {
    // V1-3 read opcode
    const textBuffer = this.getOperandValue(ins.operands[0]);
    const parseBuffer = this.getOperandValue(ins.operands[1]);
    
    const maxLen = this.memory.readByte(textBuffer);
    const result = await this.io.readLine(maxLen);
    
    // Store text in buffer
    const text = result.text.toLowerCase();
    for (let i = 0; i < text.length; i++) {
      this.memory.writeByte(textBuffer + 1 + i, text.charCodeAt(i));
    }
    this.memory.writeByte(textBuffer + 1 + text.length, 0);
    
    // TODO: Tokenize input
    
    return { nextPC: (ins.address + ins.length) };
  }

  private async op_aread(ins: DecodedInstruction): Promise<ExecutionResult> {
    // V4+ read opcode (same as sread for now)
    return this.op_sread(ins);
  }

  private op_print_char(ins: DecodedInstruction): ExecutionResult {
    const zscii = this.getOperandValue(ins.operands[0]);
    // Convert ZSCII to Unicode
    const char = String.fromCharCode(zscii);
    this.io.print(char);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_print_num(ins: DecodedInstruction): ExecutionResult {
    const num = toSigned16(this.getOperandValue(ins.operands[0]));
    this.io.print(num.toString());
    return { nextPC: (ins.address + ins.length) };
  }

  private randomSeed: number = Date.now();
  private randomMode: 'random' | 'predictable' = 'random';
  private predictableCounter: number = 0;

  private op_random(ins: DecodedInstruction): ExecutionResult {
    const range = toSigned16(this.getOperandValue(ins.operands[0]));
    
    if (range <= 0) {
      // Seed the random number generator
      if (range === 0) {
        this.randomMode = 'random';
        this.randomSeed = Date.now();
      } else {
        this.randomMode = 'predictable';
        this.predictableCounter = 0;
        this.randomSeed = -range;
      }
      this.storeResult(ins, 0);
    } else {
      // Generate random number from 1 to range
      let result: number;
      if (this.randomMode === 'random') {
        result = Math.floor(Math.random() * range) + 1;
      } else {
        this.predictableCounter = (this.predictableCounter + 1) % range;
        result = this.predictableCounter + 1;
      }
      this.storeResult(ins, result);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_push(ins: DecodedInstruction): ExecutionResult {
    const value = this.getOperandValue(ins.operands[0]);
    this.stack.push(value);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_pull(ins: DecodedInstruction): ExecutionResult {
    const varNum = this.getOperandValue(ins.operands[0]);
    const value = this.stack.pop();
    this.variables.write(varNum, value);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_split_window(ins: DecodedInstruction): ExecutionResult {
    const lines = this.getOperandValue(ins.operands[0]);
    if (this.io.splitWindow) {
      this.io.splitWindow(lines);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_set_window(ins: DecodedInstruction): ExecutionResult {
    const window = this.getOperandValue(ins.operands[0]);
    if (this.io.setWindow) {
      this.io.setWindow(window);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_erase_window(ins: DecodedInstruction): ExecutionResult {
    const window = this.getOperandValue(ins.operands[0]);
    if (this.io.eraseWindow) {
      this.io.eraseWindow(window);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_set_cursor(ins: DecodedInstruction): ExecutionResult {
    const line = this.getOperandValue(ins.operands[0]);
    const column = this.getOperandValue(ins.operands[1]);
    if (this.io.setCursor) {
      this.io.setCursor(line, column);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_set_text_style(ins: DecodedInstruction): ExecutionResult {
    const style = this.getOperandValue(ins.operands[0]);
    if (this.io.setTextStyle) {
      this.io.setTextStyle(style);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_buffer_mode(ins: DecodedInstruction): ExecutionResult {
    const mode = this.getOperandValue(ins.operands[0]);
    if (this.io.setBufferMode) {
      this.io.setBufferMode(mode !== 0);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_output_stream(ins: DecodedInstruction): ExecutionResult {
    const stream = toSigned16(this.getOperandValue(ins.operands[0]));
    const table = ins.operands.length > 1 ? this.getOperandValue(ins.operands[1]) : undefined;
    if (this.io.setOutputStream) {
      this.io.setOutputStream(Math.abs(stream), stream > 0, table);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_input_stream(ins: DecodedInstruction): ExecutionResult {
    const stream = this.getOperandValue(ins.operands[0]);
    if (this.io.setInputStream) {
      this.io.setInputStream(stream);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private op_sound_effect(ins: DecodedInstruction): ExecutionResult {
    const number = this.getOperandValue(ins.operands[0]);
    const effect = ins.operands.length > 1 ? this.getOperandValue(ins.operands[1]) : 0;
    const volume = ins.operands.length > 2 ? this.getOperandValue(ins.operands[2]) : 0;
    if (this.io.soundEffect) {
      this.io.soundEffect(number, effect, volume);
    }
    return { nextPC: (ins.address + ins.length) };
  }

  private async op_read_char(ins: DecodedInstruction): Promise<ExecutionResult> {
    // Operand 0 is always 1 (read from keyboard)
    const timeout = ins.operands.length > 1 ? this.getOperandValue(ins.operands[1]) : 0;
    const char = await this.io.readChar(timeout);
    this.storeResult(ins, char);
    return { nextPC: (ins.address + ins.length) };
  }

  private op_scan_table(ins: DecodedInstruction): ExecutionResult {
    const x = this.getOperandValue(ins.operands[0]);
    const table = this.getOperandValue(ins.operands[1]);
    const len = this.getOperandValue(ins.operands[2]);
    const form = ins.operands.length > 3 ? this.getOperandValue(ins.operands[3]) : 0x82;
    
    const entryLen = form & 0x7F;
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
    return this.callRoutine(routine, args, undefined, (ins.address + ins.length));
  }

  private op_tokenise(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement tokenization
    return { nextPC: (ins.address + ins.length) };
  }

  private op_encode_text(ins: DecodedInstruction): ExecutionResult {
    // TODO: Implement text encoding
    return { nextPC: (ins.address + ins.length) };
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
    
    return { nextPC: (ins.address + ins.length) };
  }

  private op_print_table(ins: DecodedInstruction): ExecutionResult {
    const zsciiText = this.getOperandValue(ins.operands[0]);
    const width = this.getOperandValue(ins.operands[1]);
    const height = ins.operands.length > 2 ? this.getOperandValue(ins.operands[2]) : 1;
    const skip = ins.operands.length > 3 ? this.getOperandValue(ins.operands[3]) : 0;
    
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const byte = this.memory.readByte(zsciiText + row * (width + skip) + col);
        this.io.print(String.fromCharCode(byte));
      }
      if (row < height - 1) {
        this.io.newLine();
      }
    }
    
    return { nextPC: (ins.address + ins.length) };
  }

  private op_check_arg_count(ins: DecodedInstruction): ExecutionResult {
    const argNum = this.getOperandValue(ins.operands[0]);
    const argCount = this.stack.currentFrame.argumentCount;
    return this.branch(ins, argNum <= argCount);
  }
}
