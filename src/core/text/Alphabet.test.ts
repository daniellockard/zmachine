/**
 * Tests for Alphabet module
 */

import { describe, it, expect } from 'vitest';
import {
  getAlphabetChar,
  getShiftedAlphabet,
  isShiftChar,
  isAbbreviationChar,
  getAbbreviationIndex,
  ALPHABET_A0,
  ALPHABET_A1,
  ALPHABET_A2,
} from './Alphabet';

describe('Alphabet', () => {
  describe('getAlphabetChar', () => {
    describe('A0 (lowercase)', () => {
      it('should return lowercase letters', () => {
        expect(getAlphabetChar(6, 0, 3)).toBe('a');
        expect(getAlphabetChar(7, 0, 3)).toBe('b');
        expect(getAlphabetChar(31, 0, 3)).toBe('z');
      });

      it('should return null for special chars 0-5', () => {
        for (let i = 0; i < 6; i++) {
          expect(getAlphabetChar(i, 0, 3)).toBeNull();
        }
      });
    });

    describe('A1 (uppercase)', () => {
      it('should return uppercase letters', () => {
        expect(getAlphabetChar(6, 1, 3)).toBe('A');
        expect(getAlphabetChar(7, 1, 3)).toBe('B');
        expect(getAlphabetChar(31, 1, 3)).toBe('Z');
      });
    });

    describe('A2 (punctuation)', () => {
      it('should return punctuation for V3+', () => {
        // Z-char 7 in A2 = newline (index 1 in table)
        expect(getAlphabetChar(7, 2, 3)).toBe('\n');
        // Z-char 8 = '0' (index 2)
        expect(getAlphabetChar(8, 2, 3)).toBe('0');
        // Z-char 17 = '9' (index 11)
        expect(getAlphabetChar(17, 2, 3)).toBe('9');
        // Punctuation
        expect(getAlphabetChar(18, 2, 3)).toBe('.');
        expect(getAlphabetChar(19, 2, 3)).toBe(',');
      });

      it('should return null for Z-char 6 (escape)', () => {
        expect(getAlphabetChar(6, 2, 3)).toBeNull();
      });
    });

    describe('custom alphabets', () => {
      it('should use custom alphabets when provided', () => {
        const custom: [string, string, string] = [
          'zyxwvutsrqponmlkjihgfedcba', // Reversed lowercase
          'ZYXWVUTSRQPONMLKJIHGFEDCBA', // Reversed uppercase
          ' \n9876543210.,!?_#\'"/\\-:()',
        ];
        
        expect(getAlphabetChar(6, 0, 3, custom)).toBe('z');
        expect(getAlphabetChar(6, 1, 3, custom)).toBe('Z');
      });
    });
  });

  describe('getShiftedAlphabet', () => {
    describe('V3+', () => {
      it('should shift to A1 with Z-char 4', () => {
        expect(getShiftedAlphabet(0, 4, 3)).toBe(1);
        expect(getShiftedAlphabet(1, 4, 3)).toBe(1);
        expect(getShiftedAlphabet(2, 4, 3)).toBe(1);
      });

      it('should shift to A2 with Z-char 5', () => {
        expect(getShiftedAlphabet(0, 5, 3)).toBe(2);
        expect(getShiftedAlphabet(1, 5, 3)).toBe(2);
        expect(getShiftedAlphabet(2, 5, 3)).toBe(2);
      });
    });

    describe('V1-2 (wrapping shifts)', () => {
      it('should shift up (4) cyclically', () => {
        expect(getShiftedAlphabet(0, 4, 2)).toBe(1); // 0 -> 1
        expect(getShiftedAlphabet(1, 4, 2)).toBe(2); // 1 -> 2
        expect(getShiftedAlphabet(2, 4, 2)).toBe(0); // 2 -> 0
      });

      it('should shift down (5) cyclically', () => {
        expect(getShiftedAlphabet(0, 5, 2)).toBe(2); // 0 -> 2
        expect(getShiftedAlphabet(1, 5, 2)).toBe(0); // 1 -> 0
        expect(getShiftedAlphabet(2, 5, 2)).toBe(1); // 2 -> 1
      });
    });
  });

  describe('isShiftChar', () => {
    describe('V3+', () => {
      it('should return true for 4 and 5', () => {
        expect(isShiftChar(4, 3)).toBe(true);
        expect(isShiftChar(5, 3)).toBe(true);
      });

      it('should return false for other chars', () => {
        expect(isShiftChar(0, 3)).toBe(false);
        expect(isShiftChar(1, 3)).toBe(false);
        expect(isShiftChar(2, 3)).toBe(false);
        expect(isShiftChar(3, 3)).toBe(false);
        expect(isShiftChar(6, 3)).toBe(false);
      });
    });

    describe('V1-2', () => {
      it('should return true for 2-5', () => {
        expect(isShiftChar(2, 2)).toBe(true);
        expect(isShiftChar(3, 2)).toBe(true);
        expect(isShiftChar(4, 2)).toBe(true);
        expect(isShiftChar(5, 2)).toBe(true);
      });

      it('should return false for 0-1 and 6+', () => {
        expect(isShiftChar(0, 2)).toBe(false);
        expect(isShiftChar(1, 2)).toBe(false);
        expect(isShiftChar(6, 2)).toBe(false);
      });
    });
  });

  describe('isAbbreviationChar', () => {
    it('should return false for V1', () => {
      expect(isAbbreviationChar(1, 1)).toBe(false);
      expect(isAbbreviationChar(2, 1)).toBe(false);
      expect(isAbbreviationChar(3, 1)).toBe(false);
    });

    it('should return true only for 1 in V2', () => {
      expect(isAbbreviationChar(1, 2)).toBe(true);
      expect(isAbbreviationChar(2, 2)).toBe(false);
      expect(isAbbreviationChar(3, 2)).toBe(false);
    });

    it('should return true for 1-3 in V3+', () => {
      expect(isAbbreviationChar(1, 3)).toBe(true);
      expect(isAbbreviationChar(2, 3)).toBe(true);
      expect(isAbbreviationChar(3, 3)).toBe(true);
      expect(isAbbreviationChar(0, 3)).toBe(false);
      expect(isAbbreviationChar(4, 3)).toBe(false);
    });
  });

  describe('getAbbreviationIndex', () => {
    it('should calculate correct index', () => {
      // First abbreviation bank (z-char 1)
      expect(getAbbreviationIndex(1, 0)).toBe(0);
      expect(getAbbreviationIndex(1, 31)).toBe(31);
      
      // Second abbreviation bank (z-char 2)
      expect(getAbbreviationIndex(2, 0)).toBe(32);
      expect(getAbbreviationIndex(2, 31)).toBe(63);
      
      // Third abbreviation bank (z-char 3)
      expect(getAbbreviationIndex(3, 0)).toBe(64);
      expect(getAbbreviationIndex(3, 31)).toBe(95);
    });
  });

  describe('alphabet tables', () => {
    it('should have 26 characters in A0', () => {
      expect(ALPHABET_A0).toHaveLength(26);
    });

    it('should have 26 characters in A1', () => {
      expect(ALPHABET_A1).toHaveLength(26);
    });

    it('should have 26 characters in A2', () => {
      expect(ALPHABET_A2).toHaveLength(26);
    });

    it('should have A0 as lowercase alphabet', () => {
      expect(ALPHABET_A0).toBe('abcdefghijklmnopqrstuvwxyz');
    });

    it('should have A1 as uppercase alphabet', () => {
      expect(ALPHABET_A1).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });
  });
});
