/**
 * Tests for Tokenizer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Tokenizer } from './Tokenizer';
import { Dictionary } from './Dictionary';
import { Memory } from '../memory/Memory';

describe('Tokenizer', () => {
  /**
   * Create test memory with a dictionary
   */
  function createTestMemory(separators: string = '.,'): Memory {
    const size = 0x2000;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Header
    view.setUint8(0x00, 5); // Version 5
    view.setUint16(0x0E, 0x1000, false); // Static memory base

    // Dictionary at 0x100
    const dictBase = 0x100;
    
    // Word separators
    view.setUint8(dictBase, separators.length);
    for (let i = 0; i < separators.length; i++) {
      view.setUint8(dictBase + 1 + i, separators.charCodeAt(i));
    }
    
    // Entry length and count
    const headerLen = 1 + separators.length;
    view.setUint8(dictBase + headerLen, 9); // Entry length (6 bytes for word + 3 for data)
    view.setUint16(dictBase + headerLen + 1, 0, false); // 0 entries for now

    return new Memory(buffer);
  }

  function createDictionary(memory: Memory): Dictionary {
    return new Dictionary(memory, 5, 0x100);
  }

  let memory: Memory;
  let dictionary: Dictionary;
  let tokenizer: Tokenizer;

  beforeEach(() => {
    memory = createTestMemory();
    dictionary = createDictionary(memory);
    tokenizer = new Tokenizer(memory, 5, dictionary);
  });

  describe('tokenize', () => {
    it('should tokenize a single word', () => {
      const tokens = tokenizer.tokenize('hello');
      
      expect(tokens.length).toBe(1);
      expect(tokens[0].text).toBe('hello');
      expect(tokens[0].position).toBe(0);
      expect(tokens[0].length).toBe(5);
    });

    it('should tokenize multiple words', () => {
      const tokens = tokenizer.tokenize('go north');
      
      expect(tokens.length).toBe(2);
      expect(tokens[0].text).toBe('go');
      expect(tokens[0].position).toBe(0);
      expect(tokens[1].text).toBe('north');
      expect(tokens[1].position).toBe(3);
    });

    it('should skip multiple spaces', () => {
      const tokens = tokenizer.tokenize('go   north');
      
      expect(tokens.length).toBe(2);
      expect(tokens[0].text).toBe('go');
      expect(tokens[1].text).toBe('north');
    });

    it('should handle leading spaces', () => {
      const tokens = tokenizer.tokenize('  hello');
      
      expect(tokens.length).toBe(1);
      expect(tokens[0].text).toBe('hello');
      expect(tokens[0].position).toBe(2);
    });

    it('should handle trailing spaces', () => {
      const tokens = tokenizer.tokenize('hello  ');
      
      expect(tokens.length).toBe(1);
      expect(tokens[0].text).toBe('hello');
    });

    it('should convert to lowercase', () => {
      const tokens = tokenizer.tokenize('HELLO');
      
      expect(tokens[0].text).toBe('hello');
    });

    it('should return empty array for empty input', () => {
      const tokens = tokenizer.tokenize('');
      
      expect(tokens.length).toBe(0);
    });

    it('should return empty array for whitespace-only input', () => {
      const tokens = tokenizer.tokenize('   ');
      
      expect(tokens.length).toBe(0);
    });
  });

  describe('separators as tokens', () => {
    it('should treat separator as its own token', () => {
      const tokens = tokenizer.tokenize('hello,world');
      
      expect(tokens.length).toBe(3);
      expect(tokens[0].text).toBe('hello');
      expect(tokens[1].text).toBe(',');
      expect(tokens[1].length).toBe(1);
      expect(tokens[2].text).toBe('world');
    });

    it('should handle multiple separators', () => {
      const tokens = tokenizer.tokenize('a.b,c');
      
      expect(tokens.length).toBe(5);
      expect(tokens[0].text).toBe('a');
      expect(tokens[1].text).toBe('.');
      expect(tokens[2].text).toBe('b');
      expect(tokens[3].text).toBe(',');
      expect(tokens[4].text).toBe('c');
    });

    it('should handle separator at start', () => {
      const tokens = tokenizer.tokenize('.hello');
      
      expect(tokens.length).toBe(2);
      expect(tokens[0].text).toBe('.');
      expect(tokens[1].text).toBe('hello');
    });

    it('should handle separator at end', () => {
      const tokens = tokenizer.tokenize('hello.');
      
      expect(tokens.length).toBe(2);
      expect(tokens[0].text).toBe('hello');
      expect(tokens[1].text).toBe('.');
    });
  });

  describe('tokenizeBuffer', () => {
    it('should read from V5 text buffer format', () => {
      // V5: byte 0 = max, byte 1 = length, byte 2+ = text
      const textBuf = 0x500;
      const parseBuf = 0x600;
      
      memory.writeByte(textBuf, 100); // max chars
      memory.writeByte(textBuf + 1, 5); // actual length
      // Write "hello"
      memory.writeByte(textBuf + 2, 'h'.charCodeAt(0));
      memory.writeByte(textBuf + 3, 'e'.charCodeAt(0));
      memory.writeByte(textBuf + 4, 'l'.charCodeAt(0));
      memory.writeByte(textBuf + 5, 'l'.charCodeAt(0));
      memory.writeByte(textBuf + 6, 'o'.charCodeAt(0));
      
      memory.writeByte(parseBuf, 10); // max tokens
      
      tokenizer.tokenizeBuffer(textBuf, parseBuf);
      
      // Check token count
      expect(memory.readByte(parseBuf + 1)).toBe(1);
      
      // Check token length
      expect(memory.readByte(parseBuf + 2 + 2)).toBe(5);
    });

    it('should handle skipUnknown flag', () => {
      const textBuf = 0x500;
      const parseBuf = 0x600;
      
      memory.writeByte(textBuf, 100);
      memory.writeByte(textBuf + 1, 9); // "go xyzzy" - xyzzy not in dict
      const text = 'go xyzzy';
      for (let i = 0; i < text.length; i++) {
        memory.writeByte(textBuf + 2 + i, text.charCodeAt(i));
      }
      
      memory.writeByte(parseBuf, 10);
      
      // Without skipUnknown, both tokens are stored
      tokenizer.tokenizeBuffer(textBuf, parseBuf, 0, false);
      expect(memory.readByte(parseBuf + 1)).toBe(2);
      
      // With skipUnknown, only known tokens (none here) are stored
      memory.writeByte(parseBuf + 1, 0); // Reset
      tokenizer.tokenizeBuffer(textBuf, parseBuf, 0, true);
      expect(memory.readByte(parseBuf + 1)).toBe(0);
    });

    it('should respect max tokens limit', () => {
      const textBuf = 0x500;
      const parseBuf = 0x600;
      
      memory.writeByte(textBuf, 100);
      memory.writeByte(textBuf + 1, 5); // "a b c"
      const text = 'a b c';
      for (let i = 0; i < text.length; i++) {
        memory.writeByte(textBuf + 2 + i, text.charCodeAt(i));
      }
      
      memory.writeByte(parseBuf, 2); // max 2 tokens
      
      tokenizer.tokenizeBuffer(textBuf, parseBuf);
      
      // Should only store 2 tokens even though there are 3 words
      expect(memory.readByte(parseBuf + 1)).toBe(2);
    });
  });

  describe('V4 text buffer format', () => {
    it('should read from V4 null-terminated text buffer', () => {
      // Create V4 memory
      const v4Memory = createTestMemory();
      new DataView(v4Memory['buffer']).setUint8(0x00, 4);
      const v4Dict = new Dictionary(v4Memory, 4, 0x100);
      const v4Tokenizer = new Tokenizer(v4Memory, 4, v4Dict);
      
      const textBuf = 0x500;
      const parseBuf = 0x600;
      
      v4Memory.writeByte(textBuf, 100); // max chars
      // Write "test" null-terminated at byte 1
      v4Memory.writeByte(textBuf + 1, 't'.charCodeAt(0));
      v4Memory.writeByte(textBuf + 2, 'e'.charCodeAt(0));
      v4Memory.writeByte(textBuf + 3, 's'.charCodeAt(0));
      v4Memory.writeByte(textBuf + 4, 't'.charCodeAt(0));
      v4Memory.writeByte(textBuf + 5, 0); // null terminator
      
      v4Memory.writeByte(parseBuf, 10);
      
      v4Tokenizer.tokenizeBuffer(textBuf, parseBuf);
      
      expect(v4Memory.readByte(parseBuf + 1)).toBe(1);
      expect(v4Memory.readByte(parseBuf + 2 + 2)).toBe(4); // length
    });
  });

  describe('custom dictionary', () => {
    it('should use custom dictionary when dictionaryAddr is provided', () => {
      // Create a custom dictionary at a different address
      const customDictAddr = 0x300;
      const customSeparators = '!';
      
      // Set up custom dictionary header
      memory.writeByte(customDictAddr, customSeparators.length);
      memory.writeByte(customDictAddr + 1, '!'.charCodeAt(0));
      
      // Entry length and count
      const headerLen = 1 + customSeparators.length;
      memory.writeByte(customDictAddr + headerLen, 9); // Entry length
      memory.writeWord(customDictAddr + headerLen + 1, 0); // 0 entries
      
      const textBuf = 0x500;
      const parseBuf = 0x600;
      
      // Write "hello!world" to text buffer
      memory.writeByte(textBuf, 100);
      memory.writeByte(textBuf + 1, 11);
      const text = 'hello!world';
      for (let i = 0; i < text.length; i++) {
        memory.writeByte(textBuf + 2 + i, text.charCodeAt(i));
      }
      
      memory.writeByte(parseBuf, 10);
      
      // Use custom dictionary - '!' is separator in custom dict but not in default
      tokenizer.tokenizeBuffer(textBuf, parseBuf, customDictAddr);
      
      // Should have 3 tokens: hello, !, world
      expect(memory.readByte(parseBuf + 1)).toBe(3);
    });
  });

  describe('tokenizeBuffer with separators', () => {
    it('should tokenize separators in tokenizeBuffer', () => {
      const textBuf = 0x500;
      const parseBuf = 0x600;
      
      // Write "go.north" - contains separator
      memory.writeByte(textBuf, 100);
      memory.writeByte(textBuf + 1, 8);
      const text = 'go.north';
      for (let i = 0; i < text.length; i++) {
        memory.writeByte(textBuf + 2 + i, text.charCodeAt(i));
      }
      
      memory.writeByte(parseBuf, 10);
      
      tokenizer.tokenizeBuffer(textBuf, parseBuf);
      
      // Should have 3 tokens: go, ., north
      expect(memory.readByte(parseBuf + 1)).toBe(3);
      
      // Verify the second token is the separator with length 1
      expect(memory.readByte(parseBuf + 2 + 4 + 2)).toBe(1); // token[1].length
    });

    it('should handle multiple consecutive separators in tokenizeBuffer', () => {
      const textBuf = 0x500;
      const parseBuf = 0x600;
      
      // Write "a.,b" - multiple separators
      memory.writeByte(textBuf, 100);
      memory.writeByte(textBuf + 1, 4);
      const text = 'a.,b';
      for (let i = 0; i < text.length; i++) {
        memory.writeByte(textBuf + 2 + i, text.charCodeAt(i));
      }
      
      memory.writeByte(parseBuf, 10);
      
      tokenizer.tokenizeBuffer(textBuf, parseBuf);
      
      // Should have 4 tokens: a, ., ,, b
      expect(memory.readByte(parseBuf + 1)).toBe(4);
    });

    it('should handle input ending with spaces in tokenizeBuffer', () => {
      const textBuf = 0x500;
      const parseBuf = 0x600;
      
      // Write "hello   " - word followed by trailing spaces
      memory.writeByte(textBuf, 100);
      memory.writeByte(textBuf + 1, 8);
      const text = 'hello   ';
      for (let i = 0; i < text.length; i++) {
        memory.writeByte(textBuf + 2 + i, text.charCodeAt(i));
      }
      
      memory.writeByte(parseBuf, 10);
      
      tokenizer.tokenizeBuffer(textBuf, parseBuf);
      
      // Should have 1 token: hello
      expect(memory.readByte(parseBuf + 1)).toBe(1);
    });
  });
});
