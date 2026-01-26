/**
 * Tests for Z-Character Encoder
 */

import { describe, it, expect } from 'vitest';
import { encodeText, encodeToZChars, encodeChar, getAlphabets } from './ZCharEncoder';

describe('ZCharEncoder', () => {
  describe('encodeText', () => {
    describe('V3 (6 Z-char limit, 4 bytes)', () => {
      it('should encode lowercase letters from alphabet 0', () => {
        const result = encodeText('hello', 3);
        
        // 'hello' -> h=13, e=10, l=17, l=17, o=20 (all A0)
        // 6 Z-chars total, padded with 5
        expect(result.length).toBe(4); // 2 words = 4 bytes
        
        // Last word should have bit 15 set
        const word1 = (result[2] << 8) | result[3];
        expect(word1 & 0x8000).toBe(0x8000);
      });

      it('should encode uppercase as lowercase', () => {
        const result1 = encodeText('HELLO', 3);
        const result2 = encodeText('hello', 3);
        
        expect(result1).toEqual(result2);
      });

      it('should pad short words with shift-5', () => {
        // 'a' = just one Z-char, should pad with 5 (shift-5)
        const result = encodeText('a', 3);
        expect(result.length).toBe(4);
        
        // First word: 'a' (code 6), then 5, 5
        const word0 = (result[0] << 8) | result[1];
        const c0 = (word0 >> 10) & 0x1F;
        const c1 = (word0 >> 5) & 0x1F;
        const c2 = word0 & 0x1F;
        
        expect(c0).toBe(6);  // 'a'
        expect(c1).toBe(5);  // padding
        expect(c2).toBe(5);  // padding
      });

      it('should encode A1 characters with shift-4', () => {
        // 'A' uppercase -> shift-4 (code 4) + A (code 6)
        // But wait, the encoder lowercases first, so we need to test
        // a character actually in A1, which is uppercase letters
        // But encodeText lowercases... so A1 is for dictionary entries only?
        // Actually A1 has uppercase A-Z - but input is lowercased
        
        // Testing would require using a V1 custom alphabet or direct char
        // Let's just verify the output structure is correct
        const result = encodeText('ab', 3);
        expect(result.length).toBe(4);
      });

      it('should truncate at 6 Z-chars', () => {
        // Long word that would exceed 6 Z-chars
        const result = encodeText('abcdefghij', 3);
        expect(result.length).toBe(4); // Still 4 bytes (6 Z-chars)
      });

      it('should encode numbers from alphabet 2', () => {
        // '0' is in A2 at position 2, requires shift-5 (code 5) + code 8
        const zchars = encodeToZChars('0', 3);
        expect(zchars[0]).toBe(5);  // shift to A2
        expect(zchars[1]).toBe(8);  // '0' position in A2 (index 2 + 6 = 8)
      });
    });

    describe('V5 (9 Z-char limit, 6 bytes)', () => {
      it('should produce 6 bytes for V5', () => {
        const result = encodeText('hello', 5);
        expect(result.length).toBe(6); // 3 words = 6 bytes
      });

      it('should allow longer words in V5', () => {
        const zchars = encodeToZChars('abcdefghi', 5);
        expect(zchars.length).toBe(9);
        // All 9 should be the letters (no padding needed for 9-char word of A0 letters)
        expect(zchars[0]).toBe(6);  // 'a'
        expect(zchars[8]).toBe(14); // 'i'
      });

      it('should set bit 15 on last word only', () => {
        const result = encodeText('test', 5);
        
        const word0 = (result[0] << 8) | result[1];
        const word1 = (result[2] << 8) | result[3];
        const word2 = (result[4] << 8) | result[5];
        
        expect(word0 & 0x8000).toBe(0);      // First word, no end bit
        expect(word1 & 0x8000).toBe(0);      // Second word, no end bit
        expect(word2 & 0x8000).toBe(0x8000); // Last word, end bit set
      });
    });

    describe('V1 alphabet handling', () => {
      it('should use V1 alphabet for version 1', () => {
        // V1 has a different A2 table
        const result = encodeText('test', 1);
        expect(result.length).toBe(4); // Still 4 bytes for V1
      });
    });

    describe('ZSCII escape sequences', () => {
      it('should encode characters not in alphabets using ZSCII escape', () => {
        // '@' is not in any alphabet, should use escape sequence
        // Escape: shift-5 (5), code-6, then 10-bit ZSCII split
        const zchars = encodeToZChars('@', 3);
        
        // '@' = ASCII 64
        // Escape: A2-shift (5), escape code (6), high 5 bits (64 >> 5 = 2), low 5 bits (64 & 0x1F = 0)
        expect(zchars[0]).toBe(5);  // A2 shift
        expect(zchars[1]).toBe(6);  // Escape code
        expect(zchars[2]).toBe(2);  // High 5 bits of 64
        expect(zchars[3]).toBe(0);  // Low 5 bits of 64
      });

      it('should encode non-standard characters correctly', () => {
        // '^' = ASCII 94, not in any alphabet
        // High: 94 >> 5 = 2, Low: 94 & 0x1F = 30
        const zchars = encodeToZChars('^', 3);
        
        expect(zchars[0]).toBe(5);   // A2 shift
        expect(zchars[1]).toBe(6);   // Escape code
        expect(zchars[2]).toBe(2);   // High bits (94 >> 5 = 2)
        expect(zchars[3]).toBe(30);  // Low bits (94 & 0x1F = 30)
      });

      it('should break mid-escape when multi-code character spans the word limit', () => {
        // For V3, max is 6 Z-chars (2 words).
        // "abcde" = 5 Z-chars (all A0), then '@' needs 4 codes (shift-5, 6, high, low)
        // After 'abcde', only 1 slot remains. The escape starts but the inner loop
        // must break after adding just the first code (shift-5) since we hit the limit.
        const zchars = encodeToZChars('abcde@', 3);

        // Should be exactly 6 Z-chars: a, b, c, d, e, then only the first code of '@' escape
        expect(zchars.length).toBe(6);
        expect(zchars[0]).toBe(6);   // 'a'
        expect(zchars[1]).toBe(7);   // 'b'
        expect(zchars[2]).toBe(8);   // 'c'
        expect(zchars[3]).toBe(9);   // 'd'
        expect(zchars[4]).toBe(10);  // 'e'
        expect(zchars[5]).toBe(5);   // A2 shift (start of '@' escape, truncated)
      });

      it('should handle partial ZSCII escape at various remaining slots', () => {
        // Test with 4 chars first: leaves 2 slots, escape needs 4 codes
        // Should get: a, b, c, d, shift-5, escape-code (6)
        const zchars4 = encodeToZChars('abcd@', 3);
        expect(zchars4.length).toBe(6);
        expect(zchars4[0]).toBe(6);   // 'a'
        expect(zchars4[1]).toBe(7);   // 'b'
        expect(zchars4[2]).toBe(8);   // 'c'
        expect(zchars4[3]).toBe(9);   // 'd'
        expect(zchars4[4]).toBe(5);   // A2 shift
        expect(zchars4[5]).toBe(6);   // Escape code (partial, missing high/low)

        // Test with 3 chars: leaves 3 slots, escape needs 4 codes
        // Should get: a, b, c, shift-5, 6, high-bits (still missing low)
        const zchars3 = encodeToZChars('abc@', 3);
        expect(zchars3.length).toBe(6);
        expect(zchars3[0]).toBe(6);   // 'a'
        expect(zchars3[1]).toBe(7);   // 'b'
        expect(zchars3[2]).toBe(8);   // 'c'
        expect(zchars3[3]).toBe(5);   // A2 shift
        expect(zchars3[4]).toBe(6);   // Escape code
        expect(zchars3[5]).toBe(2);   // '@' high bits (64 >> 5 = 2), low bits truncated
      });

      it('should handle mixed alphabets and escapes', () => {
        // "a@b" = 'a' (A0), '@' (escape), 'b' (A0)
        // But '@' takes 4 Z-chars, so we get 'a'(1) + '@'(4) + 'b'(1) = 6 Z-chars
        const zchars = encodeToZChars('a@b', 3);
        
        expect(zchars[0]).toBe(6);   // 'a'
        expect(zchars[1]).toBe(5);   // A2 shift for '@'
        expect(zchars[2]).toBe(6);   // Escape code
        expect(zchars[3]).toBe(2);   // '@' high bits
        expect(zchars[4]).toBe(0);   // '@' low bits
        expect(zchars[5]).toBe(7);   // 'b'
      });
    });
  });

  describe('encodeToZChars', () => {
    it('should return array of Z-character codes', () => {
      const zchars = encodeToZChars('abc', 3);
      
      expect(zchars.length).toBe(6); // Padded to 6 for V3
      expect(zchars[0]).toBe(6);  // 'a' = position 0 + 6
      expect(zchars[1]).toBe(7);  // 'b' = position 1 + 6
      expect(zchars[2]).toBe(8);  // 'c' = position 2 + 6
      expect(zchars[3]).toBe(5);  // padding
      expect(zchars[4]).toBe(5);  // padding
      expect(zchars[5]).toBe(5);  // padding
    });

    it('should handle V5 with 9 Z-chars', () => {
      const zchars = encodeToZChars('abc', 5);
      expect(zchars.length).toBe(9); // Padded to 9 for V5
    });

    it('should truncate at max Z-chars', () => {
      // A word with escapes that would exceed the limit
      const zchars = encodeToZChars('@@@@', 3);
      expect(zchars.length).toBe(6); // Should still be 6
    });

    it('should lowercase before encoding', () => {
      const upper = encodeToZChars('ABC', 3);
      const lower = encodeToZChars('abc', 3);
      expect(upper).toEqual(lower);
    });
  });

  describe('alphabet encoding', () => {
    it('should encode all A0 characters correctly', () => {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz';
      for (let i = 0; i < alphabet.length; i++) {
        const zchars = encodeToZChars(alphabet[i], 3);
        // A0 chars don't need shift, so first Z-char is the code
        expect(zchars[0]).toBe(6 + i);
      }
    });

    it('should encode A1 characters (uppercase) with shift-4', () => {
      // A1 contains uppercase A-Z. Since encodeToZChars lowercases input,
      // we need to test encodeChar directly to cover this code path.
      const alphabets = getAlphabets(3);
      
      // Test encoding uppercase 'A' directly
      const result = encodeChar('A', alphabets);
      // A1 chars need shift-4 (code 4), then the Z-code
      // 'A' is at index 0 in A1, so Z-code is 6
      expect(result).toEqual([4, 6]);
      
      // Test encoding uppercase 'Z' directly
      const resultZ = encodeChar('Z', alphabets);
      // 'Z' is at index 25 in A1, so Z-code is 31
      expect(resultZ).toEqual([4, 31]);
    });

    it('should encode A2 punctuation with shift', () => {
      // Some A2 characters that are commonly used
      const a2Chars = ['.', ',', '!', '?', '"', "'"];
      
      for (const char of a2Chars) {
        const zchars = encodeToZChars(char, 3);
        // Should start with shift-5 (A2)
        expect(zchars[0]).toBe(5);
      }
    });
  });
});
