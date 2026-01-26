/**
 * Tests for ZMachine core class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZMachine, RunState } from './ZMachine';
import { TestIOAdapter } from '../io/TestIOAdapter';

/**
 * Create a minimal valid V5 story file for testing
 */
function createMinimalStory(): ArrayBuffer {
  const size = 0x10000;
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);

  // Header setup for V5
  view.setUint8(0x00, 5); // Version 5
  view.setUint16(0x02, 1, false); // Release
  view.setUint16(0x04, 0x4000, false); // High memory base
  view.setUint16(0x06, 0x1000, false); // Initial PC
  view.setUint16(0x08, 0x40, false); // Abbreviations
  view.setUint16(0x0A, 0x100, false); // Object table
  view.setUint16(0x0C, 0x200, false); // Globals
  view.setUint16(0x0E, 0x2000, false); // Static memory base
  
  // Dictionary at 0x300
  view.setUint16(0x10, 0, false); // Flags 2
  view.setUint8(0x11, 0); // Standard revision major
  view.setUint8(0x12, 0); // Standard revision minor

  // Serial number
  const serial = '123456';
  for (let i = 0; i < 6; i++) {
    view.setUint8(0x12 + i, serial.charCodeAt(i));
  }

  // Dictionary header at 0x08 (using abbreviations location for simplicity)
  // Minimal dictionary
  const dictBase = 0x300;
  view.setUint16(0x08, dictBase, false); // Dictionary address in header is at different location
  
  // Set up minimal object table at 0x100
  // Object table header: property defaults (31 words for V5 = 62 bytes)
  // Then objects start

  // Set up minimal dictionary
  view.setUint8(dictBase, 0); // No word separators
  view.setUint8(dictBase + 1, 6); // Entry length (6 bytes for V5)
  view.setUint16(dictBase + 2, 0, false); // 0 entries

  return buffer;
}

describe('ZMachine', () => {
  let io: TestIOAdapter;
  let storyData: ArrayBuffer;

  beforeEach(() => {
    io = new TestIOAdapter();
    storyData = createMinimalStory();
  });

  describe('construction', () => {
    it('should create a ZMachine instance', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm).toBeInstanceOf(ZMachine);
    });

    it('should parse version from story file', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.version).toBe(5);
    });

    it('should throw for invalid version via Header', () => {
      const view = new DataView(storyData);
      view.setUint8(0x00, 9); // Invalid version
      
      expect(() => new ZMachine(storyData, io)).toThrow('Invalid Z-machine version: 9');
    });
  });

  describe('load static method', () => {
    it('should create ZMachine from ArrayBuffer', () => {
      const zm = ZMachine.load(storyData, io);
      expect(zm).toBeInstanceOf(ZMachine);
      expect(zm.version).toBe(5);
    });

    it('should create ZMachine from Uint8Array', () => {
      const uint8Array = new Uint8Array(storyData);
      const zm = ZMachine.load(uint8Array, io);
      expect(zm).toBeInstanceOf(ZMachine);
      expect(zm.version).toBe(5);
    });

    it('should copy Uint8Array data to new ArrayBuffer', () => {
      const uint8Array = new Uint8Array(storyData);
      const zm = ZMachine.load(uint8Array, io);
      
      // Modify the original Uint8Array
      uint8Array[0x50] = 0xAB;
      
      // ZMachine memory should not be affected (data was copied)
      expect(zm.memory.readByte(0x50)).toBe(0);
    });

    it('should initialize with stopped state', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.state).toBe(RunState.Stopped);
    });

    it('should set initial PC from header', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.pc).toBe(0x1000);
    });
  });

  describe('state property', () => {
    it('should expose current run state', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.state).toBe(RunState.Stopped);
    });
  });

  describe('pc property', () => {
    it('should expose current program counter', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.pc).toBe(0x1000);
    });
  });

  describe('restart', () => {
    it('should reset memory to original', () => {
      const zm = new ZMachine(storyData, io);
      
      // Modify memory
      zm.memory.writeByte(0x50, 99);
      expect(zm.memory.readByte(0x50)).toBe(99);
      
      // Restart
      zm.restart();
      
      // Memory should be reset
      expect(zm.memory.readByte(0x50)).toBe(0);
    });

    it('should reset state to stopped', () => {
      const zm = new ZMachine(storyData, io);
      zm.restart();
      expect(zm.state).toBe(RunState.Stopped);
    });

    it('should reset PC to initial value', () => {
      const zm = new ZMachine(storyData, io);
      zm.restart();
      expect(zm.pc).toBe(0x1000);
    });
  });

  describe('component access', () => {
    it('should provide access to memory', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.memory).toBeDefined();
    });

    it('should provide access to header', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.header).toBeDefined();
      expect(zm.header.version).toBe(5);
    });

    it('should provide access to stack', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.stack).toBeDefined();
    });

    it('should provide access to variables', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.variables).toBeDefined();
    });

    it('should provide access to decoder', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.decoder).toBeDefined();
    });

    it('should provide access to executor', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.executor).toBeDefined();
    });

    it('should provide access to objectTable', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.objectTable).toBeDefined();
    });

    it('should provide access to dictionary', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.dictionary).toBeDefined();
    });

    it('should provide access to tokenizer', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.tokenizer).toBeDefined();
    });

    it('should provide access to textDecoder', () => {
      const zm = new ZMachine(storyData, io);
      expect(zm.textDecoder).toBeDefined();
    });
  });

  describe('lookupWord', () => {
    it('should return 0 for empty string', () => {
      const zm = new ZMachine(storyData, io);
      const result = zm.lookupWord('');
      expect(result).toBe(0);
    });

    it('should return 0 for word not in dictionary', () => {
      const zm = new ZMachine(storyData, io);
      const result = zm.lookupWord('xyzzy');
      expect(result).toBe(0);
    });
  });

  describe('version-specific behavior', () => {
    it('should handle V3 story', () => {
      const view = new DataView(storyData);
      view.setUint8(0x00, 3);
      
      const zm = new ZMachine(storyData, io);
      expect(zm.version).toBe(3);
    });

    it('should handle V4 story', () => {
      const view = new DataView(storyData);
      view.setUint8(0x00, 4);
      
      const zm = new ZMachine(storyData, io);
      expect(zm.version).toBe(4);
    });

    it('should handle V8 story', () => {
      const view = new DataView(storyData);
      view.setUint8(0x00, 8);
      
      const zm = new ZMachine(storyData, io);
      expect(zm.version).toBe(8);
    });
  });

  describe('printText', () => {
    it('should decode text at an address', () => {
      const view = new DataView(storyData);
      // Write a simple Z-string "abc" at address 0x800
      // Z-chars: a=6, b=7, c=8 -> packed with end bit
      // Word: (6 << 10) | (7 << 5) | 8 | 0x8000 = 0x98E8
      view.setUint16(0x800, 0x98E8, false);
      
      const zm = new ZMachine(storyData, io);
      const result = zm.printText(0x800);
      
      expect(result).toBe('abc');
    });
  });

  describe('getObjectName', () => {
    it('should return empty string for object with no name', () => {
      // Object table is at 0x100, need to set up minimal object
      const view = new DataView(storyData);
      
      // For V5, object table has 63 property default words (126 bytes)
      // Then object entries start
      const objTableBase = 0x100;
      
      // Object 1 entry for V5 (14 bytes):
      // - 6 bytes attributes
      // - word parent
      // - word sibling  
      // - word child
      // - word properties pointer
      const obj1Addr = objTableBase + 126; // After 63 default property words
      
      // Set properties pointer to a location with 0-length name
      const propsAddr = 0x400;
      view.setUint16(obj1Addr + 12, propsAddr, false); // properties pointer
      
      // At properties address: first byte is name length (in words)
      view.setUint8(propsAddr, 0); // 0 = no name
      
      const zm = new ZMachine(storyData, io);
      const result = zm.getObjectName(1);
      
      expect(result).toBe('');
    });

    it('should return object name when present', () => {
      const view = new DataView(storyData);
      
      const objTableBase = 0x100;
      const obj1Addr = objTableBase + 126; // After 63 default property words for V5
      
      // Set properties pointer
      const propsAddr = 0x400;
      view.setUint16(obj1Addr + 12, propsAddr, false); // properties pointer
      
      // At properties address: first byte is name length (in words)
      view.setUint8(propsAddr, 1); // 1 word of name text
      
      // Name text at propsAddr + 1: Z-string "abc"
      view.setUint16(propsAddr + 1, 0x98E8, false);
      
      const zm = new ZMachine(storyData, io);
      const result = zm.getObjectName(1);
      
      expect(result).toBe('abc');
    });
  });

  describe('provideInput', () => {
    it('should throw error when not waiting for input', async () => {
      const zm = new ZMachine(storyData, io);
      
      await expect(zm.provideInput('test')).rejects.toThrow('Not waiting for input');
    });

    it('should transition to Running state when waiting for input', async () => {
      const zm = new ZMachine(storyData, io);
      
      // We need to manually set state to WaitingForInput for this test
      // Access private state for testing
      (zm as any)._state = RunState.WaitingForInput;
      
      await zm.provideInput('test');
      
      expect(zm.state).toBe(RunState.Running);
    });
  });

  describe('restart', () => {
    it('should reset dynamic memory to original state', () => {
      const view = new DataView(storyData);
      const zm = new ZMachine(storyData, io);
      
      // Modify something in dynamic memory
      zm.memory.writeByte(0x50, 0xAB);
      expect(zm.memory.readByte(0x50)).toBe(0xAB);
      
      // Restart should restore original value
      zm.restart();
      expect(zm.memory.readByte(0x50)).toBe(0);
    });

    it('should reset PC to initial value', () => {
      const view = new DataView(storyData);
      view.setUint16(0x06, 0x1234, false); // Initial PC
      
      const zm = new ZMachine(storyData, io);
      
      // Restart should restore PC
      zm.restart();
      expect(zm.pc).toBe(0x1234);
    });

    it('should reset state to Stopped', () => {
      const zm = new ZMachine(storyData, io);
      
      zm.restart();
      expect(zm.state).toBe(RunState.Stopped);
    });
  });

  describe('run', () => {
    it('should set state to Running and loop until halted', async () => {
      const zm = new ZMachine(storyData, io);
      
      // Mock executor to return halted after first instruction
      vi.spyOn(zm.executor, 'execute').mockResolvedValueOnce({
        halted: true,
      });
      
      // Mock decoder to return a valid instruction
      vi.spyOn(zm.decoder, 'decode').mockReturnValueOnce({
        opcode: 0,
        form: 'short',
        operandCount: 0,
        operands: [],
        address: zm.pc,
        length: 1,
      });
      
      const result = await zm.run();
      
      expect(result).toBe(RunState.Halted);
      expect(zm.state).toBe(RunState.Halted);
    });

    it('should stop running when waiting for input', async () => {
      const zm = new ZMachine(storyData, io);
      
      // Mock executor to return waitingForInput
      vi.spyOn(zm.executor, 'execute').mockResolvedValueOnce({
        waitingForInput: true,
      });
      
      // Mock decoder to return a valid instruction
      vi.spyOn(zm.decoder, 'decode').mockReturnValueOnce({
        opcode: 0,
        form: 'short',
        operandCount: 0,
        operands: [],
        address: zm.pc,
        length: 1,
      });
      
      const result = await zm.run();
      
      expect(result).toBe(RunState.WaitingForInput);
      expect(zm.state).toBe(RunState.WaitingForInput);
    });

    it('should execute multiple instructions before halting', async () => {
      const zm = new ZMachine(storyData, io);
      
      // Mock executor to execute 3 instructions then halt
      const executeSpy = vi.spyOn(zm.executor, 'execute')
        .mockResolvedValueOnce({ nextPC: 0x1001 })
        .mockResolvedValueOnce({ nextPC: 0x1002 })
        .mockResolvedValueOnce({ halted: true });
      
      // Mock decoder for each instruction
      vi.spyOn(zm.decoder, 'decode')
        .mockReturnValueOnce({
          opcode: 0,
          form: 'short',
          operandCount: 0,
          operands: [],
          address: 0x1000,
          length: 1,
        })
        .mockReturnValueOnce({
          opcode: 0,
          form: 'short',
          operandCount: 0,
          operands: [],
          address: 0x1001,
          length: 1,
        })
        .mockReturnValueOnce({
          opcode: 0,
          form: 'short',
          operandCount: 0,
          operands: [],
          address: 0x1002,
          length: 1,
        });
      
      const result = await zm.run();
      
      expect(executeSpy).toHaveBeenCalledTimes(3);
      expect(result).toBe(RunState.Halted);
    });
  });

  describe('step', () => {
    it('should do nothing when state is Halted', async () => {
      const zm = new ZMachine(storyData, io);
      const initialPC = zm.pc;
      
      // Set state to Halted
      (zm as any)._state = RunState.Halted;
      
      // Spy on decoder to verify it's not called
      const decodeSpy = vi.spyOn(zm.decoder, 'decode');
      
      await zm.step();
      
      // Should return early without decoding
      expect(decodeSpy).not.toHaveBeenCalled();
      expect(zm.pc).toBe(initialPC);
      expect(zm.state).toBe(RunState.Halted);
    });

    it('should set state to WaitingForInput when instruction returns waitingForInput', async () => {
      const zm = new ZMachine(storyData, io);
      
      // Mock executor to return waitingForInput result
      vi.spyOn(zm.executor, 'execute').mockResolvedValueOnce({
        waitingForInput: true,
      });
      
      // Mock decoder to return a valid instruction
      vi.spyOn(zm.decoder, 'decode').mockReturnValueOnce({
        opcode: 0,
        form: 'short',
        operandCount: 0,
        operands: [],
        address: zm.pc,
        length: 1,
      });
      
      (zm as any)._state = RunState.Running;
      await zm.step();
      
      expect(zm.state).toBe(RunState.WaitingForInput);
    });

    it('should update PC to jumpTo address when instruction returns jumpTo', async () => {
      const zm = new ZMachine(storyData, io);
      const jumpTarget = 0x2000;
      
      // Mock executor to return jumpTo result
      vi.spyOn(zm.executor, 'execute').mockResolvedValueOnce({
        jumpTo: jumpTarget,
      });
      
      // Mock decoder to return a valid instruction
      vi.spyOn(zm.decoder, 'decode').mockReturnValueOnce({
        opcode: 0,
        form: 'short',
        operandCount: 0,
        operands: [],
        address: zm.pc,
        length: 1,
      });
      
      (zm as any)._state = RunState.Running;
      await zm.step();
      
      expect(zm.pc).toBe(jumpTarget);
    });

    it('should fallback to advancing PC by instruction length when neither nextPC nor jumpTo is set', async () => {
      const zm = new ZMachine(storyData, io);
      const initialPC = zm.pc;
      const instructionLength = 3;
      
      // Mock executor to return empty result (no nextPC, no jumpTo)
      vi.spyOn(zm.executor, 'execute').mockResolvedValueOnce({});
      
      // Mock decoder to return a valid instruction with known length
      vi.spyOn(zm.decoder, 'decode').mockReturnValueOnce({
        opcode: 0,
        form: 'short',
        operandCount: 0,
        operands: [],
        address: initialPC,
        length: instructionLength,
      });
      
      (zm as any)._state = RunState.Running;
      await zm.step();
      
      expect(zm.pc).toBe(initialPC + instructionLength);
    });
  });
});
