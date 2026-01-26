/**
 * Tests for ZCharDecoder module
 */

import { describe, it, expect } from 'vitest';
import { ZCharDecoder } from './ZCharDecoder';
import { Memory } from '../memory/Memory';

describe('ZCharDecoder', () => {
  /**
   * Create test memory with abbreviation table and content
   */
  function createTestMemory(
    options: {
      zstringAddress?: number;
      zstringWords?: number[];
      abbreviations?: Array<{ index: number; text: number[] }>;
    } = {}
  ): Memory {
    const size = 0x1000;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Header
    view.setUint8(0x00, 3); // Version 3
    view.setUint16(0x0E, 0x100, false); // Static memory base
    view.setUint16(0x18, 0x40, false); // Abbreviations table at 0x40

    // Write Z-string if provided
    if (options.zstringAddress && options.zstringWords) {
      let addr = options.zstringAddress;
      for (const word of options.zstringWords) {
        view.setUint16(addr, word, false);
        addr += 2;
      }
    }

    // Write abbreviations if provided
    if (options.abbreviations) {
      for (const abbrev of options.abbreviations) {
        // Write word address to abbreviation table
        const abbrevTextAddr = 0x200 + abbrev.index * 0x10;
        view.setUint16(0x40 + abbrev.index * 2, abbrevTextAddr / 2, false);
        
        // Write abbreviation text
        let addr = abbrevTextAddr;
        for (const word of abbrev.text) {
          view.setUint16(addr, word, false);
          addr += 2;
        }
      }
    }

    return new Memory(buffer);
  }

  /**
   * Pack Z-characters into words
   * Each word contains 3 Z-chars, high bit set on last word
   */
  function packZChars(zchars: number[], markEnd: boolean = true): number[] {
    const words: number[] = [];
    for (let i = 0; i < zchars.length; i += 3) {
      const z1 = zchars[i] ?? 5; // Padding
      const z2 = zchars[i + 1] ?? 5;
      const z3 = zchars[i + 2] ?? 5;
      let word = ((z1 & 0x1F) << 10) | ((z2 & 0x1F) << 5) | (z3 & 0x1F);
      
      // Set end bit on last word
      if (markEnd && i + 3 >= zchars.length) {
        word |= 0x8000;
      }
      words.push(word);
    }
    return words;
  }

  describe('basic decoding', () => {
    it('should decode space (Z-char 0)', () => {
      // "a a" = z-chars: 6, 0, 6
      const words = packZChars([6, 0, 6]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('a a');
      expect(result.bytesConsumed).toBe(2);
    });

    it('should decode lowercase letters (A0)', () => {
      // "abc" = z-chars: 6, 7, 8
      const words = packZChars([6, 7, 8]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('abc');
    });

    it('should decode "hello"', () => {
      // h=13, e=10, l=17, l=17, o=20
      const words = packZChars([13, 10, 17, 17, 20]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('hello');
    });

    it('should handle multi-word strings', () => {
      // "abcdef" = 6, 7, 8, 9, 10, 11 (2 words)
      const words = packZChars([6, 7, 8, 9, 10, 11]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('abcdef');
      expect(result.bytesConsumed).toBe(4);
    });
  });

  describe('shift to uppercase (A1)', () => {
    it('should decode uppercase with shift', () => {
      // "A" = shift(4), z-char 6 (A in A1)
      const words = packZChars([4, 6]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('A');
    });

    it('should decode mixed case', () => {
      // "Hello" = shift, H, e, l, l, o
      // H=13 in A1, e=10, l=17, l=17, o=20
      const words = packZChars([4, 13, 10, 17, 17, 20]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('Hello');
    });

    it('should reset after single shift', () => {
      // "Ab" = shift, A(6), b(7) - b should be lowercase
      const words = packZChars([4, 6, 7]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('Ab');
    });
  });

  describe('shift to punctuation (A2)', () => {
    it('should decode newline', () => {
      // newline = shift(5), z-char 7 in A2
      const words = packZChars([5, 7]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('\n');
    });

    it('should decode digits', () => {
      // "0" = shift(5), z-char 8 in A2
      const words = packZChars([5, 8]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('0');
    });

    it('should decode punctuation', () => {
      // "." = shift(5), z-char 18 in A2
      const words = packZChars([5, 18]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('.');
    });
  });

  describe('10-bit ZSCII escape', () => {
    it('should decode escape sequence', () => {
      // Escape: shift(5), z-char 6, then high 5 bits, low 5 bits
      // ZSCII 65 = 'A' = 0b0100001 = high:2, low:1
      const words = packZChars([5, 6, 2, 1]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('A');
    });

    it('should decode extended character', () => {
      // ZSCII 155 = 'ä' = 0b10011011 = high:4, low:27
      const words = packZChars([5, 6, 4, 27]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('ä');
    });
  });

  describe('abbreviations', () => {
    it('should expand abbreviation', () => {
      // Abbreviation 0: "the"
      // t=25, h=13, e=10
      const theWords = packZChars([25, 13, 10]);
      
      // Main string: abbrev(1, 0) + space + "end"
      // z-char 1, index 0, then space(0), e(10), n(19), d(9)
      const mainWords = packZChars([1, 0, 0, 10, 19, 9]);
      
      const memory = createTestMemory({
        zstringAddress: 0x100,
        zstringWords: mainWords,
        abbreviations: [{ index: 0, text: theWords }],
      });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('the end');
    });

    it('should handle abbreviations from different banks', () => {
      // Bank 1 (z-char 1): index 0 = "one"
      // Bank 2 (z-char 2): index 0 = "two"
      const oneWords = packZChars([20, 19, 10]); // o, n, e
      const twoWords = packZChars([25, 28, 20]); // t, w, o
      
      // Main: abbrev(1,0), space, abbrev(2,0)
      // Note: z-char 2 starts bank 2, which is at index 32
      const mainWords = packZChars([1, 0, 0, 2, 0]);
      
      const memory = createTestMemory({
        zstringAddress: 0x100,
        zstringWords: mainWords,
        abbreviations: [
          { index: 0, text: oneWords },
          { index: 32, text: twoWords },
        ],
      });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('one two');
    });
  });

  describe('bytes consumed', () => {
    it('should report correct bytes for single word', () => {
      const words = packZChars([6, 7, 8]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.bytesConsumed).toBe(2);
    });

    it('should report correct bytes for multiple words', () => {
      const words = packZChars([6, 7, 8, 9, 10, 11, 12, 13, 14]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decode(0x100);

      expect(result.bytesConsumed).toBe(6); // 3 words
    });
  });

  describe('V1 specific', () => {
    it('should treat z-char 1 as newline in V1', () => {
      const words = packZChars([6, 1, 7]); // a, newline, b
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 1, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('a\nb');
    });
  });

  describe('V2 specific', () => {
    it('should use z-char 2 as shift lock to A1 in V2', () => {
      // Z-char 2 in V2 is shift-lock to A1 (uppercase)
      // 'a', shift-lock, 'A', 'B' -> "aAB"
      // In A0: a=6, in A1: A=6, B=7
      const words = packZChars([6, 2, 6, 7]); // 'a', shift-lock-A1, 'A', 'B'
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      // Set version to 2
      new DataView(memory['buffer']).setUint8(0x00, 2);
      const decoder = new ZCharDecoder(memory, 2, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('aAB');
    });

    it('should use z-char 3 as shift lock to A2 in V2', () => {
      // Z-char 3 in V2 is shift-lock to A2 (symbols)
      // 'a', shift-lock-A2, '0', '1' -> "a01"
      // In A0: a=6, in A2: 0=8, 1=9 (positions 2,3 + 6)
      const words = packZChars([6, 3, 8, 9]); // 'a', shift-lock-A2, '0', '1'
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      new DataView(memory['buffer']).setUint8(0x00, 2);
      const decoder = new ZCharDecoder(memory, 2, 0x40);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('a01');
    });
  });

  describe('setCustomAlphabets', () => {
    it('should use custom alphabet tables when set', () => {
      // Z-chars 6, 7, 8 would normally be 'a', 'b', 'c' in default A0
      // With custom alphabets, we'll map them to 'x', 'y', 'z' instead
      const words = packZChars([6, 7, 8]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 5, 0x40);

      // Custom alphabet: z-char 6 -> index 0, z-char 7 -> index 1, etc.
      // Position 0 = 'x', 1 = 'y', 2 = 'z', rest are normal letters
      const customA0 = 'xyzdefghijklmnopqrstuvwxyz';
      const customA1 = 'XYZDEFGHIJKLMNOPQRSTUVWXYZ';
      const customA2 = ' \n0123456789.,!?_#\'"~/\\-:()';
      decoder.setCustomAlphabets([customA0, customA1, customA2]);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('xyz');
    });

    it('should use custom A1 alphabet with shift', () => {
      // Shift to A1 (z-char 4), then z-char 6 which maps to 'X' in custom A1
      const words = packZChars([4, 6]);
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 5, 0x40);

      const customA0 = 'xyzdefghijklmnopqrstuvwxyz';
      const customA1 = 'XYZDEFGHIJKLMNOPQRSTUVWXYZ';
      const customA2 = ' \n0123456789.,!?_#\'"~/\\-:()';
      decoder.setCustomAlphabets([customA0, customA1, customA2]);

      const result = decoder.decode(0x100);

      expect(result.text).toBe('X');
    });
  });

  describe('decodeString', () => {
    it('should be an alias for decode', () => {
      const words = packZChars([6, 7, 8]); // "abc"
      const memory = createTestMemory({ zstringAddress: 0x100, zstringWords: words });
      const decoder = new ZCharDecoder(memory, 3, 0x40);

      const result = decoder.decodeString(0x100);

      expect(result.text).toBe('abc');
      expect(result.bytesConsumed).toBe(2);
    });
  });
});
