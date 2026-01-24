/**
 * Tests for Memory module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Memory } from './Memory';

describe('Memory', () => {
  /**
   * Create a minimal valid story file buffer for testing
   * Sets version to 3 and static memory base to 0x100
   */
  function createTestBuffer(size: number = 0x200): ArrayBuffer {
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    
    // Header byte 0: version number (3)
    view.setUint8(0x00, 3);
    
    // Header bytes 0x0E-0x0F: static memory base (big-endian)
    // Set to 0x100 so we have 256 bytes of dynamic memory
    view.setUint16(0x0E, 0x100, false);
    
    return buffer;
  }

  describe('constructor', () => {
    it('should create memory from an ArrayBuffer', () => {
      const buffer = createTestBuffer();
      const memory = new Memory(buffer);
      
      expect(memory.size).toBe(0x200);
    });

    it('should read static memory base from header', () => {
      const buffer = createTestBuffer();
      const memory = new Memory(buffer);
      
      expect(memory.staticBase).toBe(0x100);
    });

    it('should make a copy of the original buffer', () => {
      const buffer = createTestBuffer();
      const memory = new Memory(buffer);
      
      // Modify original buffer
      new DataView(buffer).setUint8(0x50, 0xFF);
      
      // Memory should still have original value (0)
      expect(memory.readByte(0x50)).toBe(0);
    });
  });

  describe('readByte', () => {
    let memory: Memory;

    beforeEach(() => {
      const buffer = createTestBuffer();
      const view = new DataView(buffer);
      view.setUint8(0x20, 0x42);
      view.setUint8(0x21, 0xFF);
      memory = new Memory(buffer);
    });

    it('should read a byte from memory', () => {
      expect(memory.readByte(0x20)).toBe(0x42);
      expect(memory.readByte(0x21)).toBe(0xFF);
    });

    it('should read version byte from header', () => {
      expect(memory.readByte(0x00)).toBe(3);
    });

    it('should throw on out of bounds read', () => {
      expect(() => memory.readByte(-1)).toThrow('Memory read out of bounds');
      expect(() => memory.readByte(0x200)).toThrow('Memory read out of bounds');
    });
  });

  describe('readWord', () => {
    let memory: Memory;

    beforeEach(() => {
      const buffer = createTestBuffer();
      const view = new DataView(buffer);
      // Write 0x1234 at address 0x20 (big-endian: 0x12, 0x34)
      view.setUint8(0x20, 0x12);
      view.setUint8(0x21, 0x34);
      memory = new Memory(buffer);
    });

    it('should read a big-endian word from memory', () => {
      expect(memory.readWord(0x20)).toBe(0x1234);
    });

    it('should read static memory base from header', () => {
      expect(memory.readWord(0x0E)).toBe(0x100);
    });

    it('should throw on out of bounds read', () => {
      expect(() => memory.readWord(0x1FF)).toThrow('Memory read out of bounds');
    });
  });

  describe('writeByte', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(createTestBuffer());
    });

    it('should write a byte to dynamic memory', () => {
      memory.writeByte(0x50, 0xAB);
      expect(memory.readByte(0x50)).toBe(0xAB);
    });

    it('should mask value to 8 bits', () => {
      memory.writeByte(0x50, 0x1FF);
      expect(memory.readByte(0x50)).toBe(0xFF);
    });

    it('should throw when writing to static memory', () => {
      expect(() => memory.writeByte(0x100, 0x42)).toThrow('Cannot write to static/high memory');
    });

    it('should throw on out of bounds write', () => {
      expect(() => memory.writeByte(-1, 0x42)).toThrow('Memory read out of bounds');
    });
  });

  describe('writeWord', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory(createTestBuffer());
    });

    it('should write a big-endian word to dynamic memory', () => {
      memory.writeWord(0x50, 0xABCD);
      expect(memory.readWord(0x50)).toBe(0xABCD);
      expect(memory.readByte(0x50)).toBe(0xAB);
      expect(memory.readByte(0x51)).toBe(0xCD);
    });

    it('should mask value to 16 bits', () => {
      memory.writeWord(0x50, 0x1FFFF);
      expect(memory.readWord(0x50)).toBe(0xFFFF);
    });

    it('should throw when writing to static memory', () => {
      expect(() => memory.writeWord(0x100, 0x1234)).toThrow('Cannot write to static/high memory');
    });

    it('should throw when word spans into static memory', () => {
      expect(() => memory.writeWord(0xFF, 0x1234)).toThrow('Cannot write to static/high memory');
    });
  });

  describe('readBytes', () => {
    let memory: Memory;

    beforeEach(() => {
      const buffer = createTestBuffer();
      const view = new DataView(buffer);
      view.setUint8(0x20, 0x01);
      view.setUint8(0x21, 0x02);
      view.setUint8(0x22, 0x03);
      view.setUint8(0x23, 0x04);
      memory = new Memory(buffer);
    });

    it('should read a sequence of bytes', () => {
      const bytes = memory.readBytes(0x20, 4);
      expect(bytes).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    });

    it('should throw on out of bounds read', () => {
      expect(() => memory.readBytes(0x1FE, 4)).toThrow('Memory read out of bounds');
    });
  });

  describe('restart', () => {
    it('should restore dynamic memory to original state', () => {
      const buffer = createTestBuffer();
      const view = new DataView(buffer);
      view.setUint8(0x50, 0x42);
      
      const memory = new Memory(buffer);
      
      // Modify memory
      memory.writeByte(0x50, 0xFF);
      expect(memory.readByte(0x50)).toBe(0xFF);
      
      // Restart
      memory.restart();
      expect(memory.readByte(0x50)).toBe(0x42);
    });

    it('should not modify static memory on restart', () => {
      const buffer = createTestBuffer();
      const view = new DataView(buffer);
      // Put a value in static memory
      view.setUint8(0x150, 0xAA);
      
      const memory = new Memory(buffer);
      
      // Restart should preserve static memory
      memory.restart();
      expect(memory.readByte(0x150)).toBe(0xAA);
    });
  });

  describe('setStaticMemoryBase', () => {
    it('should update the static memory boundary', () => {
      const memory = new Memory(createTestBuffer());
      
      // Initially can't write at 0x100
      expect(() => memory.writeByte(0x100, 0x42)).toThrow();
      
      // Extend dynamic memory
      memory.setStaticMemoryBase(0x150);
      
      // Now we can write at 0x100
      memory.writeByte(0x100, 0x42);
      expect(memory.readByte(0x100)).toBe(0x42);
    });
  });
});
