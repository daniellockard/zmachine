/**
 * Tests for Header module
 */

import { describe, it, expect } from 'vitest';
import { Memory } from './Memory';
import { Header, HeaderAddress, Flags1V3, Flags2 } from './Header';

describe('Header', () => {
  /**
   * Create a test story buffer with configurable header values
   */
  function createTestStory(
    options: {
      version?: number;
      release?: number;
      highMemoryBase?: number;
      initialPC?: number;
      dictionary?: number;
      objectTable?: number;
      globals?: number;
      staticMemoryBase?: number;
      flags1?: number;
      flags2?: number;
      serial?: string;
      abbreviations?: number;
      fileLength?: number;
      checksum?: number;
    } = {}
  ): ArrayBuffer {
    const size = 0x400; // 1KB is enough for tests
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Set defaults
    const version = options.version ?? 3;
    const staticBase = options.staticMemoryBase ?? 0x100;

    // Write header fields
    view.setUint8(HeaderAddress.VERSION, version);
    view.setUint8(HeaderAddress.FLAGS1, options.flags1 ?? 0);
    view.setUint16(HeaderAddress.RELEASE, options.release ?? 1, false);
    view.setUint16(HeaderAddress.HIGH_MEMORY_BASE, options.highMemoryBase ?? 0x200, false);
    view.setUint16(HeaderAddress.INITIAL_PC, options.initialPC ?? 0x200, false);
    view.setUint16(HeaderAddress.DICTIONARY, options.dictionary ?? 0x100, false);
    view.setUint16(HeaderAddress.OBJECT_TABLE, options.objectTable ?? 0x80, false);
    view.setUint16(HeaderAddress.GLOBALS, options.globals ?? 0x50, false);
    view.setUint16(HeaderAddress.STATIC_MEMORY_BASE, staticBase, false);
    view.setUint16(HeaderAddress.FLAGS2, options.flags2 ?? 0, false);

    // Serial number (6 ASCII bytes)
    const serial = options.serial ?? '000101';
    for (let i = 0; i < 6; i++) {
      view.setUint8(HeaderAddress.SERIAL + i, serial.charCodeAt(i));
    }

    view.setUint16(HeaderAddress.ABBREVIATIONS, options.abbreviations ?? 0x40, false);
    view.setUint16(HeaderAddress.FILE_LENGTH, options.fileLength ?? 0x200, false);
    view.setUint16(HeaderAddress.CHECKSUM, options.checksum ?? 0xabcd, false);

    return buffer;
  }

  describe('constructor and parsing', () => {
    it('should parse a valid V3 header', () => {
      const buffer = createTestStory({ version: 3 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.version).toBe(3);
    });

    it('should parse a valid V5 header', () => {
      const buffer = createTestStory({ version: 5 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.version).toBe(5);
    });

    it('should throw on invalid version', () => {
      const buffer = createTestStory({ version: 0 });
      const memory = new Memory(buffer);

      expect(() => new Header(memory)).toThrow('Invalid Z-machine version: 0');
    });

    it('should throw on version > 8', () => {
      const buffer = createTestStory({ version: 9 });
      const memory = new Memory(buffer);

      expect(() => new Header(memory)).toThrow('Invalid Z-machine version: 9');
    });
  });

  describe('header field getters', () => {
    it('should return correct release number', () => {
      const buffer = createTestStory({ release: 42 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.release).toBe(42);
    });

    it('should return correct high memory base', () => {
      const buffer = createTestStory({ highMemoryBase: 0x1234 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.highMemoryBase).toBe(0x1234);
    });

    it('should return correct initial PC', () => {
      const buffer = createTestStory({ initialPC: 0x5678 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.initialPC).toBe(0x5678);
    });

    it('should return correct dictionary address', () => {
      const buffer = createTestStory({ dictionary: 0x1000 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.dictionaryAddress).toBe(0x1000);
    });

    it('should return correct object table address', () => {
      const buffer = createTestStory({ objectTable: 0x0800 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.objectTableAddress).toBe(0x0800);
    });

    it('should return correct globals address', () => {
      const buffer = createTestStory({ globals: 0x0300 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.globalsAddress).toBe(0x0300);
    });

    it('should return correct static memory base', () => {
      const buffer = createTestStory({ staticMemoryBase: 0x2000 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.staticMemoryBase).toBe(0x2000);
    });

    it('should return correct serial number', () => {
      const buffer = createTestStory({ serial: '851125' });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.serialNumber).toBe('851125');
    });

    it('should return correct abbreviations address', () => {
      const buffer = createTestStory({ abbreviations: 0x0100 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.abbreviationsAddress).toBe(0x0100);
    });

    it('should return correct checksum', () => {
      const buffer = createTestStory({ checksum: 0x1234 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.checksum).toBe(0x1234);
    });
  });

  describe('file length calculation', () => {
    it('should calculate V3 file length (multiply by 2)', () => {
      const buffer = createTestStory({ version: 3, fileLength: 0x100 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.fileLength).toBe(0x200); // 0x100 * 2
    });

    it('should calculate V5 file length (multiply by 4)', () => {
      const buffer = createTestStory({ version: 5, fileLength: 0x100 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.fileLength).toBe(0x400); // 0x100 * 4
    });

    it('should calculate V8 file length (multiply by 8)', () => {
      const buffer = createTestStory({ version: 8, fileLength: 0x100 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.fileLength).toBe(0x800); // 0x100 * 8
    });
  });

  describe('flags', () => {
    it('should check flags1 bits', () => {
      const buffer = createTestStory({
        flags1: Flags1V3.STATUS_LINE_TYPE | Flags1V3.SCREEN_SPLIT_AVAILABLE,
      });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.hasFlag1(Flags1V3.STATUS_LINE_TYPE)).toBe(true);
      expect(header.hasFlag1(Flags1V3.SCREEN_SPLIT_AVAILABLE)).toBe(true);
      expect(header.hasFlag1(Flags1V3.STORY_SPLIT)).toBe(false);
    });

    it('should check flags2 bits', () => {
      const buffer = createTestStory({
        flags2: Flags2.TRANSCRIPTING | Flags2.COLORS,
      });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.hasFlag2(Flags2.TRANSCRIPTING)).toBe(true);
      expect(header.hasFlag2(Flags2.COLORS)).toBe(true);
      expect(header.hasFlag2(Flags2.SOUND)).toBe(false);
    });

    it('should set flags2 bits', () => {
      const buffer = createTestStory({ flags2: 0 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.hasFlag2(Flags2.TRANSCRIPTING)).toBe(false);

      header.setFlag2(Flags2.TRANSCRIPTING, true);
      expect(header.hasFlag2(Flags2.TRANSCRIPTING)).toBe(true);

      header.setFlag2(Flags2.TRANSCRIPTING, false);
      expect(header.hasFlag2(Flags2.TRANSCRIPTING)).toBe(false);
    });
  });

  describe('packed address conversion', () => {
    it('should return correct multiplier for V3', () => {
      const buffer = createTestStory({ version: 3 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.packedAddressMultiplier).toBe(2);
    });

    it('should return correct multiplier for V5', () => {
      const buffer = createTestStory({ version: 5 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.packedAddressMultiplier).toBe(4);
    });

    it('should return correct multiplier for V8', () => {
      const buffer = createTestStory({ version: 8 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.packedAddressMultiplier).toBe(8);
    });

    it('should unpack V3 addresses correctly', () => {
      const buffer = createTestStory({ version: 3 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.unpackAddress(0x100)).toBe(0x200);
    });

    it('should unpack V5 addresses correctly', () => {
      const buffer = createTestStory({ version: 5 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.unpackAddress(0x100)).toBe(0x400);
    });

    it('should unpack V8 addresses correctly', () => {
      const buffer = createTestStory({ version: 8 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.unpackAddress(0x100)).toBe(0x800);
    });

    it('should unpack V6 routine addresses with offset', () => {
      const buffer = createTestStory({ version: 6 });
      const view = new DataView(buffer);
      // Set routines offset at 0x28 (8 * offset gives byte offset)
      view.setUint16(0x28, 0x10, false); // offset = 0x10, so byte offset = 0x80

      const memory = new Memory(buffer);
      const header = new Header(memory);

      // V6: packed * 4 + offset
      // 0x100 * 4 + 0x80 = 0x480
      expect(header.unpackAddress(0x100, false)).toBe(0x480);
    });

    it('should unpack V6 string addresses with offset', () => {
      const buffer = createTestStory({ version: 6 });
      const view = new DataView(buffer);
      // Set strings offset at 0x2A (8 * offset gives byte offset)
      view.setUint16(0x2a, 0x20, false); // offset = 0x20, so byte offset = 0x100

      const memory = new Memory(buffer);
      const header = new Header(memory);

      // V6: packed * 4 + offset
      // 0x100 * 4 + 0x100 = 0x500
      expect(header.unpackAddress(0x100, true)).toBe(0x500);
    });

    it('should unpack V7 addresses with offset', () => {
      const buffer = createTestStory({ version: 7 });
      const view = new DataView(buffer);
      view.setUint16(0x28, 0x08, false); // routines offset

      const memory = new Memory(buffer);
      const header = new Header(memory);

      // V7: packed * 4 + offset
      // 0x100 * 4 + 0x40 = 0x440
      expect(header.unpackAddress(0x100, false)).toBe(0x440);
    });
  });

  describe('flags2 getter', () => {
    it('should return flags2 value', () => {
      const buffer = createTestStory({ version: 5 });
      const view = new DataView(buffer);
      view.setUint16(0x10, 0x1234, false); // flags2 at 0x10

      const memory = new Memory(buffer);
      const header = new Header(memory);

      expect(header.flags2).toBe(0x1234);
    });
  });

  describe('setInterpreterInfo', () => {
    it('should set interpreter info for V4+', () => {
      const buffer = createTestStory({ version: 5 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      header.setInterpreterInfo(6, 65); // 6 = IBM PC, 65 = 'A'

      expect(memory.readByte(HeaderAddress.INTERPRETER_NUMBER)).toBe(6);
      expect(memory.readByte(HeaderAddress.INTERPRETER_VERSION)).toBe(65);
    });

    it('should not set interpreter info for V3', () => {
      const buffer = createTestStory({ version: 3 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      // Clear the bytes first
      memory.writeByte(HeaderAddress.INTERPRETER_NUMBER, 0);
      memory.writeByte(HeaderAddress.INTERPRETER_VERSION, 0);

      header.setInterpreterInfo(6, 65);

      // Should remain unchanged for V3
      expect(memory.readByte(HeaderAddress.INTERPRETER_NUMBER)).toBe(0);
      expect(memory.readByte(HeaderAddress.INTERPRETER_VERSION)).toBe(0);
    });
  });

  describe('setScreenDimensions', () => {
    it('should set screen dimensions for V4', () => {
      const buffer = createTestStory({ version: 4 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      header.setScreenDimensions(80, 25);

      expect(memory.readByte(HeaderAddress.SCREEN_WIDTH)).toBe(80);
      expect(memory.readByte(HeaderAddress.SCREEN_HEIGHT)).toBe(25);
    });

    it('should set screen dimensions in units for V5+', () => {
      const buffer = createTestStory({ version: 5 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      header.setScreenDimensions(640, 480);

      expect(memory.readByte(HeaderAddress.SCREEN_WIDTH)).toBe(640 & 0xff);
      expect(memory.readByte(HeaderAddress.SCREEN_HEIGHT)).toBe(480 & 0xff);
      expect(memory.readWord(HeaderAddress.SCREEN_WIDTH_UNITS)).toBe(640);
      expect(memory.readWord(HeaderAddress.SCREEN_HEIGHT_UNITS)).toBe(480);
    });

    it('should not set screen dimensions for V3', () => {
      const buffer = createTestStory({ version: 3 });
      const memory = new Memory(buffer);
      const header = new Header(memory);

      // Clear the bytes first
      memory.writeByte(HeaderAddress.SCREEN_WIDTH, 0);
      memory.writeByte(HeaderAddress.SCREEN_HEIGHT, 0);

      header.setScreenDimensions(80, 25);

      // Should remain unchanged for V3
      expect(memory.readByte(HeaderAddress.SCREEN_WIDTH)).toBe(0);
      expect(memory.readByte(HeaderAddress.SCREEN_HEIGHT)).toBe(0);
    });
  });
});
