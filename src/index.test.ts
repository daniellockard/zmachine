/**
 * Tests for main barrel export file
 * 
 * Verifies all public exports are accessible from the main entry point.
 */

import { describe, it, expect } from 'vitest';
import {
  // Main VM class
  ZMachine,
  RunState,
  
  // I/O
  TestIOAdapter,
  
  // Memory access
  Memory,
  Header,
  unpackStringAddress,
  unpackRoutineAddress,
  toSigned16,
  toUnsigned16,
  
  // Text system
  ZCharDecoder,
  encodeText,
  encodeToZChars,
  zsciiToUnicode,
  unicodeToZscii,
  
  // Objects and properties
  ObjectTable,
  Properties,
  
  // Dictionary
  Dictionary,
  Tokenizer,
  
  // Web adapter
  WebIOAdapter,
} from './index';

describe('index barrel exports', () => {
  describe('Main VM class', () => {
    it('should export ZMachine', () => {
      expect(ZMachine).toBeDefined();
      expect(typeof ZMachine).toBe('function');
    });

    it('should export RunState enum', () => {
      expect(RunState).toBeDefined();
      expect(RunState.Stopped).toBeDefined();
      expect(RunState.Running).toBeDefined();
      expect(RunState.WaitingForInput).toBeDefined();
      expect(RunState.Halted).toBeDefined();
    });
  });

  describe('I/O adapters', () => {
    it('should export TestIOAdapter', () => {
      expect(TestIOAdapter).toBeDefined();
      expect(typeof TestIOAdapter).toBe('function');
    });
    
    it('should export WebIOAdapter', () => {
      expect(WebIOAdapter).toBeDefined();
      expect(typeof WebIOAdapter).toBe('function');
    });
  });

  describe('Memory access', () => {
    it('should export Memory', () => {
      expect(Memory).toBeDefined();
      expect(typeof Memory).toBe('function');
    });

    it('should export Header', () => {
      expect(Header).toBeDefined();
      expect(typeof Header).toBe('function');
    });

    it('should export address utilities', () => {
      expect(unpackStringAddress).toBeDefined();
      expect(typeof unpackStringAddress).toBe('function');
      
      expect(unpackRoutineAddress).toBeDefined();
      expect(typeof unpackRoutineAddress).toBe('function');
      
      expect(toSigned16).toBeDefined();
      expect(typeof toSigned16).toBe('function');
      
      expect(toUnsigned16).toBeDefined();
      expect(typeof toUnsigned16).toBe('function');
    });
  });

  describe('Text system', () => {
    it('should export ZCharDecoder', () => {
      expect(ZCharDecoder).toBeDefined();
      expect(typeof ZCharDecoder).toBe('function');
    });

    it('should export encoder functions', () => {
      expect(encodeText).toBeDefined();
      expect(typeof encodeText).toBe('function');
      
      expect(encodeToZChars).toBeDefined();
      expect(typeof encodeToZChars).toBe('function');
    });

    it('should export ZSCII conversion functions', () => {
      expect(zsciiToUnicode).toBeDefined();
      expect(typeof zsciiToUnicode).toBe('function');
      
      expect(unicodeToZscii).toBeDefined();
      expect(typeof unicodeToZscii).toBe('function');
    });
  });

  describe('Objects and properties', () => {
    it('should export ObjectTable', () => {
      expect(ObjectTable).toBeDefined();
      expect(typeof ObjectTable).toBe('function');
    });

    it('should export Properties', () => {
      expect(Properties).toBeDefined();
      expect(typeof Properties).toBe('function');
    });
  });

  describe('Dictionary', () => {
    it('should export Dictionary', () => {
      expect(Dictionary).toBeDefined();
      expect(typeof Dictionary).toBe('function');
    });

    it('should export Tokenizer', () => {
      expect(Tokenizer).toBeDefined();
      expect(typeof Tokenizer).toBe('function');
    });
  });

  describe('Functional usage', () => {
    it('should allow basic address utility operations', () => {
      // Test that exported functions work correctly
      expect(toSigned16(0x7FFF)).toBe(32767);
      expect(toSigned16(0x8000)).toBe(-32768);
      expect(toUnsigned16(-1)).toBe(0xFFFF);
    });

    it('should allow ZSCII conversion', () => {
      // Test basic ASCII range
      expect(zsciiToUnicode(65)).toBe('A');
      expect(unicodeToZscii('A')).toBe(65);
    });

    it('should allow text encoding', () => {
      // Test basic encoding
      const encoded = encodeText('test', 3);
      expect(Array.isArray(encoded)).toBe(true);
      expect(encoded.length).toBe(4); // V3 = 4 bytes
    });

    it('should allow TestIOAdapter instantiation', () => {
      const io = new TestIOAdapter();
      expect(io).toBeInstanceOf(TestIOAdapter);
      io.print('hello');
      expect(io.output).toContain('hello');
    });
  });
});
