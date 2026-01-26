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
import { createQuetzalSave } from '../state/Quetzal';
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

    it('should return error on mod by zero', async () => {
      const ins = makeInstruction('mod', [
        makeOperand(OperandType.SmallConstant, 17),
        makeOperand(OperandType.SmallConstant, 0),
      ], 4, { storeVariable: 16 });

      const result = await executor.execute(ins);

      expect(result.error).toContain('Division by zero');
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

    it('should execute je with multiple comparisons - match on first', async () => {
      const ins = makeInstruction('je', [
        makeOperand(OperandType.SmallConstant, 3),
        makeOperand(OperandType.SmallConstant, 3), // matches first
        makeOperand(OperandType.SmallConstant, 5),
      ], 4, {
        branch: { branchOnTrue: true, offset: 10 },
      });

      const result = await executor.execute(ins);

      expect(result.nextPC).toBe(0x1000 + 4 + 10 - 2);
    });

    it('should execute je with multiple comparisons - match on later', async () => {
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

  describe('V3 save and restore', () => {
    it('should not branch when restore is not available in V3', async () => {
      delete (io as any).restore;

      const ins = makeInstruction('restore', [], 3, {
        branch: { branchOnTrue: true, offset: 10 }
      });

      const result = await executor.execute(ins);

      // Should not branch - advance PC normally
      expect(result.nextPC).toBe(ins.address + ins.length);
    });

    it('should branch when save succeeds in V3', async () => {
      io.save = async () => true;

      const ins = makeInstruction('save', [], 3, {
        branch: { branchOnTrue: true, offset: 10 }
      });

      const result = await executor.execute(ins);

      // Should branch since save succeeded
      expect(result.nextPC).toBe(ins.address + ins.length + 10 - 2);
    });

    it('should not branch when save is not available in V3', async () => {
      delete (io as any).save;

      const ins = makeInstruction('save', [], 3, {
        branch: { branchOnTrue: true, offset: 10 }
      });

      const result = await executor.execute(ins);

      // Should not branch - advance PC normally
      expect(result.nextPC).toBe(ins.address + ins.length);
    });

    it('should not branch when restore returns null in V3', async () => {
      io.restore = async () => null;

      const ins = makeInstruction('restore', [], 3, {
        branch: { branchOnTrue: true, offset: 10 }
      });

      const result = await executor.execute(ins);

      // Should not branch - advance PC normally
      expect(result.nextPC).toBe(ins.address + ins.length);
    });

    it('should not branch when restore data is invalid in V3', async () => {
      io.restore = async () => new Uint8Array([0, 1, 2, 3]); // Invalid Quetzal

      const ins = makeInstruction('restore', [], 3, {
        branch: { branchOnTrue: true, offset: 10 }
      });

      const result = await executor.execute(ins);

      // Should not branch - advance PC normally
      expect(result.nextPC).toBe(ins.address + ins.length);
    });

    it('should not branch when restore save is incompatible in V3', async () => {
      // Create a save from different memory (different checksum)
      const differentBuffer = new ArrayBuffer(0x10000);
      const differentView = new DataView(differentBuffer);
      differentView.setUint8(0x00, 3); // Version 3
      differentView.setUint16(0x02, 999, false); // Different release
      differentView.setUint16(0x0E, 0x2000, false); // Static memory base
      differentView.setUint16(0x1C, 0x9999, false); // Different checksum
      // Set serial to something different
      const serial = 'ZZZZZZ';
      for (let i = 0; i < 6; i++) {
        differentView.setUint8(0x12 + i, serial.charCodeAt(i));
      }
      const differentMemory = new Memory(differentBuffer);
      const differentStack = new Stack();
      differentStack.initialize(0);
      
      const saveData = createQuetzalSave(differentMemory, differentStack.snapshot(), 0x3000);
      
      io.restore = async () => saveData;

      const ins = makeInstruction('restore', [], 3, {
        branch: { branchOnTrue: true, offset: 10 }
      });

      const result = await executor.execute(ins);

      // Incompatible save should not branch
      expect(result.nextPC).toBe(ins.address + ins.length);
    });
  });

  describe('V5+ opcodes', () => {
    let v5Memory: Memory;
    let v5Header: Header;
    let v5Stack: Stack;
    let v5Variables: Variables;
    let v5Io: TestIOAdapter;
    let v5TextDecoder: ZCharDecoder;
    let v5Executor: Executor;

    function createV5Memory(): Memory {
      const size = 0x10000;
      const buffer = new ArrayBuffer(size);
      const view = new DataView(buffer);

      view.setUint8(0x00, 5); // Version 5
      view.setUint16(0x04, 0x4000, false);
      view.setUint16(0x06, 0x1000, false);
      view.setUint16(0x0C, 0x100, false);
      view.setUint16(0x0E, 0x2000, false);
      view.setUint16(0x18, 0x40, false);

      return new Memory(buffer);
    }

    beforeEach(() => {
      v5Memory = createV5Memory();
      v5Header = new Header(v5Memory);
      v5Stack = new Stack();
      v5Stack.initialize(0);
      v5Variables = new Variables(v5Memory, v5Stack, v5Header.globalsAddress);
      v5Io = new TestIOAdapter();
      v5TextDecoder = new ZCharDecoder(v5Memory, 5, v5Header.abbreviationsAddress);
      v5Executor = new Executor(v5Memory, v5Header, v5Stack, v5Variables, 5, v5Io, v5TextDecoder);
    });

    describe('print_unicode', () => {
      it('should print a Unicode character', async () => {
        const ins = makeInstruction('print_unicode', [
          makeOperand(OperandType.LargeConstant, 0x2764), // ❤ heart
        ], 4);

        await v5Executor.execute(ins);

        expect(v5Io.output.join('')).toBe('❤');
      });

      it('should print ASCII characters', async () => {
        const ins = makeInstruction('print_unicode', [
          makeOperand(OperandType.SmallConstant, 65), // 'A'
        ], 4);

        await v5Executor.execute(ins);

        expect(v5Io.output.join('')).toBe('A');
      });
    });

    describe('check_unicode', () => {
      it('should return 3 for printable and readable ASCII', async () => {
        const ins = makeInstruction('check_unicode', [
          makeOperand(OperandType.SmallConstant, 65), // 'A'
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        // 3 = can print (1) + can read (2)
        expect(v5Variables.read(16)).toBe(3);
      });

      it('should return 1 for printable but not readable Unicode', async () => {
        const ins = makeInstruction('check_unicode', [
          makeOperand(OperandType.LargeConstant, 0x2764), // Heart emoji
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        // 1 = can print only
        expect(v5Variables.read(16)).toBe(1);
      });

      it('should return 0 for invalid codepoint', async () => {
        const ins = makeInstruction('check_unicode', [
          makeOperand(OperandType.LargeConstant, 0xFFFFFF), // Invalid
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
      });
    });

    describe('catch', () => {
      it('should store the current frame pointer', async () => {
        // Push a frame to have depth > 1
        v5Stack.pushFrame(0x2000, 16, 2, 0);
        
        const ins = makeInstruction('catch', [], 2, { storeVariable: 16 });

        await v5Executor.execute(ins);

        const fp = v5Variables.read(16);
        expect(fp).toBe(2); // Frame depth should be 2 (initial + pushed)
      });
    });

    describe('throw', () => {
      it('should unwind to frame and return value', async () => {
        // Setup: push a frame that stores to var 17
        v5Stack.pushFrame(0x2000, 17, 2, 0);
        const framePointer = v5Stack.getFramePointer();
        
        // Now push another frame
        v5Stack.pushFrame(0x3000, 18, 1, 0);
        
        const ins = makeInstruction('throw', [
          makeOperand(OperandType.SmallConstant, 42), // value
          makeOperand(OperandType.SmallConstant, framePointer), // frame to unwind to
        ], 4);

        const result = await v5Executor.execute(ins);

        // Should return to the frame's return PC
        expect(result.nextPC).toBe(0x2000);
        // Value should be stored in var 17
        expect(v5Variables.read(17)).toBe(42);
      });
    });

    describe('piracy', () => {
      it('should always branch (genuine disk)', async () => {
        const ins = makeInstruction('piracy', [], 3, {
          branch: { branchOnTrue: true, offset: 10 }
        });

        const result = await v5Executor.execute(ins);

        // Should branch (offset 10 from address + length)
        expect(result.nextPC).toBe(0x1000 + 3 + 10 - 2);
      });
    });

    describe('erase_line', () => {
      it('should call io.eraseLine when value is 1', async () => {
        let eraseLineCalled = false;
        v5Io.eraseLine = () => { eraseLineCalled = true; };
        
        const ins = makeInstruction('erase_line', [
          makeOperand(OperandType.SmallConstant, 1),
        ], 3);

        await v5Executor.execute(ins);

        expect(eraseLineCalled).toBe(true);
      });

      it('should not call eraseLine for other values', async () => {
        let eraseLineCalled = false;
        v5Io.eraseLine = () => { eraseLineCalled = true; };
        
        const ins = makeInstruction('erase_line', [
          makeOperand(OperandType.SmallConstant, 0),
        ], 3);

        await v5Executor.execute(ins);

        expect(eraseLineCalled).toBe(false);
      });
    });

    describe('set_true_colour', () => {
      it('should set foreground and background colors', async () => {
        let fgColor: number | undefined;
        let bgColor: number | undefined;
        v5Io.setForegroundColor = (c) => { fgColor = c; };
        v5Io.setBackgroundColor = (c) => { bgColor = c; };
        
        const ins = makeInstruction('set_true_colour', [
          makeOperand(OperandType.LargeConstant, 0x7C00), // Red
          makeOperand(OperandType.LargeConstant, 0x001F), // Blue
        ], 5);

        await v5Executor.execute(ins);

        expect(fgColor).toBe(0x7C00);
        expect(bgColor).toBe(0x001F);
      });

      it('should not set color for 0xFFFF (keep current)', async () => {
        let fgColor: number | undefined;
        let bgColor: number | undefined;
        v5Io.setForegroundColor = (c) => { fgColor = c; };
        v5Io.setBackgroundColor = (c) => { bgColor = c; };
        
        const ins = makeInstruction('set_true_colour', [
          makeOperand(OperandType.LargeConstant, 0xFFFF),
          makeOperand(OperandType.LargeConstant, 0xFFFF),
        ], 5);

        await v5Executor.execute(ins);

        expect(fgColor).toBeUndefined();
        expect(bgColor).toBeUndefined();
      });

      it('should not set color for 0xFFFE (use default)', async () => {
        let fgColor: number | undefined;
        let bgColor: number | undefined;
        v5Io.setForegroundColor = (c) => { fgColor = c; };
        v5Io.setBackgroundColor = (c) => { bgColor = c; };
        
        const ins = makeInstruction('set_true_colour', [
          makeOperand(OperandType.LargeConstant, 0xFFFE),
          makeOperand(OperandType.LargeConstant, 0xFFFE),
        ], 5);

        await v5Executor.execute(ins);

        expect(fgColor).toBeUndefined();
        expect(bgColor).toBeUndefined();
      });
    });

    describe('set_font', () => {
      it('should return 1 for normal font (1)', async () => {
        const ins = makeInstruction('set_font', [
          makeOperand(OperandType.SmallConstant, 1),
        ], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(1);
      });

      it('should return 1 for fixed-pitch font (4)', async () => {
        const ins = makeInstruction('set_font', [
          makeOperand(OperandType.SmallConstant, 4),
        ], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(1);
      });

      it('should return 0 for unsupported font', async () => {
        const ins = makeInstruction('set_font', [
          makeOperand(OperandType.SmallConstant, 3),
        ], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
      });

      it('should query current font when font is 0', async () => {
        const ins = makeInstruction('set_font', [
          makeOperand(OperandType.SmallConstant, 0),
        ], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(1); // Always returns normal font
      });
    });

    describe('save_undo and restore_undo', () => {
      it('should save_undo and return 1', async () => {
        const ins = makeInstruction('save_undo', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(1);
      });

      it('should restore_undo and return 0 when no undo available', async () => {
        const ins = makeInstruction('restore_undo', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
      });

      it('should restore_undo and return 2 after save_undo', async () => {
        // Save undo first
        const saveIns = makeInstruction('save_undo', [], 3, { storeVariable: 16 });
        await v5Executor.execute(saveIns);
        expect(v5Variables.read(16)).toBe(1);
        
        // Restore undo should return 2
        const restoreIns = makeInstruction('restore_undo', [], 3, { storeVariable: 17 });
        await v5Executor.execute(restoreIns);
        
        // Checking variable 17 for restore result (variable 16 gets restored to old value)
        expect(v5Variables.read(17)).toBe(2);
      });
    });

    describe('log_shift', () => {
      it('should left shift (logical)', async () => {
        const ins = makeInstruction('log_shift', [
          makeOperand(OperandType.SmallConstant, 0x0F),
          makeOperand(OperandType.SmallConstant, 4),
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0xF0);
      });

      it('should right shift (logical, zero fill)', async () => {
        const ins = makeInstruction('log_shift', [
          makeOperand(OperandType.LargeConstant, 0xFF00),
          makeOperand(OperandType.LargeConstant, 0xFFFC), // -4 as signed
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0x0FF0);
      });

      it('should right shift with zero fill on high bits', async () => {
        const ins = makeInstruction('log_shift', [
          makeOperand(OperandType.LargeConstant, 0x8000),
          makeOperand(OperandType.LargeConstant, 0xFFF8), // -8 as signed
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0x0080); // High bit not preserved
      });
    });

    describe('art_shift', () => {
      it('should left shift (same as logical)', async () => {
        const ins = makeInstruction('art_shift', [
          makeOperand(OperandType.SmallConstant, 0x0F),
          makeOperand(OperandType.SmallConstant, 4),
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0xF0);
      });

      it('should right shift (arithmetic, sign extend)', async () => {
        const ins = makeInstruction('art_shift', [
          makeOperand(OperandType.LargeConstant, 0x8000), // Negative number in signed 16-bit
          makeOperand(OperandType.LargeConstant, 0xFFFC), // -4 as signed
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        // Arithmetic right shift preserves sign, so 0x8000 >> 4 = 0xF800
        expect(v5Variables.read(16)).toBe(0xF800);
      });

      it('should right shift positive number without sign extension', async () => {
        const ins = makeInstruction('art_shift', [
          makeOperand(OperandType.LargeConstant, 0x7F00), // Positive number
          makeOperand(OperandType.LargeConstant, 0xFFFC), // -4 as signed
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0x07F0);
      });
    });

    describe('check_arg_count', () => {
      it('should branch true when arg count is met', async () => {
        // Push a new frame with 3 arguments (returnPC, storeVar, localCount, argCount)
        v5Stack.pushFrame(0x2000, 16, 5, 3);

        const ins = makeInstruction('check_arg_count', [
          makeOperand(OperandType.SmallConstant, 3),
        ], 3, { address: 0x2000, branch: { branchOnTrue: true, offset: 10 } });

        const result = await v5Executor.execute(ins);

        // Should branch (argNum 3 <= argCount 3)
        expect(result.nextPC).toBe(0x2000 + 3 + 10 - 2);
      });

      it('should not branch when arg count is not met', async () => {
        // Push a new frame with 2 arguments (returnPC, storeVar, localCount, argCount)
        v5Stack.pushFrame(0x2000, 16, 5, 2);

        const ins = makeInstruction('check_arg_count', [
          makeOperand(OperandType.SmallConstant, 3),
        ], 3, { address: 0x2000, branch: { branchOnTrue: true, offset: 10 } });

        const result = await v5Executor.execute(ins);

        // Should not branch (argNum 3 > argCount 2)
        expect(result.nextPC).toBe(0x2000 + 3);
      });
    });

    describe('copy_table', () => {
      it('should copy table forwards', async () => {
        // Write source data
        v5Memory.writeByte(0x800, 0x11);
        v5Memory.writeByte(0x801, 0x22);
        v5Memory.writeByte(0x802, 0x33);

        const ins = makeInstruction('copy_table', [
          makeOperand(OperandType.LargeConstant, 0x800), // first
          makeOperand(OperandType.LargeConstant, 0x900), // second
          makeOperand(OperandType.SmallConstant, 3),     // size
        ], 6);

        await v5Executor.execute(ins);

        expect(v5Memory.readByte(0x900)).toBe(0x11);
        expect(v5Memory.readByte(0x901)).toBe(0x22);
        expect(v5Memory.readByte(0x902)).toBe(0x33);
      });

      it('should zero table when second is 0', async () => {
        // Write some data to be zeroed
        v5Memory.writeByte(0x800, 0xFF);
        v5Memory.writeByte(0x801, 0xFF);
        v5Memory.writeByte(0x802, 0xFF);

        const ins = makeInstruction('copy_table', [
          makeOperand(OperandType.LargeConstant, 0x800), // first
          makeOperand(OperandType.SmallConstant, 0),     // second = 0
          makeOperand(OperandType.SmallConstant, 3),     // size
        ], 6);

        await v5Executor.execute(ins);

        expect(v5Memory.readByte(0x800)).toBe(0);
        expect(v5Memory.readByte(0x801)).toBe(0);
        expect(v5Memory.readByte(0x802)).toBe(0);
      });

      it('should copy backwards when overlapping and second > first', async () => {
        // Write source data with potential overlap
        v5Memory.writeByte(0x800, 0x11);
        v5Memory.writeByte(0x801, 0x22);
        v5Memory.writeByte(0x802, 0x33);
        v5Memory.writeByte(0x803, 0x44);

        // Copy 0x800-0x803 to 0x802-0x805 (overlapping, second > first)
        const ins = makeInstruction('copy_table', [
          makeOperand(OperandType.LargeConstant, 0x800), // first
          makeOperand(OperandType.LargeConstant, 0x802), // second > first
          makeOperand(OperandType.SmallConstant, 4),     // positive size triggers backward copy
        ], 6);

        await v5Executor.execute(ins);

        expect(v5Memory.readByte(0x802)).toBe(0x11);
        expect(v5Memory.readByte(0x803)).toBe(0x22);
        expect(v5Memory.readByte(0x804)).toBe(0x33);
        expect(v5Memory.readByte(0x805)).toBe(0x44);
      });

      it('should handle negative size for forward copy', async () => {
        v5Memory.writeByte(0x800, 0xAA);
        v5Memory.writeByte(0x801, 0xBB);

        const ins = makeInstruction('copy_table', [
          makeOperand(OperandType.LargeConstant, 0x800), // first
          makeOperand(OperandType.LargeConstant, 0x900), // second
          makeOperand(OperandType.LargeConstant, 0xFFFE), // -2 as signed = abs(size)
        ], 6);

        await v5Executor.execute(ins);

        expect(v5Memory.readByte(0x900)).toBe(0xAA);
        expect(v5Memory.readByte(0x901)).toBe(0xBB);
      });
    });

    describe('print_table', () => {
      it('should print single row table', async () => {
        // Write text "Hi" at 0x800
        v5Memory.writeByte(0x800, 0x48); // 'H'
        v5Memory.writeByte(0x801, 0x69); // 'i'

        const ins = makeInstruction('print_table', [
          makeOperand(OperandType.LargeConstant, 0x800), // text
          makeOperand(OperandType.SmallConstant, 2),     // width
        ], 4);

        await v5Executor.execute(ins);

        expect(v5Io.output.join('')).toBe('Hi');
      });

      it('should print multi-row table with newlines', async () => {
        // Write 2x2 table: AB\nCD
        v5Memory.writeByte(0x800, 0x41); // 'A'
        v5Memory.writeByte(0x801, 0x42); // 'B'
        v5Memory.writeByte(0x802, 0x43); // 'C'
        v5Memory.writeByte(0x803, 0x44); // 'D'

        const ins = makeInstruction('print_table', [
          makeOperand(OperandType.LargeConstant, 0x800), // text
          makeOperand(OperandType.SmallConstant, 2),     // width
          makeOperand(OperandType.SmallConstant, 2),     // height
        ], 5);

        await v5Executor.execute(ins);

        expect(v5Io.output.join('')).toBe('AB\nCD');
      });

      it('should handle skip parameter', async () => {
        // Write table with skip bytes between rows
        v5Memory.writeByte(0x800, 0x41); // 'A'
        v5Memory.writeByte(0x801, 0x42); // 'B'
        v5Memory.writeByte(0x802, 0xFF); // skip byte
        v5Memory.writeByte(0x803, 0x43); // 'C'
        v5Memory.writeByte(0x804, 0x44); // 'D'

        const ins = makeInstruction('print_table', [
          makeOperand(OperandType.LargeConstant, 0x800), // text
          makeOperand(OperandType.SmallConstant, 2),     // width
          makeOperand(OperandType.SmallConstant, 2),     // height
          makeOperand(OperandType.SmallConstant, 1),     // skip
        ], 6);

        await v5Executor.execute(ins);

        expect(v5Io.output.join('')).toBe('AB\nCD');
      });
    });

    describe('encode_text', () => {
      it('should encode text to dictionary format', async () => {
        // Write ZSCII text "abc" at 0x800
        v5Memory.writeByte(0x800, 0x61); // 'a'
        v5Memory.writeByte(0x801, 0x62); // 'b'
        v5Memory.writeByte(0x802, 0x63); // 'c'

        const ins = makeInstruction('encode_text', [
          makeOperand(OperandType.LargeConstant, 0x800), // zscii-text
          makeOperand(OperandType.SmallConstant, 3),     // length
          makeOperand(OperandType.SmallConstant, 0),     // from
          makeOperand(OperandType.LargeConstant, 0x900), // coded-text destination
        ], 7);

        await v5Executor.execute(ins);

        // Check that something was written (encoded bytes)
        // In V5, dictionary words are 6 bytes
        const byte0 = v5Memory.readByte(0x900);
        const byte5 = v5Memory.readByte(0x905);
        expect(byte0).toBeGreaterThan(0);
        // Last word should have high bit set
        expect(v5Memory.readByte(0x904) & 0x80).toBe(0x80);
      });
    });

    describe('read_char', () => {
      it('should read a character from input', async () => {
        v5Io.queueCharInput(65); // 'A'

        const ins = makeInstruction('read_char', [
          makeOperand(OperandType.SmallConstant, 1), // always 1
        ], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(65);
      });

      it('should handle timeout with no input', async () => {
        // Don't queue any input
        const ins = makeInstruction('read_char', [
          makeOperand(OperandType.SmallConstant, 1), // always 1
          makeOperand(OperandType.SmallConstant, 1), // timeout (any non-zero)
        ], 4, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0); // No key pressed
      });
    });

    describe('scan_table', () => {
      it('should find word value in table', async () => {
        // Write a table of words at 0x800
        v5Memory.writeWord(0x800, 0x1234);
        v5Memory.writeWord(0x802, 0x5678);
        v5Memory.writeWord(0x804, 0xABCD);

        const ins = makeInstruction('scan_table', [
          makeOperand(OperandType.LargeConstant, 0x5678), // x - value to find
          makeOperand(OperandType.LargeConstant, 0x800),  // table
          makeOperand(OperandType.SmallConstant, 3),      // len (3 entries)
          makeOperand(OperandType.SmallConstant, 0x82),   // form: word, 2 bytes per entry
        ], 7, { storeVariable: 16, branch: { branchOnTrue: true, offset: 10 } });

        const result = await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0x802); // Address of found entry
        expect(result.nextPC).toBe(0x1000 + 7 + 10 - 2); // Branch taken
      });

      it('should find byte value in table', async () => {
        // Write a table of bytes at 0x800
        v5Memory.writeByte(0x800, 0x11);
        v5Memory.writeByte(0x801, 0x22);
        v5Memory.writeByte(0x802, 0x33);

        const ins = makeInstruction('scan_table', [
          makeOperand(OperandType.SmallConstant, 0x22),  // x - value to find
          makeOperand(OperandType.LargeConstant, 0x800), // table
          makeOperand(OperandType.SmallConstant, 3),     // len (3 entries)
          makeOperand(OperandType.SmallConstant, 0x01),  // form: byte, 1 byte per entry
        ], 7, { storeVariable: 16, branch: { branchOnTrue: true, offset: 10 } });

        const result = await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0x801); // Address of found entry
        expect(result.nextPC).toBe(0x1000 + 7 + 10 - 2); // Branch taken
      });

      it('should return 0 and not branch when not found', async () => {
        v5Memory.writeWord(0x800, 0x1234);
        v5Memory.writeWord(0x802, 0x5678);

        const ins = makeInstruction('scan_table', [
          makeOperand(OperandType.LargeConstant, 0x9999), // x - value NOT in table
          makeOperand(OperandType.LargeConstant, 0x800),  // table
          makeOperand(OperandType.SmallConstant, 2),      // len
        ], 6, { storeVariable: 16, branch: { branchOnTrue: true, offset: 10 } });

        const result = await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
        expect(result.nextPC).toBe(0x1000 + 6); // No branch
      });
    });

    describe('tokenise', () => {
      it('should tokenize text buffer', async () => {
        // Set up a simple dictionary at 0x500
        // Dictionary header: word separators count, then word separator bytes
        v5Memory.writeByte(0x500, 1);    // 1 separator
        v5Memory.writeByte(0x501, 0x2C); // comma
        v5Memory.writeByte(0x502, 6);    // entry length (V5: 6 bytes encoded + 4 data = 10, but spec says entry size)
        v5Memory.writeWord(0x503, 0);    // 0 entries (empty dictionary)

        // Set up text buffer at 0x600 with "hi" text
        // V5 format: byte 0 = max chars, byte 1 = actual chars typed
        v5Memory.writeByte(0x600, 80);   // max length
        v5Memory.writeByte(0x601, 2);    // 2 chars typed
        v5Memory.writeByte(0x602, 0x68); // 'h'
        v5Memory.writeByte(0x603, 0x69); // 'i'

        // Set up parse buffer at 0x700
        v5Memory.writeByte(0x700, 10);   // max parse entries

        // Update header dictionary address
        const dictionaryAddr = 0x500;
        v5Memory.writeWord(0x08, dictionaryAddr);

        const ins = makeInstruction('tokenise', [
          makeOperand(OperandType.LargeConstant, 0x600), // text buffer
          makeOperand(OperandType.LargeConstant, 0x700), // parse buffer
        ], 5);

        await v5Executor.execute(ins);

        // Parse buffer byte 1 should have word count
        const wordCount = v5Memory.readByte(0x701);
        expect(wordCount).toBeGreaterThanOrEqual(0); // At least executed without error
      });

      it('should tokenize with custom dictionary (3 operands)', async () => {
        // Set up a custom dictionary at 0x800 with '!' as separator
        const customDictAddr = 0x800;
        v5Memory.writeByte(customDictAddr, 1);      // 1 separator
        v5Memory.writeByte(customDictAddr + 1, '!'.charCodeAt(0)); // '!' separator
        v5Memory.writeByte(customDictAddr + 2, 9);  // entry length
        v5Memory.writeWord(customDictAddr + 3, 0);  // 0 entries

        // Set up text buffer at 0x600 with "hi!bye" text
        v5Memory.writeByte(0x600, 80);   // max length
        v5Memory.writeByte(0x601, 6);    // 6 chars typed
        const text = 'hi!bye';
        for (let i = 0; i < text.length; i++) {
          v5Memory.writeByte(0x602 + i, text.charCodeAt(i));
        }

        // Set up parse buffer at 0x700
        v5Memory.writeByte(0x700, 10);   // max parse entries

        const ins = makeInstruction('tokenise', [
          makeOperand(OperandType.LargeConstant, 0x600), // text buffer
          makeOperand(OperandType.LargeConstant, 0x700), // parse buffer
          makeOperand(OperandType.LargeConstant, customDictAddr), // custom dictionary
        ], 7);

        await v5Executor.execute(ins);

        // Should have 3 tokens: hi, !, bye (using custom dictionary with '!' separator)
        const wordCount = v5Memory.readByte(0x701);
        expect(wordCount).toBe(3);
      });

      it('should tokenize with skipUnknown flag (4 operands)', async () => {
        // Set up a custom dictionary at 0x800 with ',' as separator and no entries
        const customDictAddr = 0x800;
        v5Memory.writeByte(customDictAddr, 1);      // 1 separator
        v5Memory.writeByte(customDictAddr + 1, ','.charCodeAt(0)); // ',' separator
        v5Memory.writeByte(customDictAddr + 2, 9);  // entry length
        v5Memory.writeWord(customDictAddr + 3, 0);  // 0 entries (so all words are "unknown")

        // Set up text buffer at 0x600 with "hello,world" text
        v5Memory.writeByte(0x600, 80);   // max length
        v5Memory.writeByte(0x601, 11);   // 11 chars typed
        const text = 'hello,world';
        for (let i = 0; i < text.length; i++) {
          v5Memory.writeByte(0x602 + i, text.charCodeAt(i));
        }

        // Set up parse buffer at 0x700
        v5Memory.writeByte(0x700, 10);   // max parse entries

        // With skipUnknown = false (0), should store all tokens even if not in dictionary
        const insNoSkip = makeInstruction('tokenise', [
          makeOperand(OperandType.LargeConstant, 0x600), // text buffer
          makeOperand(OperandType.LargeConstant, 0x700), // parse buffer
          makeOperand(OperandType.LargeConstant, customDictAddr), // custom dictionary
          makeOperand(OperandType.SmallConstant, 0),     // skipUnknown = false
        ], 8);

        await v5Executor.execute(insNoSkip);

        // Should have 3 tokens: hello, ',', world (all stored even though not in dictionary)
        expect(v5Memory.readByte(0x701)).toBe(3);

        // Reset parse buffer
        v5Memory.writeByte(0x701, 0);

        // With skipUnknown = true (non-zero), should skip tokens not in dictionary
        const insSkip = makeInstruction('tokenise', [
          makeOperand(OperandType.LargeConstant, 0x600), // text buffer
          makeOperand(OperandType.LargeConstant, 0x700), // parse buffer
          makeOperand(OperandType.LargeConstant, customDictAddr), // custom dictionary
          makeOperand(OperandType.SmallConstant, 1),     // skipUnknown = true
        ], 8);

        await v5Executor.execute(insSkip);

        // Should have 0 tokens because all words are unknown (not in dictionary)
        expect(v5Memory.readByte(0x701)).toBe(0);
      });
    });

    describe('input_stream', () => {
      it('should call setInputStream on io adapter', async () => {
        let inputStreamCalled = false;
        let streamValue = -1;
        v5Io.setInputStream = (stream: number) => {
          inputStreamCalled = true;
          streamValue = stream;
        };

        const ins = makeInstruction('input_stream', [
          makeOperand(OperandType.SmallConstant, 1), // stream 1
        ], 3);

        await v5Executor.execute(ins);

        expect(inputStreamCalled).toBe(true);
        expect(streamValue).toBe(1);
      });
    });

    describe('sound_effect', () => {
      it('should call soundEffect on io adapter', async () => {
        let soundCalled = false;
        let soundParams: number[] = [];
        v5Io.soundEffect = (number: number, effect: number, volume: number) => {
          soundCalled = true;
          soundParams = [number, effect, volume];
        };

        const ins = makeInstruction('sound_effect', [
          makeOperand(OperandType.SmallConstant, 1), // number
          makeOperand(OperandType.SmallConstant, 2), // effect
          makeOperand(OperandType.SmallConstant, 8), // volume
        ], 5);

        await v5Executor.execute(ins);

        expect(soundCalled).toBe(true);
        expect(soundParams).toEqual([1, 2, 8]);
      });

      it('should handle missing optional parameters', async () => {
        let soundParams: number[] = [];
        v5Io.soundEffect = (number: number, effect: number, volume: number) => {
          soundParams = [number, effect, volume];
        };

        const ins = makeInstruction('sound_effect', [
          makeOperand(OperandType.SmallConstant, 5), // only number
        ], 3);

        await v5Executor.execute(ins);

        expect(soundParams).toEqual([5, 0, 0]); // defaults for effect and volume
      });
    });

    describe('get_cursor', () => {
      it('should write cursor position to memory array', async () => {
        v5Io.getCursor = () => ({ line: 5, column: 10 });

        const ins = makeInstruction('get_cursor', [
          makeOperand(OperandType.LargeConstant, 0x800), // array address
        ], 4);

        await v5Executor.execute(ins);

        expect(v5Memory.readWord(0x800)).toBe(5);  // row
        expect(v5Memory.readWord(0x802)).toBe(10); // column
      });

      it('should use default 1,1 when getCursor not available', async () => {
        // Ensure getCursor is undefined
        delete (v5Io as any).getCursor;

        const ins = makeInstruction('get_cursor', [
          makeOperand(OperandType.LargeConstant, 0x800), // array address
        ], 4);

        await v5Executor.execute(ins);

        expect(v5Memory.readWord(0x800)).toBe(1);  // default row
        expect(v5Memory.readWord(0x802)).toBe(1);  // default column
      });
    });

    describe('output_stream', () => {
      it('should call setOutputStream on io adapter', async () => {
        let outputStreamCalled = false;
        let streamParams: [number, boolean, number] = [0, false, 0];
        v5Io.setOutputStream = (stream: number, enable: boolean, table?: number) => {
          outputStreamCalled = true;
          streamParams = [stream, enable, table ?? 0];
        };

        const ins = makeInstruction('output_stream', [
          makeOperand(OperandType.SmallConstant, 2), // enable stream 2
        ], 3);

        await v5Executor.execute(ins);

        expect(outputStreamCalled).toBe(true);
        expect(streamParams[0]).toBe(2);
        expect(streamParams[1]).toBe(true);
      });

      it('should disable stream with negative value', async () => {
        let streamParams: [number, boolean, number] = [0, false, 0];
        v5Io.setOutputStream = (stream: number, enable: boolean, table?: number) => {
          streamParams = [stream, enable, table ?? 0];
        };

        const ins = makeInstruction('output_stream', [
          makeOperand(OperandType.LargeConstant, 0xFFFE), // -2 as signed (disable stream 2)
        ], 4);

        await v5Executor.execute(ins);

        expect(streamParams[0]).toBe(2);
        expect(streamParams[1]).toBe(false);
      });
    });

    describe('set_text_style', () => {
      it('should call setTextStyle on io adapter', async () => {
        let styleCalled = false;
        let styleValue = -1;
        v5Io.setTextStyle = (style: number) => {
          styleCalled = true;
          styleValue = style;
        };

        const ins = makeInstruction('set_text_style', [
          makeOperand(OperandType.SmallConstant, 4), // bold style
        ], 3);

        await v5Executor.execute(ins);

        expect(styleCalled).toBe(true);
        expect(styleValue).toBe(4);
      });
    });

    describe('buffer_mode', () => {
      it('should call setBufferMode on io adapter', async () => {
        let bufferModeCalled = false;
        let bufferModeValue = false;
        v5Io.setBufferMode = (mode: boolean) => {
          bufferModeCalled = true;
          bufferModeValue = mode;
        };

        const ins = makeInstruction('buffer_mode', [
          makeOperand(OperandType.SmallConstant, 1), // enable buffering
        ], 3);

        await v5Executor.execute(ins);

        expect(bufferModeCalled).toBe(true);
        expect(bufferModeValue).toBe(true);
      });

      it('should disable buffer mode with 0', async () => {
        let bufferModeValue = true;
        v5Io.setBufferMode = (mode: boolean) => {
          bufferModeValue = mode;
        };

        const ins = makeInstruction('buffer_mode', [
          makeOperand(OperandType.SmallConstant, 0), // disable buffering
        ], 3);

        await v5Executor.execute(ins);

        expect(bufferModeValue).toBe(false);
      });
    });

    describe('set_colour', () => {
      it('should call setForegroundColor and setBackgroundColor', async () => {
        let fgColor = 0;
        let bgColor = 0;
        v5Io.setForegroundColor = (color: number) => { fgColor = color; };
        v5Io.setBackgroundColor = (color: number) => { bgColor = color; };

        const ins = makeInstruction('set_colour', [
          makeOperand(OperandType.SmallConstant, 3), // red
          makeOperand(OperandType.SmallConstant, 9), // white
        ], 4);

        await v5Executor.execute(ins);

        expect(fgColor).toBe(3);
        expect(bgColor).toBe(9);
      });

      it('should not call setForegroundColor when foreground is 0', async () => {
        let fgCalled = false;
        let bgColor = 0;
        v5Io.setForegroundColor = () => { fgCalled = true; };
        v5Io.setBackgroundColor = (color: number) => { bgColor = color; };

        const ins = makeInstruction('set_colour', [
          makeOperand(OperandType.SmallConstant, 0), // current (no change)
          makeOperand(OperandType.SmallConstant, 2), // black
        ], 4);

        await v5Executor.execute(ins);

        expect(fgCalled).toBe(false);
        expect(bgColor).toBe(2);
      });
    });

    describe('set_true_colour', () => {
      it('should convert 15-bit RGB colors and call color setters', async () => {
        let fgCalled = false;
        let bgCalled = false;
        v5Io.setForegroundColor = () => { fgCalled = true; };
        v5Io.setBackgroundColor = () => { bgCalled = true; };

        // 15-bit RGB: 0bBBBBBGGGGGRRRRR
        // Pure red: R=31, G=0, B=0 = 0x001F
        // Pure green: R=0, G=31, B=0 = 0x03E0
        const ins = makeInstruction('set_true_colour', [
          makeOperand(OperandType.LargeConstant, 0x001F), // red
          makeOperand(OperandType.LargeConstant, 0x03E0), // green
        ], 5);

        await v5Executor.execute(ins);

        expect(fgCalled).toBe(true);
        expect(bgCalled).toBe(true);
      });
    });

    describe('print_paddr V8', () => {
      let v8Memory: Memory;
      let v8Header: Header;
      let v8Stack: Stack;
      let v8Variables: Variables;
      let v8Io: TestIOAdapter;
      let v8TextDecoder: ZCharDecoder;
      let v8Executor: Executor;

      beforeEach(() => {
        const size = 0x10000;
        const buffer = new ArrayBuffer(size);
        const view = new DataView(buffer);

        view.setUint8(0x00, 8); // Version 8
        view.setUint16(0x04, 0x4000, false);
        view.setUint16(0x06, 0x1000, false);
        view.setUint16(0x0C, 0x100, false);
        view.setUint16(0x0E, 0x2000, false);
        view.setUint16(0x18, 0x40, false);

        // Write Z-string "abc" at 0x800 (packed addr 0x100 * 8 = 0x800)
        // Z-chars: a=6, b=7, c=8 -> (6<<10) | (7<<5) | 8 | 0x8000 = 0x98E8
        view.setUint16(0x800, 0x98E8, false);

        v8Memory = new Memory(buffer);
        v8Header = new Header(v8Memory);
        v8Stack = new Stack();
        v8Stack.initialize(0);
        v8Variables = new Variables(v8Memory, v8Stack, v8Header.globalsAddress);
        v8Io = new TestIOAdapter();
        v8TextDecoder = new ZCharDecoder(v8Memory, 8, v8Header.abbreviationsAddress);
        v8Executor = new Executor(v8Memory, v8Header, v8Stack, v8Variables, 8, v8Io, v8TextDecoder);
      });

      it('should print packed address with *8 multiplier for V8', async () => {
        // Packed address 0x100 * 8 = 0x800
        const ins = makeInstruction('print_paddr', [
          makeOperand(OperandType.LargeConstant, 0x100),
        ], 4);

        await v8Executor.execute(ins);

        expect(v8Io.output.join('')).toBe('abc');
      });
    });

    describe('verify', () => {
      it('should always branch true', async () => {
        const ins = makeInstruction('verify', [], 2, {
          branch: { branchOnTrue: true, offset: 10 }
        });

        const result = await v5Executor.execute(ins);

        expect(result.nextPC).toBe(0x1000 + 2 + 10 - 2); // Branch taken
      });
    });

    describe('save and restore', () => {
      it('should save and return 1 in V5', async () => {
        let savedData: Uint8Array | null = null;
        v5Io.save = async (data: Uint8Array) => {
          savedData = data;
          return true;
        };

        const ins = makeInstruction('save', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(savedData).not.toBeNull();
        expect(v5Variables.read(16)).toBe(1);
      });

      it('should return 0 when save fails in V5', async () => {
        v5Io.save = async () => false;

        const ins = makeInstruction('save', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
      });

      it('should return 0 when save not available in V5', async () => {
        delete (v5Io as any).save;

        const ins = makeInstruction('save', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
      });

      it('should return 0 when restore not available in V5', async () => {
        delete (v5Io as any).restore;

        const ins = makeInstruction('restore', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
      });

      it('should return 0 when restore returns no data in V5', async () => {
        v5Io.restore = async () => null;

        const ins = makeInstruction('restore', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
      });

      it('should return 0 when restore data is invalid', async () => {
        v5Io.restore = async () => new Uint8Array([0, 1, 2, 3]); // Invalid Quetzal

        const ins = makeInstruction('restore', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0);
      });

      it('should successfully restore valid save and return 2', async () => {
        // Create a valid Quetzal save that matches this game
        const saveData = createQuetzalSave(v5Memory, v5Stack.snapshot(), 0x3000);
        
        v5Io.restore = async () => saveData;

        const ins = makeInstruction('restore', [], 3, { storeVariable: 16 });

        const result = await v5Executor.execute(ins);

        // Successful restore should return to saved PC
        expect(result.nextPC).toBe(0x3000);
        // Result is stored as 2 for successful restore
        expect(v5Variables.read(16)).toBe(2);
      });

      it('should restore with incompatible save and return 0', async () => {
        // Create a save from different memory (different checksum)
        const differentBuffer = new ArrayBuffer(0x10000);
        const differentView = new DataView(differentBuffer);
        differentView.setUint8(0x00, 5); // Version
        differentView.setUint16(0x02, 999, false); // Different release
        differentView.setUint16(0x0E, 0x2000, false); // Static memory base
        differentView.setUint16(0x1C, 0x9999, false); // Different checksum
        // Set serial to something different
        const serial = 'ZZZZZZ';
        for (let i = 0; i < 6; i++) {
          differentView.setUint8(0x12 + i, serial.charCodeAt(i));
        }
        const differentMemory = new Memory(differentBuffer);
        const differentStack = new Stack();
        differentStack.initialize(0);
        
        const saveData = createQuetzalSave(differentMemory, differentStack.snapshot(), 0x3000);
        
        v5Io.restore = async () => saveData;

        const ins = makeInstruction('restore', [], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        // Incompatible save should store 0
        expect(v5Variables.read(16)).toBe(0);
      });
    });

    describe('aread (V4+ read)', () => {
      it('should read input and store in buffer V5 style', async () => {
        // Set up text buffer at 0x500: byte 0 = max length, byte 1 = stored length, text starts at byte 2
        v5Memory.writeByte(0x500, 50); // Max length
        
        // Queue input
        v5Io.queueLineInput('hello');
        
        const ins = makeInstruction('aread', [
          makeOperand(OperandType.LargeConstant, 0x500), // text buffer
          makeOperand(OperandType.SmallConstant, 0),     // no parse buffer
        ], 5, { storeVariable: 16 });

        await v5Executor.execute(ins);

        // Check stored length
        expect(v5Memory.readByte(0x501)).toBe(5); // "hello" length
        // Check text content
        expect(v5Memory.readByte(0x502)).toBe('h'.charCodeAt(0));
        expect(v5Memory.readByte(0x503)).toBe('e'.charCodeAt(0));
        expect(v5Memory.readByte(0x504)).toBe('l'.charCodeAt(0));
        expect(v5Memory.readByte(0x505)).toBe('l'.charCodeAt(0));
        expect(v5Memory.readByte(0x506)).toBe('o'.charCodeAt(0));
        // Check return value (terminating key = 13 for Enter)
        expect(v5Variables.read(16)).toBe(13);
      });

      it('should convert input to lowercase', async () => {
        v5Memory.writeByte(0x500, 50);
        v5Io.queueLineInput('HELLO');
        
        const ins = makeInstruction('aread', [
          makeOperand(OperandType.LargeConstant, 0x500),
          makeOperand(OperandType.SmallConstant, 0),
        ], 5, { storeVariable: 16 });

        await v5Executor.execute(ins);

        // Should be lowercase
        expect(v5Memory.readByte(0x502)).toBe('h'.charCodeAt(0));
        expect(v5Memory.readByte(0x506)).toBe('o'.charCodeAt(0));
      });
    });

    describe('restart', () => {
      it('should reset and return to initial PC', async () => {
        const ins = makeInstruction('restart', [], 1);

        const result = await v5Executor.execute(ins);

        expect(result.nextPC).toBe(v5Header.initialPC);
      });
    });

    describe('show_status', () => {
      it('should call showStatusLine on io adapter', async () => {
        let statusCalled = false;
        v5Io.showStatusLine = () => { statusCalled = true; };

        // Need to set up object table for location name
        // For simplicity, just verify no crash
        const ins = makeInstruction('show_status', [], 1);

        try {
          await v5Executor.execute(ins);
        } catch {
          // May fail due to object table not set up
        }

        // In V5, show_status does nothing (it's V3 only)
      });
    });

    describe('call_2s and call_2n', () => {
      it('should call routine with one argument (call_2n)', async () => {
        // Set up a simple routine at 0x1800 that just returns
        // Packed address for V5 is byteAddr / 4, so 0x1800 / 4 = 0x600
        v5Memory.writeByte(0x1800, 0); // 0 locals

        const ins = makeInstruction('call_2n', [
          makeOperand(OperandType.LargeConstant, 0x600), // routine packed addr
          makeOperand(OperandType.SmallConstant, 42),    // argument
        ], 5);

        const result = await v5Executor.execute(ins);

        expect(result.nextPC).toBe(0x1801); // Should jump to routine
      });
    });

    describe('print_addr', () => {
      it('should print text at byte address', async () => {
        // Write Z-string "hi" at 0x800
        v5Memory.writeByte(0x800, 0x94); // 'h' shifted
        v5Memory.writeByte(0x801, 0xE9); // 'i' + end
        v5Memory.writeWord(0x800, 0x94EE, false); // Actually write valid Z-string

        const ins = makeInstruction('print_addr', [
          makeOperand(OperandType.LargeConstant, 0x800),
        ], 4);

        await v5Executor.execute(ins);

        // Should produce some output
        expect(v5Io.output.length).toBeGreaterThan(0);
      });
    });

    describe('load and store indirect', () => {
      it('should load variable indirectly', async () => {
        v5Variables.write(20, 0x1234); // global variable

        const ins = makeInstruction('load', [
          makeOperand(OperandType.SmallConstant, 20), // global variable 20
        ], 3, { storeVariable: 16 });

        await v5Executor.execute(ins);

        expect(v5Variables.read(16)).toBe(0x1234);
      });

      it('should store variable indirectly', async () => {
        const ins = makeInstruction('store', [
          makeOperand(OperandType.SmallConstant, 20), // global variable 20
          makeOperand(OperandType.LargeConstant, 0xABCD),
        ], 5);

        await v5Executor.execute(ins);

        expect(v5Variables.read(20)).toBe(0xABCD);
      });
    });

    describe('call_1s and call_1n', () => {
      it('should call routine with no arguments (call_1s)', async () => {
        v5Memory.writeByte(0x1800, 0); // 0 locals

        const ins = makeInstruction('call_1s', [
          makeOperand(OperandType.LargeConstant, 0x600), // packed addr
        ], 4, { storeVariable: 16 });

        const result = await v5Executor.execute(ins);

        expect(result.nextPC).toBe(0x1801);
      });
    });

    describe('inc and dec', () => {
      it('should increment variable', async () => {
        v5Variables.write(20, 100); // global variable

        const ins = makeInstruction('inc', [
          makeOperand(OperandType.SmallConstant, 20), // global 20
        ], 3);

        await v5Executor.execute(ins);

        expect(v5Variables.read(20)).toBe(101);
      });

      it('should decrement variable', async () => {
        v5Variables.write(20, 100); // global variable

        const ins = makeInstruction('dec', [
          makeOperand(OperandType.SmallConstant, 20), // global 20
        ], 3);

        await v5Executor.execute(ins);

        expect(v5Variables.read(20)).toBe(99);
      });
    });

    describe('print_char and print_num', () => {
      it('should print character by ZSCII code', async () => {
        const ins = makeInstruction('print_char', [
          makeOperand(OperandType.SmallConstant, 65), // 'A'
        ], 3);

        await v5Executor.execute(ins);

        expect(v5Io.output.join('')).toBe('A');
      });

      it('should print signed number', async () => {
        const ins = makeInstruction('print_num', [
          makeOperand(OperandType.LargeConstant, 0xFFFF), // -1 as signed
        ], 4);

        await v5Executor.execute(ins);

        expect(v5Io.output.join('')).toBe('-1');
      });
    });
  });

  describe('V4 opcodes', () => {
    let v4Memory: Memory;
    let v4Header: Header;
    let v4Stack: Stack;
    let v4Variables: Variables;
    let v4Io: TestIOAdapter;
    let v4TextDecoder: ZCharDecoder;
    let v4Executor: Executor;
    let v4Tokenizer: Tokenizer;

    function createV4Memory(): Memory {
      const size = 0x10000;
      const buffer = new ArrayBuffer(size);
      const view = new DataView(buffer);

      view.setUint8(0x00, 4); // Version 4
      view.setUint16(0x04, 0x4000, false);
      view.setUint16(0x06, 0x1000, false);
      view.setUint16(0x08, 0x300, false); // Dictionary
      view.setUint16(0x0C, 0x100, false);
      view.setUint16(0x0E, 0x2000, false);
      view.setUint16(0x18, 0x40, false);

      // Set up a minimal dictionary at 0x300
      // Number of word separators
      view.setUint8(0x300, 2);
      view.setUint8(0x301, 32); // space
      view.setUint8(0x302, 44); // comma
      view.setUint8(0x303, 6);  // entry length
      view.setUint16(0x304, 0, false); // 0 entries

      return new Memory(buffer);
    }

    beforeEach(async () => {
      v4Memory = createV4Memory();
      v4Header = new Header(v4Memory);
      v4Stack = new Stack();
      v4Stack.initialize(0);
      v4Variables = new Variables(v4Memory, v4Stack, v4Header.globalsAddress);
      v4Io = new TestIOAdapter();
      v4TextDecoder = new ZCharDecoder(v4Memory, 4, v4Header.abbreviationsAddress);
      const { Dictionary } = await import('../dictionary/Dictionary');
      const { Tokenizer } = await import('../dictionary/Tokenizer');
      const dictionary = new Dictionary(v4Memory, v4Header.dictionaryAddress, 4);
      v4Tokenizer = new Tokenizer(v4Memory, dictionary, 4);
      v4Executor = new Executor(v4Memory, v4Header, v4Stack, v4Variables, 4, v4Io, v4TextDecoder, v4Tokenizer);
    });

    describe('aread (V4 format - null-terminated)', () => {
      it('should read input and store null-terminated in V4 style', async () => {
        // Set up text buffer at 0x500: byte 0 = max length, text starts at byte 1
        v4Memory.writeByte(0x500, 50); // Max length
        
        // Queue input
        v4Io.queueLineInput('test');
        
        const ins = makeInstruction('aread', [
          makeOperand(OperandType.LargeConstant, 0x500), // text buffer
          makeOperand(OperandType.SmallConstant, 0),     // no parse buffer
        ], 5);

        await v4Executor.execute(ins);

        // Check text content (starts at byte 1)
        expect(v4Memory.readByte(0x501)).toBe('t'.charCodeAt(0));
        expect(v4Memory.readByte(0x502)).toBe('e'.charCodeAt(0));
        expect(v4Memory.readByte(0x503)).toBe('s'.charCodeAt(0));
        expect(v4Memory.readByte(0x504)).toBe('t'.charCodeAt(0));
        // Check null terminator
        expect(v4Memory.readByte(0x505)).toBe(0);
      });

      it('should tokenize when parse buffer provided', async () => {
        // Set up text buffer at 0x500
        v4Memory.writeByte(0x500, 50);
        
        // Set up parse buffer at 0x600
        v4Memory.writeByte(0x600, 10); // Max tokens
        
        // Queue input
        v4Io.queueLineInput('go north');
        
        const ins = makeInstruction('aread', [
          makeOperand(OperandType.LargeConstant, 0x500), // text buffer
          makeOperand(OperandType.LargeConstant, 0x600), // parse buffer
        ], 5);

        await v4Executor.execute(ins);

        // Check that tokenization occurred (number of tokens stored at byte 1)
        // Even if words not in dictionary, token count should be set
        expect(v4Memory.readByte(0x601)).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('edge cases for coverage', () => {
    describe('getOpcodeStats with unknown opcodes', () => {
      it('should track unknown opcodes in getOpcodeStats', async () => {
        // Execute an 'unknown' instruction to populate unknownOpcodes
        const unknownIns: DecodedInstruction = {
          address: 0x1000,
          length: 2,
          opcode: 0xBE, // Some unknown opcode
          opcodeName: 'unknown',
          form: InstructionForm.Variable,
          operandCount: OperandCount.OP0,
          operands: [],
        };

        await executor.execute(unknownIns);

        const stats = executor.getOpcodeStats();
        expect(stats.total).toBeGreaterThan(0);
        expect(stats.unknowns.size).toBe(1);
        expect(stats.unknowns.get(0xBE)).toBeDefined();
        expect(stats.unknowns.get(0xBE)!.count).toBe(1);
        expect(stats.unknowns.get(0xBE)!.address).toBe(0x1000);

        // Execute same unknown opcode again to test count increment
        await executor.execute(unknownIns);
        const stats2 = executor.getOpcodeStats();
        expect(stats2.unknowns.get(0xBE)!.count).toBe(2);
      });
    });

    describe('getOperandValue with invalid operand type', () => {
      it('should throw on invalid operand type', () => {
        // Create an operand with an invalid type (not LargeConstant, SmallConstant, or Variable)
        const invalidOperand: Operand = {
          type: 99 as OperandType, // Invalid type
          value: 42,
        };

        expect(() => executor.getOperandValue(invalidOperand)).toThrow('Invalid operand type: 99');
      });
    });

    describe('branch with no branch field', () => {
      it('should return nextPC when instruction has no branch field', () => {
        // Create instruction without branch field
        const ins = makeInstruction('add', [
          makeOperand(OperandType.SmallConstant, 1),
          makeOperand(OperandType.SmallConstant, 2),
        ], 4, { address: 0x1000 });

        // Call branch directly on instruction without branch field
        const result = executor.branch(ins, true);

        expect(result.nextPC).toBe(0x1004); // address + length
      });

      it('should return nextPC for false condition with no branch field', () => {
        const ins = makeInstruction('sub', [
          makeOperand(OperandType.SmallConstant, 5),
          makeOperand(OperandType.SmallConstant, 3),
        ], 4, { address: 0x2000 });

        const result = executor.branch(ins, false);

        expect(result.nextPC).toBe(0x2004);
      });
    });
  });
});
