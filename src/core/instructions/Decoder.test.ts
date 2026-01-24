/**
 * Tests for Decoder module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Decoder } from './Decoder';
import { Memory } from '../memory/Memory';
import { InstructionForm, OperandCount, OperandType } from '../../types/ZMachineTypes';

describe('Decoder', () => {
  /**
   * Create a test memory with given bytes at a specific address
   */
  function createMemoryWithBytes(bytes: number[], address: number = 0x100): Memory {
    const size = 0x400;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    
    // Set up minimal header
    view.setUint8(0x00, 3); // Version 3
    view.setUint16(0x0E, 0x100, false); // Static memory base
    
    // Write test bytes
    for (let i = 0; i < bytes.length; i++) {
      view.setUint8(address + i, bytes[i]);
    }
    
    return new Memory(buffer);
  }

  describe('Long form instructions', () => {
    it('should decode a long form 2OP with small constants', () => {
      // je 5 10 (0x01 with both operands as small constants)
      // Opcode byte: 0x01 (bits 6,5 = 00 = both small constant)
      const memory = createMemoryWithBytes([0x01, 0x05, 0x0A, 0x80]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.form).toBe(InstructionForm.Long);
      expect(instruction.operandCount).toBe(OperandCount.OP2);
      expect(instruction.opcode).toBe(0x01); // je
      expect(instruction.operands).toHaveLength(2);
      expect(instruction.operands[0]).toEqual({ type: OperandType.SmallConstant, value: 5 });
      expect(instruction.operands[1]).toEqual({ type: OperandType.SmallConstant, value: 10 });
    });

    it('should decode a long form 2OP with variable operands', () => {
      // add var1 var2 -> result
      // Opcode byte: 0x74 = 0b01110100 (bits 6,5 = 11 = both variable, opcode 0x14 = add)
      const memory = createMemoryWithBytes([0x74, 0x01, 0x02, 0x03]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.form).toBe(InstructionForm.Long);
      expect(instruction.opcode).toBe(0x14); // add
      expect(instruction.operands[0]).toEqual({ type: OperandType.Variable, value: 1 });
      expect(instruction.operands[1]).toEqual({ type: OperandType.Variable, value: 2 });
      expect(instruction.storeVariable).toBe(0x03);
    });

    it('should decode mixed operand types', () => {
      // sub var const -> result (bit 6 = 1 = variable, bit 5 = 0 = small constant)
      // Opcode: 0x55 = 0b01010101 (opcode 0x15 = sub)
      const memory = createMemoryWithBytes([0x55, 0x10, 0x05, 0x00]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.opcode).toBe(0x15); // sub
      expect(instruction.operands[0]).toEqual({ type: OperandType.Variable, value: 0x10 });
      expect(instruction.operands[1]).toEqual({ type: OperandType.SmallConstant, value: 0x05 });
    });
  });

  describe('Short form instructions', () => {
    it('should decode a 0OP instruction (rtrue)', () => {
      // rtrue: 0xB0
      const memory = createMemoryWithBytes([0xB0]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.form).toBe(InstructionForm.Short);
      expect(instruction.operandCount).toBe(OperandCount.OP0);
      expect(instruction.opcode).toBe(0x00); // rtrue
      expect(instruction.operands).toHaveLength(0);
      expect(instruction.length).toBe(1);
    });

    it('should decode a 0OP instruction (rfalse)', () => {
      // rfalse: 0xB1
      const memory = createMemoryWithBytes([0xB1]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.opcode).toBe(0x01); // rfalse
      expect(instruction.operandCount).toBe(OperandCount.OP0);
    });

    it('should decode a 1OP with large constant', () => {
      // jz #1234: 0x80 (type=00), followed by 0x12 0x34, then branch
      const memory = createMemoryWithBytes([0x80, 0x12, 0x34, 0xC0]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.form).toBe(InstructionForm.Short);
      expect(instruction.operandCount).toBe(OperandCount.OP1);
      expect(instruction.opcode).toBe(0x00); // jz
      expect(instruction.operands[0]).toEqual({ type: OperandType.LargeConstant, value: 0x1234 });
    });

    it('should decode a 1OP with small constant', () => {
      // jz #42: 0x90 (type=01), followed by 0x2A, then branch
      const memory = createMemoryWithBytes([0x90, 0x2A, 0xC0]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.operands[0]).toEqual({ type: OperandType.SmallConstant, value: 0x2A });
    });

    it('should decode a 1OP with variable', () => {
      // inc var: 0xA5 (type=10, opcode=05)
      const memory = createMemoryWithBytes([0xA5, 0x10]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.opcode).toBe(0x05); // inc
      expect(instruction.operands[0]).toEqual({ type: OperandType.Variable, value: 0x10 });
    });

    it('should decode ret with variable operand', () => {
      // ret var: 0xAB (type=10, opcode=0B)
      const memory = createMemoryWithBytes([0xAB, 0x00]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.opcode).toBe(0x0B); // ret
      expect(instruction.operands[0]).toEqual({ type: OperandType.Variable, value: 0x00 });
    });
  });

  describe('Variable form instructions', () => {
    it('should decode a VAR instruction with multiple operands', () => {
      // call routine arg1 arg2 -> result
      // 0xE0 = VAR form, opcode 0x00 (call)
      // Type byte: 0x54 = 01 01 01 00 = small, small, small, omitted (only 3 operands shown)
      // Actually let's do: 0x50 = 01 01 00 00 = small, small, omitted, omitted
      const memory = createMemoryWithBytes([
        0xE0,       // VAR opcode 0x00 (call)
        0x5F,       // Types: 01 01 11 11 = small, small, omitted, omitted
        0x10,       // Operand 1 (routine address low byte... simplified)
        0x20,       // Operand 2
        0x03,       // Store variable
      ]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.form).toBe(InstructionForm.Variable);
      expect(instruction.operandCount).toBe(OperandCount.VAR);
      expect(instruction.opcode).toBe(0x00); // call
      expect(instruction.operands).toHaveLength(2);
      expect(instruction.storeVariable).toBe(0x03);
    });

    it('should decode storew with 3 operands', () => {
      // storew array index value
      // 0xE1 = VAR form, opcode 0x01 (storew)
      const memory = createMemoryWithBytes([
        0xE1,       // VAR opcode 0x01 (storew)
        0x2B,       // Types: 00 10 10 11 = large, var, var, omitted
        0x10, 0x00, // Operand 1: large constant 0x1000
        0x01,       // Operand 2: variable 1
        0x02,       // Operand 3: variable 2
      ]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.opcode).toBe(0x01); // storew
      expect(instruction.operands).toHaveLength(3);
      expect(instruction.operands[0]).toEqual({ type: OperandType.LargeConstant, value: 0x1000 });
      expect(instruction.operands[1]).toEqual({ type: OperandType.Variable, value: 0x01 });
      expect(instruction.operands[2]).toEqual({ type: OperandType.Variable, value: 0x02 });
    });

    it('should decode 2OP in variable form', () => {
      // je with more than 2 operands uses variable form
      // 0xC1 = Variable form, 2OP bit clear, opcode 0x01 (je)
      const memory = createMemoryWithBytes([
        0xC1,       // 2OP in variable form, opcode 0x01 (je)
        0x55,       // Types: 01 01 01 01 = small, small, small, small
        0x01, 0x02, 0x03, 0x04, // Four operands
        0xC5,       // Branch: true, short offset 5
      ]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.form).toBe(InstructionForm.Variable);
      expect(instruction.operandCount).toBe(OperandCount.OP2); // Still considered 2OP
      expect(instruction.opcode).toBe(0x01); // je
      expect(instruction.operands).toHaveLength(4);
    });
  });

  describe('Branch decoding', () => {
    it('should decode short branch on true', () => {
      // jz with short positive branch
      const memory = createMemoryWithBytes([0x90, 0x00, 0xC5]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.branch).toBeDefined();
      expect(instruction.branch!.branchOnTrue).toBe(true);
      expect(instruction.branch!.offset).toBe(5);
    });

    it('should decode short branch on false', () => {
      // jz with short branch on false
      const memory = createMemoryWithBytes([0x90, 0x00, 0x45]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.branch!.branchOnTrue).toBe(false);
      expect(instruction.branch!.offset).toBe(5);
    });

    it('should decode branch offset 0 (return false)', () => {
      const memory = createMemoryWithBytes([0x90, 0x00, 0xC0]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.branch!.offset).toBe(0);
    });

    it('should decode branch offset 1 (return true)', () => {
      const memory = createMemoryWithBytes([0x90, 0x00, 0xC1]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.branch!.offset).toBe(1);
    });

    it('should decode long positive branch', () => {
      // Long branch: bit 6 = 0, 14-bit offset
      // 0x80 means branchOnTrue=true, long form
      // 0x00 0x10 = offset 16
      const memory = createMemoryWithBytes([0x90, 0x00, 0x80, 0x10]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.branch!.branchOnTrue).toBe(true);
      expect(instruction.branch!.offset).toBe(16);
    });

    it('should decode long negative branch', () => {
      // Long branch with negative offset
      // 0x3F 0xFE = -2 in 14-bit signed
      const memory = createMemoryWithBytes([0x90, 0x00, 0xBF, 0xFE]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.branch!.offset).toBe(-2);
    });
  });

  describe('Store decoding', () => {
    it('should decode store variable', () => {
      // add: stores result
      const memory = createMemoryWithBytes([0x14, 0x05, 0x03, 0x10]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.storeVariable).toBe(0x10);
    });

    it('should decode store to stack (variable 0)', () => {
      const memory = createMemoryWithBytes([0x14, 0x05, 0x03, 0x00]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.storeVariable).toBe(0x00);
    });
  });

  describe('Instructions with both store and branch', () => {
    it('should decode get_sibling (stores and branches)', () => {
      // get_sibling: 1OP, stores result, branches
      // 0xA1 = 1OP variable operand, opcode 0x01
      const memory = createMemoryWithBytes([
        0xA1,       // get_sibling with variable operand
        0x05,       // Variable 5 (object number)
        0x10,       // Store result in variable 0x10
        0xC8,       // Branch: true, short offset 8
      ]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.opcode).toBe(0x01); // get_sibling
      expect(instruction.storeVariable).toBe(0x10);
      expect(instruction.branch).toBeDefined();
      expect(instruction.branch!.branchOnTrue).toBe(true);
      expect(instruction.branch!.offset).toBe(8);
    });
  });

  describe('Instruction length calculation', () => {
    it('should calculate length for simple instruction', () => {
      // rtrue: just 1 byte
      const memory = createMemoryWithBytes([0xB0]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.length).toBe(1);
    });

    it('should calculate length for instruction with operands', () => {
      // add a b -> result: 4 bytes (opcode + 2 operands + store)
      const memory = createMemoryWithBytes([0x14, 0x05, 0x03, 0x10]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.length).toBe(4);
    });

    it('should calculate length for VAR instruction', () => {
      // storew with 3 operands: opcode + types + 3 operands
      const memory = createMemoryWithBytes([
        0xE1,       // storew
        0x57,       // small, small, small, omitted (actually 0x57)
        0x01, 0x02, 0x03,
      ]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.length).toBe(5);
    });
  });

  describe('Print instructions with inline text', () => {
    it('should handle print instruction placeholder', () => {
      // print: 0xB2 followed by Z-string
      // For now without text decoder, just verify structure
      const memory = createMemoryWithBytes([
        0xB2,             // print
        0x80, 0x00,       // Minimal Z-string (just end marker)
      ]);
      const decoder = new Decoder(memory, 3);
      
      const instruction = decoder.decode(0x100);
      
      expect(instruction.opcode).toBe(0x02); // print
      expect(instruction.text).toBeDefined();
      expect(instruction.length).toBe(3);
    });
  });
});
