/**
 * Tests for ZSCII module
 */

import { describe, it, expect } from 'vitest';
import {
  zsciiToUnicode,
  unicodeToZscii,
  isZsciiPrintable,
  isZsciiTerminator,
  ZSCII,
} from './ZSCII';

describe('ZSCII', () => {
  describe('zsciiToUnicode', () => {
    it('should return empty string for null', () => {
      expect(zsciiToUnicode(ZSCII.NULL)).toBe('');
    });

    it('should convert newline', () => {
      expect(zsciiToUnicode(ZSCII.NEWLINE)).toBe('\n');
    });

    it('should convert standard ASCII', () => {
      expect(zsciiToUnicode(32)).toBe(' ');
      expect(zsciiToUnicode(65)).toBe('A');
      expect(zsciiToUnicode(97)).toBe('a');
      expect(zsciiToUnicode(48)).toBe('0');
      expect(zsciiToUnicode(126)).toBe('~');
    });

    it('should convert common punctuation', () => {
      expect(zsciiToUnicode(46)).toBe('.');
      expect(zsciiToUnicode(44)).toBe(',');
      expect(zsciiToUnicode(33)).toBe('!');
      expect(zsciiToUnicode(63)).toBe('?');
    });

    it('should convert extra characters', () => {
      expect(zsciiToUnicode(155)).toBe('ä');
      expect(zsciiToUnicode(156)).toBe('ö');
      expect(zsciiToUnicode(157)).toBe('ü');
      expect(zsciiToUnicode(161)).toBe('ß');
    });

    it('should return ? for extra character codes beyond unicode table', () => {
      // Default unicode table has 69 entries (155-223)
      // Codes 224-251 are valid extra character range but beyond default table
      expect(zsciiToUnicode(224)).toBe('?');
      expect(zsciiToUnicode(240)).toBe('?');
      expect(zsciiToUnicode(251)).toBe('?');
    });

    it('should return empty for input codes', () => {
      expect(zsciiToUnicode(ZSCII.CURSOR_UP)).toBe('');
      expect(zsciiToUnicode(ZSCII.F1)).toBe('');
    });

    it('should handle out of range codes', () => {
      expect(zsciiToUnicode(1)).toBe('');
      expect(zsciiToUnicode(31)).toBe('');
      expect(zsciiToUnicode(127)).toBe('');
    });
  });

  describe('unicodeToZscii', () => {
    it('should return null for empty string', () => {
      expect(unicodeToZscii('')).toBe(ZSCII.NULL);
    });

    it('should convert newline', () => {
      expect(unicodeToZscii('\n')).toBe(ZSCII.NEWLINE);
      expect(unicodeToZscii('\r')).toBe(ZSCII.NEWLINE);
    });

    it('should convert standard ASCII', () => {
      expect(unicodeToZscii(' ')).toBe(32);
      expect(unicodeToZscii('A')).toBe(65);
      expect(unicodeToZscii('a')).toBe(97);
      expect(unicodeToZscii('0')).toBe(48);
    });

    it('should convert extra characters', () => {
      expect(unicodeToZscii('ä')).toBe(155);
      expect(unicodeToZscii('ö')).toBe(156);
      expect(unicodeToZscii('ß')).toBe(161);
    });

    it('should return null for non-ZSCII characters', () => {
      expect(unicodeToZscii('★')).toBe(ZSCII.NULL);
      expect(unicodeToZscii('日')).toBe(ZSCII.NULL);
    });

    it('should only use first character', () => {
      expect(unicodeToZscii('ABC')).toBe(65);
    });
  });

  describe('isZsciiPrintable', () => {
    it('should return true for printable ASCII', () => {
      expect(isZsciiPrintable(32)).toBe(true);
      expect(isZsciiPrintable(65)).toBe(true);
      expect(isZsciiPrintable(126)).toBe(true);
    });

    it('should return true for newline', () => {
      expect(isZsciiPrintable(ZSCII.NEWLINE)).toBe(true);
    });

    it('should return true for extra characters', () => {
      expect(isZsciiPrintable(155)).toBe(true);
      expect(isZsciiPrintable(200)).toBe(true);
      expect(isZsciiPrintable(251)).toBe(true);
    });

    it('should return false for control codes', () => {
      expect(isZsciiPrintable(0)).toBe(false);
      expect(isZsciiPrintable(8)).toBe(false);
      expect(isZsciiPrintable(127)).toBe(false);
    });

    it('should return false for input codes', () => {
      expect(isZsciiPrintable(ZSCII.CURSOR_UP)).toBe(false);
      expect(isZsciiPrintable(ZSCII.F1)).toBe(false);
    });
  });

  describe('isZsciiTerminator', () => {
    it('should return true for newline', () => {
      expect(isZsciiTerminator(ZSCII.NEWLINE)).toBe(true);
    });

    it('should return true for escape', () => {
      expect(isZsciiTerminator(ZSCII.ESCAPE)).toBe(true);
    });

    it('should return true for function keys', () => {
      expect(isZsciiTerminator(ZSCII.F1)).toBe(true);
      expect(isZsciiTerminator(ZSCII.F12)).toBe(true);
    });

    it('should return true for mouse clicks', () => {
      expect(isZsciiTerminator(ZSCII.CLICK_SINGLE)).toBe(true);
      expect(isZsciiTerminator(ZSCII.CLICK_DOUBLE)).toBe(true);
    });

    it('should return false for regular characters', () => {
      expect(isZsciiTerminator(65)).toBe(false);
      expect(isZsciiTerminator(32)).toBe(false);
    });
  });

  describe('round-trip conversion', () => {
    it('should round-trip ASCII characters', () => {
      for (let code = 32; code <= 126; code++) {
        const char = zsciiToUnicode(code);
        expect(unicodeToZscii(char)).toBe(code);
      }
    });

    it('should round-trip extra characters', () => {
      for (let code = 155; code <= 220; code++) {
        const char = zsciiToUnicode(code);
        if (char !== '?') {
          expect(unicodeToZscii(char)).toBe(code);
        }
      }
    });
  });
});
