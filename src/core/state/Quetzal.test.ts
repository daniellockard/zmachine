/**
 * Tests for Quetzal save format
 */

import { describe, it, expect } from 'vitest';
import {
  compressMemory,
  decompressMemory,
  createQuetzalSave,
  parseQuetzalSave,
  verifySaveCompatibility,
} from './Quetzal';
import { Memory } from '../memory/Memory';
import { Stack } from '../cpu/Stack';

describe('Quetzal', () => {
  describe('compressMemory', () => {
    it('should compress unchanged memory', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const current = new Uint8Array([1, 2, 3, 4, 5]);
      
      const compressed = compressMemory(current, original);
      
      // All zeros XOR, should be run-length encoded
      // 5 zeros becomes 0x00 0x04 (1 + 4 more zeros)
      expect(compressed).toEqual(new Uint8Array([0x00, 0x04]));
    });

    it('should compress single changed byte', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const current = new Uint8Array([1, 2, 99, 4, 5]);
      
      const compressed = compressMemory(current, original);
      
      // First 2 unchanged (0x00, 0x01), then 99^3=96, then 2 unchanged (0x00, 0x01)
      expect(compressed).toEqual(new Uint8Array([0x00, 0x01, 96, 0x00, 0x01]));
    });

    it('should handle all bytes changed', () => {
      const original = new Uint8Array([1, 2, 3]);
      const current = new Uint8Array([11, 12, 13]);
      
      const compressed = compressMemory(current, original);
      
      // XOR: 11^1=10, 12^2=14, 13^3=14
      expect(compressed).toEqual(new Uint8Array([10, 14, 14]));
    });

    it('should handle empty memory', () => {
      const original = new Uint8Array([]);
      const current = new Uint8Array([]);
      
      const compressed = compressMemory(current, original);
      
      expect(compressed).toEqual(new Uint8Array([]));
    });
  });

  describe('decompressMemory', () => {
    it('should decompress unchanged memory', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const compressed = new Uint8Array([0x00, 0x04]); // 5 zeros
      
      const decompressed = decompressMemory(compressed, original);
      
      expect(decompressed).toEqual(original);
    });

    it('should decompress single changed byte', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const compressed = new Uint8Array([0x00, 0x01, 96, 0x00, 0x01]);
      
      const decompressed = decompressMemory(compressed, original);
      
      expect(decompressed).toEqual(new Uint8Array([1, 2, 99, 4, 5]));
    });

    it('should be inverse of compress', () => {
      const original = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
      const current = new Uint8Array([10, 25, 30, 45, 50, 65, 70, 85]);
      
      const compressed = compressMemory(current, original);
      const decompressed = decompressMemory(compressed, original);
      
      expect(decompressed).toEqual(current);
    });
  });

  describe('CallStackSnapshot', () => {
    it('should serialize and deserialize stack frames', () => {
      const stack = new Stack();
      
      // Setup stack to match snapshot structure
      stack.initialize(0); // Main frame with 0 locals
      stack.pushFrame(0x1234, 5, 3, 3); // Second frame
      
      // Set locals
      stack.setLocal(0, 100);
      stack.setLocal(1, 200);
      stack.setLocal(2, 300);
      
      // Push to eval stack
      stack.push(10);
      stack.push(20);
      
      const savedSnapshot = stack.snapshot();
      
      expect(savedSnapshot.frames.length).toBe(2);
      expect(savedSnapshot.frames[1].returnPC).toBe(0x1234);
      expect(savedSnapshot.frames[1].storeVariable).toBe(5);
      expect(savedSnapshot.frames[1].argumentCount).toBe(3);
      expect(savedSnapshot.frames[1].locals).toEqual([100, 200, 300]);
      expect(savedSnapshot.frames[1].evalStack).toEqual([10, 20]);
    });
  });

  describe('createQuetzalSave and parseQuetzalSave', () => {
    it('should create a valid IFF structure', () => {
      const storyData = createTestStoryData();
      const memory = new Memory(storyData);
      const stack = new Stack();
      stack.initialize(2);
      
      const saveData = createQuetzalSave(memory, stack.snapshot(), 0x5000);
      
      // Check FORM header
      expect(String.fromCharCode(...saveData.slice(0, 4))).toBe('FORM');
      
      // Check IFZS type
      expect(String.fromCharCode(...saveData.slice(8, 12))).toBe('IFZS');
    });

    it('should round-trip save and restore', () => {
      const storyData = createTestStoryData();
      const memory = new Memory(storyData);
      const stack = new Stack();
      stack.initialize(2);
      stack.setLocal(0, 42);
      stack.setLocal(1, 99);
      stack.push(1234);
      
      // Modify dynamic memory
      memory.writeByte(0x40, 0xAB);
      memory.writeByte(0x41, 0xCD);
      
      const saveData = createQuetzalSave(memory, stack.snapshot(), 0x5000);
      const parsed = parseQuetzalSave(saveData);
      
      // Check game ID
      expect(parsed.gameId.release).toBe(1); // From test header
      expect(parsed.gameId.serial).toBe('123456');
      expect(parsed.gameId.pc).toBe(0x5000);
      
      // Check stack
      expect(parsed.callStack.frames.length).toBe(1);
      expect(parsed.callStack.frames[0].locals).toEqual([42, 99]);
      expect(parsed.callStack.frames[0].evalStack).toEqual([1234]);
      
      // Check memory includes our changes
      expect(parsed.dynamicMemory[0x40]).toBe(0xAB);
      expect(parsed.dynamicMemory[0x41]).toBe(0xCD);
    });

    it('should handle multiple stack frames', () => {
      const storyData = createTestStoryData();
      const memory = new Memory(storyData);
      const stack = new Stack();
      stack.initialize(1);
      stack.pushFrame(0x1000, 3, 2, 2);
      stack.setLocal(0, 111);
      stack.setLocal(1, 222);
      stack.pushFrame(0x2000, 7, 1, 1);
      stack.setLocal(0, 333);
      stack.push(444);
      stack.push(555);
      
      const saveData = createQuetzalSave(memory, stack.snapshot(), 0x3000);
      const parsed = parseQuetzalSave(saveData);
      
      expect(parsed.callStack.frames.length).toBe(3);
      
      // First frame (main)
      expect(parsed.callStack.frames[0].returnPC).toBe(0);
      expect(parsed.callStack.frames[0].locals).toEqual([0]);
      
      // Second frame
      expect(parsed.callStack.frames[1].returnPC).toBe(0x1000);
      expect(parsed.callStack.frames[1].storeVariable).toBe(3);
      expect(parsed.callStack.frames[1].argumentCount).toBe(2);
      expect(parsed.callStack.frames[1].locals).toEqual([111, 222]);
      
      // Third frame
      expect(parsed.callStack.frames[2].returnPC).toBe(0x2000);
      expect(parsed.callStack.frames[2].storeVariable).toBe(7);
      expect(parsed.callStack.frames[2].argumentCount).toBe(1);
      expect(parsed.callStack.frames[2].locals).toEqual([333]);
      expect(parsed.callStack.frames[2].evalStack).toEqual([444, 555]);
    });

    it('should verify save compatibility', () => {
      const storyData = createTestStoryData();
      const memory = new Memory(storyData);
      const stack = new Stack();
      stack.initialize(0);
      
      const saveData = createQuetzalSave(memory, stack.snapshot(), 0x5000);
      const parsed = parseQuetzalSave(saveData);
      
      // Same game should match
      expect(verifySaveCompatibility(parsed, memory)).toBe(true);
      
      // Different release should not match
      const differentStory = createTestStoryData(2); // release 2
      const differentMemory = new Memory(differentStory);
      expect(verifySaveCompatibility(parsed, differentMemory)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should reject non-IFF data', () => {
      const badData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
      expect(() => parseQuetzalSave(badData)).toThrow('Not an IFF file');
    });

    it('should reject non-Quetzal IFF', () => {
      // Valid IFF but not IFZS
      const badData = new Uint8Array([
        0x46, 0x4F, 0x52, 0x4D, // FORM
        0x00, 0x00, 0x00, 0x04, // size = 4
        0x54, 0x45, 0x53, 0x54, // TEST (not IFZS)
      ]);
      expect(() => parseQuetzalSave(badData)).toThrow('Not a Quetzal save file');
    });

    it('should reject too-short data', () => {
      const shortData = new Uint8Array([1, 2, 3, 4, 5]);
      expect(() => parseQuetzalSave(shortData)).toThrow('Save file too short');
    });

    it('should reject truncated IFF file', () => {
      // Valid FORM header but claims size larger than actual data
      const truncatedData = new Uint8Array([
        0x46, 0x4F, 0x52, 0x4D, // FORM
        0x00, 0x00, 0x00, 0xFF, // size = 255 (way larger than data)
        0x49, 0x46, 0x5A, 0x53, // IFZS
      ]);
      expect(() => parseQuetzalSave(truncatedData)).toThrow('IFF file truncated');
    });

    it('should reject save missing IFhd chunk', () => {
      // Create a Quetzal file with CMem and Stks but no IFhd
      const chunks: Uint8Array[] = [];
      
      // CMem chunk (compressed memory - just some zeros)
      const cmem = new Uint8Array([0x00, 0x04]); // 5 zero bytes compressed
      chunks.push(createChunk('CMem', cmem));
      
      // Stks chunk (minimal empty stack frame)
      const stks = new Uint8Array(8);
      chunks.push(createChunk('Stks', stks));
      
      const saveData = createIFZSFile(chunks);
      
      expect(() => parseQuetzalSave(saveData)).toThrow('Missing IFhd chunk');
    });

    it('should reject save missing memory chunk', () => {
      // Create a Quetzal file with IFhd and Stks but no CMem/UMem
      const chunks: Uint8Array[] = [];
      
      // IFhd chunk (13 bytes)
      const ifhd = new Uint8Array(13);
      ifhd[0] = 1; // release high
      ifhd[1] = 0; // release low  
      // Serial bytes 2-7 = '123456'
      ifhd[2] = 0x31; ifhd[3] = 0x32; ifhd[4] = 0x33;
      ifhd[5] = 0x34; ifhd[6] = 0x35; ifhd[7] = 0x36;
      // Checksum bytes 8-9
      ifhd[8] = 0xAB; ifhd[9] = 0xCD;
      // PC bytes 10-12
      ifhd[10] = 0x00; ifhd[11] = 0x50; ifhd[12] = 0x00;
      
      chunks.push(createChunk('IFhd', ifhd));
      
      // Stks chunk (minimal empty stack frame)
      const stks = new Uint8Array(8);
      // Empty main frame: 3-byte PC (0), flags (0), store var (0), args (0), eval count (0)
      chunks.push(createChunk('Stks', stks));
      
      const saveData = createIFZSFile(chunks);
      
      expect(() => parseQuetzalSave(saveData)).toThrow('Missing memory chunk');
    });

    it('should reject save missing Stks chunk', () => {
      // Create a Quetzal file with IFhd and CMem but no Stks
      const chunks: Uint8Array[] = [];
      
      // IFhd chunk (13 bytes)
      const ifhd = new Uint8Array(13);
      ifhd[0] = 0; ifhd[1] = 1; // release = 1
      // Serial bytes 2-7 = '123456'
      ifhd[2] = 0x31; ifhd[3] = 0x32; ifhd[4] = 0x33;
      ifhd[5] = 0x34; ifhd[6] = 0x35; ifhd[7] = 0x36;
      // Checksum bytes 8-9
      ifhd[8] = 0xAB; ifhd[9] = 0xCD;
      // PC bytes 10-12
      ifhd[10] = 0x00; ifhd[11] = 0x50; ifhd[12] = 0x00;
      
      chunks.push(createChunk('IFhd', ifhd));
      
      // CMem chunk (compressed memory - just some zeros)
      const cmem = new Uint8Array([0x00, 0x04]); // 5 zero bytes compressed
      chunks.push(createChunk('CMem', cmem));
      
      const saveData = createIFZSFile(chunks);
      
      expect(() => parseQuetzalSave(saveData)).toThrow('Missing Stks chunk');
    });
  });
});

/**
 * Helper to create an IFF chunk with header
 */
function createChunk(type: string, data: Uint8Array): Uint8Array {
  const paddedSize = data.length + (data.length % 2); // Add padding byte if odd
  const chunk = new Uint8Array(8 + paddedSize);
  
  // Type (4 bytes)
  for (let i = 0; i < 4; i++) {
    chunk[i] = type.charCodeAt(i);
  }
  
  // Size (4 bytes, big-endian)
  chunk[4] = (data.length >> 24) & 0xFF;
  chunk[5] = (data.length >> 16) & 0xFF;
  chunk[6] = (data.length >> 8) & 0xFF;
  chunk[7] = data.length & 0xFF;
  
  // Data
  chunk.set(data, 8);
  
  return chunk;
}

/**
 * Helper to create a complete IFZS file from chunks
 */
function createIFZSFile(chunks: Uint8Array[]): Uint8Array {
  // Calculate total chunk data size
  let dataSize = 4; // 'IFZS' type
  for (const chunk of chunks) {
    dataSize += chunk.length;
  }
  
  const file = new Uint8Array(8 + dataSize);
  
  // FORM header
  file[0] = 0x46; file[1] = 0x4F; file[2] = 0x52; file[3] = 0x4D; // 'FORM'
  
  // Size (big-endian)
  file[4] = (dataSize >> 24) & 0xFF;
  file[5] = (dataSize >> 16) & 0xFF;
  file[6] = (dataSize >> 8) & 0xFF;
  file[7] = dataSize & 0xFF;
  
  // IFZS type
  file[8] = 0x49; file[9] = 0x46; file[10] = 0x5A; file[11] = 0x53; // 'IFZS'
  
  // Chunks
  let offset = 12;
  for (const chunk of chunks) {
    file.set(chunk, offset);
    offset += chunk.length;
  }
  
  return file;
}

/**
 * Create minimal test story data with valid header
 */
function createTestStoryData(release: number = 1): ArrayBuffer {
  const data = new ArrayBuffer(0x100);
  const view = new DataView(data);
  
  // Version (offset 0x00)
  view.setUint8(0x00, 5);
  
  // Release number (offset 0x02)
  view.setUint16(0x02, release, false);
  
  // High memory base (offset 0x04)
  view.setUint16(0x04, 0x80, false);
  
  // Initial PC (offset 0x06)
  view.setUint16(0x06, 0x80, false);
  
  // Dictionary (offset 0x08)
  view.setUint16(0x08, 0x80, false);
  
  // Object table (offset 0x0A)
  view.setUint16(0x0A, 0x80, false);
  
  // Global variables (offset 0x0C)
  view.setUint16(0x0C, 0x80, false);
  
  // Static memory base (offset 0x0E)
  view.setUint16(0x0E, 0x80, false);
  
  // Serial number (offset 0x12, 6 bytes)
  const serial = '123456';
  for (let i = 0; i < 6; i++) {
    view.setUint8(0x12 + i, serial.charCodeAt(i));
  }
  
  // Abbreviation table (offset 0x18)
  view.setUint16(0x18, 0x40, false);
  
  // Checksum (offset 0x1C)
  view.setUint16(0x1C, 0xABCD, false);
  
  return data;
}
