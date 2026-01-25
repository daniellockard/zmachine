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
import { Decoder } from '../instructions/Decoder';
import { DecodedInstruction, OperandType, Operand, InstructionForm, OperandCount } from '../../types/ZMachineTypes';

describe('Executor', () => {
  let memory: Memory;
  let header: Header;
  let stack: Stack;
  let variables: Variables;
  let textDecoder: ZCharDecoder;
  let io: TestIOAdapter;
  let executor: Executor;
  let _decoder: Decoder;

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
    _decoder = new Decoder(memory, 3);
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
});
