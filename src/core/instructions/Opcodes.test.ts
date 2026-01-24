/**
 * Tests for Opcodes module
 */

import { describe, it, expect } from 'vitest';
import {
  get2OPInfo,
  get1OPInfo,
  get0OPInfo,
  getVARInfo,
  getEXTInfo,
  OPCODES_2OP,
  OPCODES_1OP,
  OPCODES_0OP,
  OPCODES_VAR,
} from './Opcodes';
import { OperandCount } from '../../types/ZMachineTypes';

describe('Opcodes', () => {
  describe('2OP opcodes', () => {
    it('should have je as opcode 0x01', () => {
      const info = get2OPInfo(0x01);
      expect(info).toBeDefined();
      expect(info!.name).toBe('je');
      expect(info!.branches).toBe(true);
      expect(info!.stores).toBe(false);
    });

    it('should have add as opcode 0x14', () => {
      const info = get2OPInfo(0x14);
      expect(info).toBeDefined();
      expect(info!.name).toBe('add');
      expect(info!.stores).toBe(true);
      expect(info!.branches).toBe(false);
    });

    it('should have all arithmetic ops with stores', () => {
      expect(get2OPInfo(0x14)!.stores).toBe(true); // add
      expect(get2OPInfo(0x15)!.stores).toBe(true); // sub
      expect(get2OPInfo(0x16)!.stores).toBe(true); // mul
      expect(get2OPInfo(0x17)!.stores).toBe(true); // div
      expect(get2OPInfo(0x18)!.stores).toBe(true); // mod
    });

    it('should have comparison ops with branches', () => {
      expect(get2OPInfo(0x01)!.branches).toBe(true); // je
      expect(get2OPInfo(0x02)!.branches).toBe(true); // jl
      expect(get2OPInfo(0x03)!.branches).toBe(true); // jg
      expect(get2OPInfo(0x07)!.branches).toBe(true); // test
    });

    it('should return undefined for unused opcode 0x00', () => {
      expect(get2OPInfo(0x00)).toBeUndefined();
    });
  });

  describe('1OP opcodes', () => {
    it('should have jz as opcode 0x00', () => {
      const info = get1OPInfo(0x00);
      expect(info).toBeDefined();
      expect(info!.name).toBe('jz');
      expect(info!.branches).toBe(true);
    });

    it('should have ret as opcode 0x0B', () => {
      const info = get1OPInfo(0x0B);
      expect(info).toBeDefined();
      expect(info!.name).toBe('ret');
      expect(info!.stores).toBe(false);
    });

    it('should have get_parent storing result', () => {
      const info = get1OPInfo(0x03);
      expect(info!.name).toBe('get_parent');
      expect(info!.stores).toBe(true);
    });

    it('should have get_sibling with both store and branch', () => {
      const info = get1OPInfo(0x01);
      expect(info!.name).toBe('get_sibling');
      expect(info!.stores).toBe(true);
      expect(info!.branches).toBe(true);
    });
  });

  describe('0OP opcodes', () => {
    it('should have rtrue as opcode 0x00', () => {
      const info = get0OPInfo(0x00);
      expect(info).toBeDefined();
      expect(info!.name).toBe('rtrue');
    });

    it('should have print with inline text', () => {
      const info = get0OPInfo(0x02);
      expect(info!.name).toBe('print');
      expect(info!.hasText).toBe(true);
    });

    it('should have print_ret with inline text', () => {
      const info = get0OPInfo(0x03);
      expect(info!.name).toBe('print_ret');
      expect(info!.hasText).toBe(true);
    });

    it('should have verify with branch (V3+)', () => {
      const info = get0OPInfo(0x0D);
      expect(info!.name).toBe('verify');
      expect(info!.branches).toBe(true);
      expect(info!.minVersion).toBe(3);
    });
  });

  describe('VAR opcodes', () => {
    it('should have call as opcode 0x00', () => {
      const info = getVARInfo(0x00);
      expect(info).toBeDefined();
      expect(info!.name).toBe('call');
      expect(info!.stores).toBe(true);
    });

    it('should have storew as opcode 0x01', () => {
      const info = getVARInfo(0x01);
      expect(info!.name).toBe('storew');
      expect(info!.stores).toBe(false);
    });

    it('should have random storing result', () => {
      const info = getVARInfo(0x07);
      expect(info!.name).toBe('random');
      expect(info!.stores).toBe(true);
    });

    it('should have scan_table with store and branch', () => {
      const info = getVARInfo(0x17);
      expect(info!.name).toBe('scan_table');
      expect(info!.stores).toBe(true);
      expect(info!.branches).toBe(true);
    });
  });

  describe('Extended opcodes', () => {
    it('should have save as opcode 0x00', () => {
      const info = getEXTInfo(0x00);
      expect(info).toBeDefined();
      expect(info!.name).toBe('save');
      expect(info!.stores).toBe(true);
      expect(info!.minVersion).toBe(5);
    });

    it('should have save_undo as opcode 0x09', () => {
      const info = getEXTInfo(0x09);
      expect(info!.name).toBe('save_undo');
      expect(info!.stores).toBe(true);
    });
  });

  describe('operand counts', () => {
    it('should mark 2OP opcodes correctly', () => {
      for (const [_, info] of Object.entries(OPCODES_2OP)) {
        expect(info.operandCount).toBe(OperandCount.OP2);
      }
    });

    it('should mark 1OP opcodes correctly', () => {
      for (const [_, info] of Object.entries(OPCODES_1OP)) {
        expect(info.operandCount).toBe(OperandCount.OP1);
      }
    });

    it('should mark 0OP opcodes correctly', () => {
      for (const [_, info] of Object.entries(OPCODES_0OP)) {
        expect(info.operandCount).toBe(OperandCount.OP0);
      }
    });

    it('should mark VAR opcodes correctly', () => {
      for (const [_, info] of Object.entries(OPCODES_VAR)) {
        expect(info.operandCount).toBe(OperandCount.VAR);
      }
    });
  });

  describe('version requirements', () => {
    it('should have V1 as default minimum version', () => {
      expect(get2OPInfo(0x01)!.minVersion).toBe(1); // je
      expect(get1OPInfo(0x00)!.minVersion).toBe(1); // jz
      expect(get0OPInfo(0x00)!.minVersion).toBe(1); // rtrue
    });

    it('should mark V4+ opcodes correctly', () => {
      expect(get2OPInfo(0x19)!.minVersion).toBe(4); // call_2s
      expect(getVARInfo(0x16)!.minVersion).toBe(4); // read_char
    });

    it('should mark V5+ opcodes correctly', () => {
      expect(get2OPInfo(0x1A)!.minVersion).toBe(5); // call_2n
      expect(getVARInfo(0x19)!.minVersion).toBe(5); // call_vn
    });

    it('should mark deprecated opcodes with maxVersion', () => {
      expect(get0OPInfo(0x05)!.maxVersion).toBe(3); // save (0OP form)
      expect(get0OPInfo(0x06)!.maxVersion).toBe(3); // restore (0OP form)
      expect(get1OPInfo(0x0F)!.maxVersion).toBe(4); // not (1OP form)
    });
  });
});
