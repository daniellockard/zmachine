/**
 * Tests for Executor module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Executor } from './Executor';
import { Memory } from '../memory/Memory';
import { Header } from '../memory/Header';
import { Stack } from '../cpu/Stack';
import { Variables } from '../variables/Variables';
import { ZCharDecoder } from '../text/ZCharDecoder';
import { TestIOAdapter } from '../../io/TestIOAdapter';
import { DecodedInstruction, OperandType, Operand, InstructionForm, OperandCount } from '../../types/ZMachineTypes';

describe('Executor', () => {
  let memory: Memory;
  let header: Header;
  let stack: Stack;
  let variables: Variables;
  let textDecoder: ZCharDecoder;
  let io: TestIOAdapter;
  let executor: Executor;

  function createTestMemory(): Memory {
    const size = 0x10000; // 64KB
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Header
    view.setUint8(0x00, 3); // Version 3
    view.setUint16(0x04, 0x4000, false); // High memory base
    view.setUint16(0x06, 0x1000, false); // Initial PC
    view.setUint16(0x0C, 0x100, false); // Globals table
    view.setUint16(0x0E, 0x2000, false); // Static memory base
    view.setUint16(0x18, 0x40, false); // Abbreviations table

    return new Memory(buffer);
  }

  function makeOperand(type: OperandType, value: number): Operand {
    return { type, value };
  }

  function makeInstruction(
    name: string,
    operands: Operand[],
    length: number,
    options: {
      address?: number;
      storeVariable?: number;
      branch?: { branchOnTrue: boolean; offset: number };
      text?: string;
    } = {}
  ): DecodedInstruction {
    const address = options.address ?? 0x1000;
    const opCount = operands.length;
    let operandCount: OperandCount;
    if (opCount === 0) operandCount = OperandCount.OP0;
    else if (opCount === 1) operandCount = OperandCount.OP1;
    else if (opCount === 2) operandCount = OperandCount.OP2;
    else operandCount = OperandCount.VAR;
    
    return {
      address,
      length,
      opcode: 0,
      opcodeName: name,
      form: InstructionForm.Variable,
      operandCount,
      operands,
      storeVariable: options.storeVariable,
      branch: options.branch,
      text: options.text,
    };
  }

  beforeEach(() => {
    memory = createTestMemory();
    header = new Header(memory);
    stack = new Stack();
    stack.initialize(0);
    variables = new Variables(memory, stack, header.globalsAddress);
    io = new TestIOAdapter();
    textDecoder = new ZCharDecoder(memory, 3, header.abbreviationsAddress);
    executor = new Executor(memory, header, stack, variables, 3, io, textDecoder);
  });

  describe('arithmetic operations', () => {
    it('should execute add', async () => {
      const ins = makeInstruction('add', [
        makeOperand(OperandType.SmallConstant, 10),
        makeOperand(OperandType.SmallConstant, 20),
      ], 4, { storeVariable: 16 });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4);
      expect(variables.read(16)).toBe(30);
    });

    it('should execute sub', async () => {
      const ins = makeInstruction('sub', [
        makeOperand(OperandType.SmallConstant, 50),
        makeOperand(OperandType.SmallConstant, 20),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(30);
    });

    it('should execute mul', async () => {
      const ins = makeInstruction('mul', [
        makeOperand(OperandType.SmallConstant, 6),
        makeOperand(OperandType.SmallConstant, 7),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(42);
    });

    it('should execute div', async () => {
      const ins = makeInstruction('div', [
        makeOperand(OperandType.SmallConstant, 100),
        makeOperand(OperandType.SmallConstant, 3),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(33);
    });

    it('should handle division by zero', async () => {
      const ins = makeInstruction('div', [
        makeOperand(OperandType.SmallConstant, 100),
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, { storeVariable: 16 });

      const result = await executor.execute(ins);

      expect(result.error).toContain('Division by zero');
    });

    it('should execute mod', async () => {
      const ins = makeInstruction('mod', [
        makeOperand(OperandType.SmallConstant, 17),
        makeOperand(OperandType.SmallConstant, 5),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(2);
    });

    it('should handle signed arithmetic', async () => {
      // -10 + 5 = -5
      const ins = makeInstruction('add', [
        makeOperand(OperandType.LargeConstant, 0xFFF6), // -10
        makeOperand(OperandType.SmallConstant, 5),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0xFFFB); // -5
    });
  });

  describe('bitwise operations', () => {
    it('should execute and', async () => {
      const ins = makeInstruction('and', [
        makeOperand(OperandType.LargeConstant, 0xFF00),
        makeOperand(OperandType.LargeConstant, 0x0FF0),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0x0F00);
    });

    it('should execute or', async () => {
      const ins = makeInstruction('or', [
        makeOperand(OperandType.LargeConstant, 0xFF00),
        makeOperand(OperandType.LargeConstant, 0x00FF),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0xFFFF);
    });

    it('should execute not', async () => {
      const ins = makeInstruction('not', [
        makeOperand(OperandType.LargeConstant, 0x00FF),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0xFF00);
    });
  });

  describe('branch operations', () => {
    it('should branch when jz condition is true', async () => {
      const ins = makeInstruction('jz', [
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should not branch when jz condition is false', async () => {
      const ins = makeInstruction('jz', [
        makeOperand(OperandType.SmallConstant, 42),
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4);
    });

    it('should handle branch on false', async () => {
      const ins = makeInstruction('jz', [
        makeOperand(OperandType.SmallConstant, 42),
      ], 4, {
        branch: { branchOnTrue: false, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should branch to return 0 with offset 0', async () => {
      stack.pushFrame(0x2000, 16, 0, 0);
      const ins = makeInstruction('jz', [
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, {
        branch: { branchOnTrue: true, offset: 0 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x2000);
      expect(variables.read(16)).toBe(0);
    });

    it('should branch to return 1 with offset 1', async () => {
      stack.pushFrame(0x2000, 16, 0, 0);
      const ins = makeInstruction('jz', [
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, {
        branch: { branchOnTrue: true, offset: 1 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x2000);
      expect(variables.read(16)).toBe(1);
    });
  });

  describe('comparison operations', () => {
    it('should execute je with 2 operands', async () => {
      const ins = makeInstruction('je', [
        makeOperand(OperandType.SmallConstant, 5),
        makeOperand(OperandType.SmallConstant, 5),
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should execute je with multiple comparisons', async () => {
      const ins = makeInstruction('je', [
        makeOperand(OperandType.SmallConstant, 5),
        makeOperand(OperandType.SmallConstant, 3),
        makeOperand(OperandType.SmallConstant, 5),
        makeOperand(OperandType.SmallConstant, 7),
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should execute jl for signed comparison', async () => {
      const ins = makeInstruction('jl', [
        makeOperand(OperandType.LargeConstant, 0xFFFF), // -1
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should execute jg for signed comparison', async () => {
      const ins = makeInstruction('jg', [
        makeOperand(OperandType.SmallConstant, 0),
        makeOperand(OperandType.LargeConstant, 0xFFFF), // -1
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should execute test', async () => {
      // test 0xFF 0x0F should branch (all flag bits set)
      const ins = makeInstruction('test', [
        makeOperand(OperandType.LargeConstant, 0xFF),
        makeOperand(OperandType.SmallConstant, 0x0F),
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });
  });

  describe('return operations', () => {
    beforeEach(() => {
      stack.pushFrame(0x2000, 16, 1, 0);
    });

    it('should execute rtrue', async () => {
      const ins = makeInstruction('rtrue', [], 4);

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x2000);
      expect(variables.read(16)).toBe(1);
    });

    it('should execute rfalse', async () => {
      const ins = makeInstruction('rfalse', [], 4);

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x2000);
      expect(variables.read(16)).toBe(0);
    });

    it('should execute ret', async () => {
      const ins = makeInstruction('ret', [
        makeOperand(OperandType.SmallConstant, 42),
      ], 4);

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x2000);
      expect(variables.read(16)).toBe(42);
    });

    it('should execute ret_popped', async () => {
      stack.push(99);
      const ins = makeInstruction('ret_popped', [], 4);

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x2000);
      expect(variables.read(16)).toBe(99);
    });
  });

  describe('stack operations', () => {
    it('should execute push', async () => {
      const ins = makeInstruction('push', [
        makeOperand(OperandType.SmallConstant, 42),
      ], 4);

      await executor.execute(ins);

      expect(stack.pop()).toBe(42);
    });

    it('should execute pull', async () => {
      stack.push(42);
      const ins = makeInstruction('pull', [
        makeOperand(OperandType.SmallConstant, 16), // Store in global 0
      ], 4);

      await executor.execute(ins);

      expect(variables.read(16)).toBe(42);
    });

    it('should execute pop', async () => {
      stack.push(42);
      stack.push(99);
      const ins = makeInstruction('pop', [], 4);

      await executor.execute(ins);

      expect(stack.pop()).toBe(42);
    });
  });

  describe('memory operations', () => {
    it('should execute loadw', async () => {
      memory.writeWord(0x500, 0x1234);
      const ins = makeInstruction('loadw', [
        makeOperand(OperandType.LargeConstant, 0x500),
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0x1234);
    });

    it('should execute loadb', async () => {
      memory.writeByte(0x500, 0xAB);
      const ins = makeInstruction('loadb', [
        makeOperand(OperandType.LargeConstant, 0x500),
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0xAB);
    });

    it('should execute storew', async () => {
      const ins = makeInstruction('storew', [
        makeOperand(OperandType.LargeConstant, 0x500),
        makeOperand(OperandType.SmallConstant, 2),
        makeOperand(OperandType.LargeConstant, 0xABCD),
      ], 4);

      await executor.execute(ins);

      expect(memory.readWord(0x504)).toBe(0xABCD);
    });

    it('should execute storeb', async () => {
      const ins = makeInstruction('storeb', [
        makeOperand(OperandType.LargeConstant, 0x500),
        makeOperand(OperandType.SmallConstant, 5),
        makeOperand(OperandType.SmallConstant, 0xFF),
      ], 4);

      await executor.execute(ins);

      expect(memory.readByte(0x505)).toBe(0xFF);
    });
  });

  describe('variable operations', () => {
    beforeEach(() => {
      stack.pushFrame(0x2000, undefined, 3, 0);
      stack.currentFrame.setLocal(0, 100);
    });

    it('should execute inc', async () => {
      const ins = makeInstruction('inc', [
        makeOperand(OperandType.SmallConstant, 1), // Local 0
      ], 4);

      await executor.execute(ins);

      expect(variables.read(1)).toBe(101);
    });

    it('should execute dec', async () => {
      const ins = makeInstruction('dec', [
        makeOperand(OperandType.SmallConstant, 1), // Local 0
      ], 4);

      await executor.execute(ins);

      expect(variables.read(1)).toBe(99);
    });

    it('should execute inc_chk with branch', async () => {
      const ins = makeInstruction('inc_chk', [
        makeOperand(OperandType.SmallConstant, 1), // Local 0
        makeOperand(OperandType.SmallConstant, 100), // Check value
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(variables.read(1)).toBe(101);
      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should execute dec_chk with branch', async () => {
      const ins = makeInstruction('dec_chk', [
        makeOperand(OperandType.SmallConstant, 1), // Local 0
        makeOperand(OperandType.SmallConstant, 100), // Check value
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(variables.read(1)).toBe(99);
      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should execute store (indirect)', async () => {
      const ins = makeInstruction('store', [
        makeOperand(OperandType.SmallConstant, 1), // Variable number
        makeOperand(OperandType.SmallConstant, 42), // Value
      ], 4);

      await executor.execute(ins);

      expect(variables.read(1)).toBe(42);
    });

    it('should execute load (indirect)', async () => {
      const ins = makeInstruction('load', [
        makeOperand(OperandType.SmallConstant, 1), // Variable number
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(100);
    });
  });

  describe('output operations', () => {
    it('should execute print_char', async () => {
      const ins = makeInstruction('print_char', [
        makeOperand(OperandType.SmallConstant, 65), // 'A'
      ], 4);

      await executor.execute(ins);

      expect(io.getFullOutput()).toBe('A');
    });

    it('should execute print_num', async () => {
      const ins = makeInstruction('print_num', [
        makeOperand(OperandType.SmallConstant, 42),
      ], 4);

      await executor.execute(ins);

      expect(io.getFullOutput()).toBe('42');
    });

    it('should execute print_num with negative', async () => {
      const ins = makeInstruction('print_num', [
        makeOperand(OperandType.LargeConstant, 0xFFD6), // -42
      ], 4);

      await executor.execute(ins);

      expect(io.getFullOutput()).toBe('-42');
    });

    it('should execute new_line', async () => {
      const ins = makeInstruction('new_line', [], 4);

      await executor.execute(ins);

      expect(io.getFullOutput()).toBe('\n');
    });
  });

  describe('control flow', () => {
    it('should execute jump', async () => {
      const ins = makeInstruction('jump', [
        makeOperand(OperandType.LargeConstant, 10),
      ], 4);

      const result = await executor.execute(ins);

      // Jump offset is relative to (address + length) - 2
      // So nextPC = 0x1000 + 4 + 10 - 2 = 0x100C
      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should execute jump with negative offset', async () => {
      const ins = makeInstruction('jump', [
        makeOperand(OperandType.LargeConstant, 0xFFF6), // -10
      ], 4);

      const result = await executor.execute(ins);

      // Jump offset is relative to (address + length) - 2
      // So nextPC = 0x1000 + 4 - 10 - 2 = 0xFF8
      expect(result.nextPC).toBe(0x1000 + 4 - 10 - 2);
    });

    it('should execute quit', async () => {
      const ins = makeInstruction('quit', [], 4);

      const result = await executor.execute(ins);

      expect(result.halted).toBe(true);
      expect(io.hasQuit).toBe(true);
    });

    it('should execute nop', async () => {
      const ins = makeInstruction('nop', [], 4);

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4);
    });
  });

  describe('random number generation', () => {
    it('should generate random number in range', async () => {
      const ins = makeInstruction('random', [
        makeOperand(OperandType.SmallConstant, 10),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      const value = variables.read(16);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    });

    it('should seed with 0 for true random', async () => {
      const ins = makeInstruction('random', [
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0);
    });

    it('should provide predictable sequence with negative seed', async () => {
      // Seed with -5
      let ins = makeInstruction('random', [
        makeOperand(OperandType.LargeConstant, 0xFFFB), // -5
      ], 4, { storeVariable: 16 });
      await executor.execute(ins);

      // Generate sequence
      const values: number[] = [];
      for (let i = 0; i < 6; i++) {
        ins = makeInstruction('random', [
          makeOperand(OperandType.SmallConstant, 5),
        ], 4, { storeVariable: 16 });
        await executor.execute(ins);
        values.push(variables.read(16));
      }

      // Sequence should cycle through 1-5 predictably
      expect(values[0]).toBe(values[5]); // Cycle repeats
    });
  });

  describe('object operations', () => {
    // Set up object table for tests
    // V3: object table at 0x200, property defaults 31 words (62 bytes)
    // Objects start at 0x200 + 62 = 0x23E
    // Each object is 9 bytes: 4 attr + 1 parent + 1 sibling + 1 child + 2 prop addr
    
    function setupObjectTable(): void {
      const objTableAddr = 0x200;
      // Set object table address in header
      memory.writeWord(0x0A, objTableAddr);
      
      // Write property defaults (62 bytes of zeros)
      for (let i = 0; i < 62; i++) {
        memory.writeByte(objTableAddr + i, 0);
      }
      
      const entriesStart = objTableAddr + 62;
      
      // Object 1: parent=0, sibling=0, child=2, prop=0x300
      // Attr bytes: 0x80 (attr 0 set), 0, 0, 0
      memory.writeByte(entriesStart + 0, 0x80); // Attr 0 set
      memory.writeByte(entriesStart + 1, 0);
      memory.writeByte(entriesStart + 2, 0);
      memory.writeByte(entriesStart + 3, 0);
      memory.writeByte(entriesStart + 4, 0);   // parent
      memory.writeByte(entriesStart + 5, 0);   // sibling
      memory.writeByte(entriesStart + 6, 2);   // child = obj 2
      memory.writeWord(entriesStart + 7, 0x300); // prop table
      
      // Object 2: parent=1, sibling=3, child=0, prop=0x320
      memory.writeByte(entriesStart + 9, 0);   // No attrs
      memory.writeByte(entriesStart + 10, 0);
      memory.writeByte(entriesStart + 11, 0);
      memory.writeByte(entriesStart + 12, 0);
      memory.writeByte(entriesStart + 13, 1);  // parent = obj 1
      memory.writeByte(entriesStart + 14, 3);  // sibling = obj 3
      memory.writeByte(entriesStart + 15, 0);  // no children
      memory.writeWord(entriesStart + 16, 0x320);
      
      // Object 3: parent=1, sibling=0, child=0, prop=0x340
      memory.writeByte(entriesStart + 18, 0);
      memory.writeByte(entriesStart + 19, 0);
      memory.writeByte(entriesStart + 20, 0);
      memory.writeByte(entriesStart + 21, 0);
      memory.writeByte(entriesStart + 22, 1);  // parent = obj 1
      memory.writeByte(entriesStart + 23, 0);  // no sibling
      memory.writeByte(entriesStart + 24, 0);  // no children
      memory.writeWord(entriesStart + 25, 0x340);
      
      // Property table for object 1 at 0x300
      // Short name length = 2 words (4 bytes)
      memory.writeByte(0x300, 2);
      // Short name: "Test" encoded (placeholder)
      memory.writeWord(0x301, 0x94A5); // Encoded text
      memory.writeWord(0x303, 0xC8A5);
      // Property 5 with 2 bytes of data
      memory.writeByte(0x305, 0x45); // size=1 (2 bytes), prop=5
      memory.writeWord(0x306, 0x1234);
      // Property 3 with 1 byte of data
      memory.writeByte(0x308, 0x03); // size=0 (1 byte), prop=3
      memory.writeByte(0x309, 0x42);
      // End of properties
      memory.writeByte(0x30A, 0);
      
      // Recreate executor with updated memory
      const newHeader = new Header(memory);
      executor = new Executor(memory, newHeader, stack, variables, 3, io, textDecoder);
    }

    it('should execute get_parent', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_parent', [
        makeOperand(OperandType.SmallConstant, 2), // Object 2
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(1); // Parent is object 1
    });

    it('should execute get_child', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_child', [
        makeOperand(OperandType.SmallConstant, 1), // Object 1
      ], 4, { storeVariable: 16, branch: { branchOnTrue: true, offset: 10 } });

      const result = await executor.execute(ins);

      expect(variables.read(16)).toBe(2); // Child is object 2
      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2); // Branch taken
    });

    it('should execute get_child with no children', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_child', [
        makeOperand(OperandType.SmallConstant, 2), // Object 2 has no children
      ], 4, { storeVariable: 16, branch: { branchOnTrue: true, offset: 10 } });

      const result = await executor.execute(ins);

      expect(variables.read(16)).toBe(0); // No child
      expect(result.nextPC).toBe(0x1000 + 4); // No branch
    });

    it('should execute get_sibling', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_sibling', [
        makeOperand(OperandType.SmallConstant, 2), // Object 2
      ], 4, { storeVariable: 16, branch: { branchOnTrue: true, offset: 10 } });

      const result = await executor.execute(ins);

      expect(variables.read(16)).toBe(3); // Sibling is object 3
      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2); // Branch taken
    });

    it('should execute jin - object is in parent', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('jin', [
        makeOperand(OperandType.SmallConstant, 2), // Object 2
        makeOperand(OperandType.SmallConstant, 1), // Is in object 1?
      ], 4, { branch: { branchOnTrue: true, offset: 10 } });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2); // Branch taken - yes, obj 2 is in obj 1
    });

    it('should execute jin - object not in parent', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('jin', [
        makeOperand(OperandType.SmallConstant, 1), // Object 1
        makeOperand(OperandType.SmallConstant, 2), // Is in object 2?
      ], 4, { branch: { branchOnTrue: true, offset: 10 } });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4); // No branch - obj 1 is not in obj 2
    });

    it('should execute test_attr - attribute set', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('test_attr', [
        makeOperand(OperandType.SmallConstant, 1), // Object 1
        makeOperand(OperandType.SmallConstant, 0), // Attribute 0 (set)
      ], 4, { branch: { branchOnTrue: true, offset: 10 } });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2); // Branch taken
    });

    it('should execute test_attr - attribute not set', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('test_attr', [
        makeOperand(OperandType.SmallConstant, 1), // Object 1
        makeOperand(OperandType.SmallConstant, 1), // Attribute 1 (not set)
      ], 4, { branch: { branchOnTrue: true, offset: 10 } });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4); // No branch
    });

    it('should execute set_attr', async () => {
      setupObjectTable();
      
      // First verify attr 1 is not set
      let ins = makeInstruction('test_attr', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 1),
      ], 4, { branch: { branchOnTrue: true, offset: 10 } });
      let result = await executor.execute(ins);
      expect(result.nextPC).toBe(0x1000 + 4); // Not set

      // Set attribute 1
      ins = makeInstruction('set_attr', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 1),
      ], 4);
      await executor.execute(ins);

      // Verify attr 1 is now set
      ins = makeInstruction('test_attr', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 1),
      ], 4, { branch: { branchOnTrue: true, offset: 10 } });
      result = await executor.execute(ins);
      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2); // Now set
    });

    it('should execute clear_attr', async () => {
      setupObjectTable();
      
      // Verify attr 0 is set
      let ins = makeInstruction('test_attr', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, { branch: { branchOnTrue: true, offset: 10 } });
      let result = await executor.execute(ins);
      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2); // Set

      // Clear attribute 0
      ins = makeInstruction('clear_attr', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 0),
      ], 4);
      await executor.execute(ins);

      // Verify attr 0 is now clear
      ins = makeInstruction('test_attr', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, { branch: { branchOnTrue: true, offset: 10 } });
      result = await executor.execute(ins);
      expect(result.nextPC).toBe(0x1000 + 4); // Now clear
    });

    it('should execute insert_obj', async () => {
      setupObjectTable();
      
      // Insert object 3 into object 2
      const ins = makeInstruction('insert_obj', [
        makeOperand(OperandType.SmallConstant, 3), // Object to insert
        makeOperand(OperandType.SmallConstant, 2), // Destination
      ], 4);
      await executor.execute(ins);

      // Verify object 3 is now child of object 2
      const getParent = makeInstruction('get_parent', [
        makeOperand(OperandType.SmallConstant, 3),
      ], 4, { storeVariable: 16 });
      await executor.execute(getParent);
      expect(variables.read(16)).toBe(2);

      // Verify object 2's child is now object 3
      const getChild = makeInstruction('get_child', [
        makeOperand(OperandType.SmallConstant, 2),
      ], 4, { storeVariable: 16, branch: { branchOnTrue: true, offset: 10 } });
      await executor.execute(getChild);
      expect(variables.read(16)).toBe(3);
    });

    it('should execute remove_obj', async () => {
      setupObjectTable();
      
      // Remove object 2 from its parent
      const ins = makeInstruction('remove_obj', [
        makeOperand(OperandType.SmallConstant, 2),
      ], 4);
      await executor.execute(ins);

      // Verify object 2 has no parent
      const getParent = makeInstruction('get_parent', [
        makeOperand(OperandType.SmallConstant, 2),
      ], 4, { storeVariable: 16 });
      await executor.execute(getParent);
      expect(variables.read(16)).toBe(0);

      // Verify object 1's child is now object 3 (skipped 2)
      const getChild = makeInstruction('get_child', [
        makeOperand(OperandType.SmallConstant, 1),
      ], 4, { storeVariable: 16, branch: { branchOnTrue: true, offset: 10 } });
      await executor.execute(getChild);
      expect(variables.read(16)).toBe(3);
    });
  });

  describe('property operations', () => {
    function setupObjectTable(): void {
      const objTableAddr = 0x200;
      memory.writeWord(0x0A, objTableAddr);
      
      // Property defaults - set default for property 10 to 0x9999
      memory.writeWord(objTableAddr + (10 - 1) * 2, 0x9999);
      
      const entriesStart = objTableAddr + 62;
      
      // Object 1: prop table at 0x300
      memory.writeByte(entriesStart + 0, 0);
      memory.writeByte(entriesStart + 1, 0);
      memory.writeByte(entriesStart + 2, 0);
      memory.writeByte(entriesStart + 3, 0);
      memory.writeByte(entriesStart + 4, 0);
      memory.writeByte(entriesStart + 5, 0);
      memory.writeByte(entriesStart + 6, 0);
      memory.writeWord(entriesStart + 7, 0x300);
      
      // Property table at 0x300
      memory.writeByte(0x300, 0); // No short name
      // Property 5: 2 bytes
      memory.writeByte(0x301, 0x25); // (1 << 5) | 5 = size 2, prop 5
      memory.writeWord(0x302, 0x1234);
      // Property 3: 1 byte
      memory.writeByte(0x304, 0x03); // (0 << 5) | 3 = size 1, prop 3
      memory.writeByte(0x305, 0x42);
      // End
      memory.writeByte(0x306, 0);
      
      const newHeader = new Header(memory);
      executor = new Executor(memory, newHeader, stack, variables, 3, io, textDecoder);
    }

    it('should execute get_prop - 2-byte property', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_prop', [
        makeOperand(OperandType.SmallConstant, 1), // Object 1
        makeOperand(OperandType.SmallConstant, 5), // Property 5
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0x1234);
    });

    it('should execute get_prop - 1-byte property', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_prop', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 3),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0x42);
    });

    it('should execute get_prop - returns default for missing property', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_prop', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 10), // Property 10 (not on object)
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0x9999); // Default value
    });

    it('should execute put_prop', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('put_prop', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 5),
        makeOperand(OperandType.LargeConstant, 0x5678),
      ], 6);

      await executor.execute(ins);

      // Verify property was changed
      const getProp = makeInstruction('get_prop', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 5),
      ], 4, { storeVariable: 16 });
      await executor.execute(getProp);
      
      expect(variables.read(16)).toBe(0x5678);
    });

    it('should execute get_prop_addr', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_prop_addr', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 5),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0x302); // Address of property 5 data
    });

    it('should execute get_prop_addr - returns 0 for missing property', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_prop_addr', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 10), // Not present
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0);
    });

    it('should execute get_prop_len', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_prop_len', [
        makeOperand(OperandType.LargeConstant, 0x302), // Address of prop 5 data
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(2); // 2 bytes
    });

    it('should execute get_prop_len - returns 0 for address 0', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_prop_len', [
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0);
    });

    it('should execute get_next_prop - first property', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_next_prop', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 0), // 0 = get first
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(5); // First property is 5
    });

    it('should execute get_next_prop - next property', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_next_prop', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 5), // After property 5
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(3); // Next is property 3
    });

    it('should execute get_next_prop - returns 0 at end', async () => {
      setupObjectTable();
      
      const ins = makeInstruction('get_next_prop', [
        makeOperand(OperandType.SmallConstant, 1),
        makeOperand(OperandType.SmallConstant, 3), // After property 3 (last)
      ], 4, { storeVariable: 16 });

      await executor.execute(ins);

      expect(variables.read(16)).toBe(0); // No more properties
    });
  });
});
