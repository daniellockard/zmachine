/**
 * Tests for Dictionary and Tokenizer modules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Dictionary } from './Dictionary';
import { Tokenizer } from './Tokenizer';
import { Memory } from '../memory/Memory';
import { encodeText } from '../text/ZCharEncoder';

describe('Dictionary', () => {
  let memory: Memory;

  function createTestMemory(): Memory {
    const size = 0x10000;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Header
    view.setUint8(0x00, 3); // Version 3
    view.setUint16(0x08, 0x200, false); // Dictionary at 0x200
    view.setUint16(0x0E, 0x8000, false); // Static memory

    return new Memory(buffer);
  }

  function setupV3Dictionary(mem: Memory): void {
    const dictAddr = 0x200;
    let offset = dictAddr;

    // Word separators: 3 characters: '.', ',', '"'
    mem.writeByte(offset++, 3);
    mem.writeByte(offset++, '.'.charCodeAt(0));
    mem.writeByte(offset++, ','.charCodeAt(0));
    mem.writeByte(offset++, '"'.charCodeAt(0));

    // Entry length: 7 bytes (4 word + 3 data)
    mem.writeByte(offset++, 7);

    // Number of entries: 5
    mem.writeWord(offset, 5);
    offset += 2;

    // Dictionary entries (must be sorted!)
    // Each entry: 4 bytes encoded word + 3 bytes data
    const words = ['go', 'look', 'north', 'take', 'west'];

    for (let i = 0; i < words.length; i++) {
      const encoded = encodeText(words[i], 3);
      for (const byte of encoded) {
        mem.writeByte(offset++, byte);
      }
      // 3 bytes of data (unused in this test)
      mem.writeByte(offset++, 0);
      mem.writeByte(offset++, 0);
      mem.writeByte(offset++, 0);
    }
  }

  beforeEach(() => {
    memory = createTestMemory();
    setupV3Dictionary(memory);
  });

  describe('construction', () => {
    it('should parse dictionary header', () => {
      const dict = new Dictionary(memory, 3, 0x200);

      expect(dict.separators).toBe('.,\"');
      expect(dict.entryLength).toBe(7);
      expect(dict.entryCount).toBe(5);
      expect(dict.wordBytes).toBe(4);
    });

    it('should identify separators', () => {
      const dict = new Dictionary(memory, 3, 0x200);

      expect(dict.isSeparator('.')).toBe(true);
      expect(dict.isSeparator(',')).toBe(true);
      expect(dict.isSeparator('"')).toBe(true);
      expect(dict.isSeparator(' ')).toBe(false);
      expect(dict.isSeparator('a')).toBe(false);
    });
  });

  describe('lookup', () => {
    it('should find existing word', () => {
      const dict = new Dictionary(memory, 3, 0x200);
      const encoded = encodeText('look', 3);

      const addr = dict.lookup(encoded);
      expect(addr).toBeGreaterThan(0);
    });

    it('should find first word', () => {
      const dict = new Dictionary(memory, 3, 0x200);
      const encoded = encodeText('go', 3);

      const addr = dict.lookup(encoded);
      expect(addr).toBeGreaterThan(0);
    });

    it('should find last word', () => {
      const dict = new Dictionary(memory, 3, 0x200);
      const encoded = encodeText('west', 3);

      const addr = dict.lookup(encoded);
      expect(addr).toBeGreaterThan(0);
    });

    it('should return 0 for non-existent word', () => {
      const dict = new Dictionary(memory, 3, 0x200);
      const encoded = encodeText('xyzzy', 3);

      const addr = dict.lookup(encoded);
      expect(addr).toBe(0);
    });

    it('should return entry info', () => {
      const dict = new Dictionary(memory, 3, 0x200);
      const encoded = encodeText('north', 3);

      const entry = dict.lookupEntry(encoded);
      expect(entry.address).toBeGreaterThan(0);
      expect(entry.index).toBe(2); // "north" is 3rd word (index 2)
    });
  });

  describe('iteration', () => {
    it('should iterate over all entries', () => {
      const dict = new Dictionary(memory, 3, 0x200);
      const entries = [...dict.entries()];

      expect(entries.length).toBe(5);
      expect(entries[0].index).toBe(0);
      expect(entries[4].index).toBe(4);
    });
  });
});

describe('Tokenizer', () => {
  let memory: Memory;
  let dictionary: Dictionary;

  function createTestMemory(): Memory {
    const size = 0x10000;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Header
    view.setUint8(0x00, 3); // Version 3
    view.setUint16(0x08, 0x200, false); // Dictionary at 0x200
    view.setUint16(0x0E, 0x8000, false); // Static memory

    return new Memory(buffer);
  }

  function setupV3Dictionary(mem: Memory): void {
    const dictAddr = 0x200;
    let offset = dictAddr;

    // Word separators: '.' and ','
    mem.writeByte(offset++, 2);
    mem.writeByte(offset++, '.'.charCodeAt(0));
    mem.writeByte(offset++, ','.charCodeAt(0));

    // Entry length: 7 bytes
    mem.writeByte(offset++, 7);

    // Number of entries: 4
    mem.writeWord(offset, 4);
    offset += 2;

    // Dictionary entries
    const words = ['go', 'look', 'north', 'take'];

    for (let i = 0; i < words.length; i++) {
      const encoded = encodeText(words[i], 3);
      for (const byte of encoded) {
        mem.writeByte(offset++, byte);
      }
      mem.writeByte(offset++, 0);
      mem.writeByte(offset++, 0);
      mem.writeByte(offset++, 0);
    }
  }

  beforeEach(() => {
    memory = createTestMemory();
    setupV3Dictionary(memory);
    dictionary = new Dictionary(memory, 3, 0x200);
  });

  describe('tokenization', () => {
    it('should tokenize simple input', () => {
      const tokenizer = new Tokenizer(memory, 3, dictionary);
      const tokens = tokenizer.tokenize('look north');

      expect(tokens.length).toBe(2);
      expect(tokens[0].text).toBe('look');
      expect(tokens[0].dictionaryAddress).toBeGreaterThan(0);
      expect(tokens[1].text).toBe('north');
      expect(tokens[1].dictionaryAddress).toBeGreaterThan(0);
    });

    it('should handle unknown words', () => {
      const tokenizer = new Tokenizer(memory, 3, dictionary);
      const tokens = tokenizer.tokenize('look xyzzy');

      expect(tokens.length).toBe(2);
      expect(tokens[0].dictionaryAddress).toBeGreaterThan(0);
      expect(tokens[1].text).toBe('xyzzy');
      expect(tokens[1].dictionaryAddress).toBe(0);
    });

    it('should tokenize separators as individual tokens', () => {
      const tokenizer = new Tokenizer(memory, 3, dictionary);
      const tokens = tokenizer.tokenize('look.north');

      expect(tokens.length).toBe(3);
      expect(tokens[0].text).toBe('look');
      expect(tokens[1].text).toBe('.');
      expect(tokens[2].text).toBe('north');
    });

    it('should track word positions', () => {
      const tokenizer = new Tokenizer(memory, 3, dictionary);
      const tokens = tokenizer.tokenize('go north');

      expect(tokens[0].position).toBe(0);
      expect(tokens[0].length).toBe(2);
      expect(tokens[1].position).toBe(3);
      expect(tokens[1].length).toBe(5);
    });

    it('should handle multiple spaces', () => {
      const tokenizer = new Tokenizer(memory, 3, dictionary);
      const tokens = tokenizer.tokenize('look   north');

      expect(tokens.length).toBe(2);
      expect(tokens[0].text).toBe('look');
      expect(tokens[1].text).toBe('north');
    });

    it('should handle empty input', () => {
      const tokenizer = new Tokenizer(memory, 3, dictionary);
      const tokens = tokenizer.tokenize('');

      expect(tokens.length).toBe(0);
    });
  });
});

describe('ZCharEncoder', () => {
  it('should encode simple word', () => {
    const encoded = encodeText('look', 3);
    expect(encoded.length).toBe(4); // 4 bytes for V3
  });

  it('should pad short words', () => {
    const encoded = encodeText('go', 3);
    expect(encoded.length).toBe(4);
  });

  it('should truncate long words', () => {
    const encoded = encodeText('encyclopedia', 3);
    expect(encoded.length).toBe(4);
  });

  it('should encode same word consistently', () => {
    const enc1 = encodeText('north', 3);
    const enc2 = encodeText('north', 3);

    expect(enc1).toEqual(enc2);
  });

  it('should distinguish different words', () => {
    const enc1 = encodeText('north', 3);
    const enc2 = encodeText('south', 3);

    expect(enc1).not.toEqual(enc2);
  });
});
