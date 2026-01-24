/**
 * Tests for AddressUtils module
 */

import { describe, it, expect } from 'vitest';
import {
  wordAddressToByteAddress,
  byteAddressToWordAddress,
  getPackedAddressMultiplier,
  unpackRoutineAddress,
  unpackStringAddress,
  toUnsigned16,
  toSigned16,
  toUnsigned8,
  toSigned8,
  isValidAddress,
  isWordAligned,
} from './AddressUtils';

describe('AddressUtils', () => {
  describe('wordAddressToByteAddress', () => {
    it('should multiply by 2', () => {
      expect(wordAddressToByteAddress(0)).toBe(0);
      expect(wordAddressToByteAddress(1)).toBe(2);
      expect(wordAddressToByteAddress(0x100)).toBe(0x200);
      expect(wordAddressToByteAddress(0x8000)).toBe(0x10000);
    });
  });

  describe('byteAddressToWordAddress', () => {
    it('should divide by 2', () => {
      expect(byteAddressToWordAddress(0)).toBe(0);
      expect(byteAddressToWordAddress(2)).toBe(1);
      expect(byteAddressToWordAddress(0x200)).toBe(0x100);
    });

    it('should throw on odd addresses', () => {
      expect(() => byteAddressToWordAddress(1)).toThrow('not word-aligned');
      expect(() => byteAddressToWordAddress(0x101)).toThrow('not word-aligned');
    });
  });

  describe('getPackedAddressMultiplier', () => {
    it('should return 2 for V1-3', () => {
      expect(getPackedAddressMultiplier(1)).toBe(2);
      expect(getPackedAddressMultiplier(2)).toBe(2);
      expect(getPackedAddressMultiplier(3)).toBe(2);
    });

    it('should return 4 for V4-5', () => {
      expect(getPackedAddressMultiplier(4)).toBe(4);
      expect(getPackedAddressMultiplier(5)).toBe(4);
    });

    it('should return 4 for V6-7', () => {
      expect(getPackedAddressMultiplier(6)).toBe(4);
      expect(getPackedAddressMultiplier(7)).toBe(4);
    });

    it('should return 8 for V8', () => {
      expect(getPackedAddressMultiplier(8)).toBe(8);
    });
  });

  describe('unpackRoutineAddress', () => {
    it('should unpack V3 addresses (multiply by 2)', () => {
      expect(unpackRoutineAddress(0x100, 3)).toBe(0x200);
      expect(unpackRoutineAddress(0x1234, 3)).toBe(0x2468);
    });

    it('should unpack V5 addresses (multiply by 4)', () => {
      expect(unpackRoutineAddress(0x100, 5)).toBe(0x400);
      expect(unpackRoutineAddress(0x1234, 5)).toBe(0x48D0);
    });

    it('should unpack V6 addresses with offset', () => {
      expect(unpackRoutineAddress(0x100, 6, 0x8000)).toBe(0x8400);
    });

    it('should unpack V8 addresses (multiply by 8)', () => {
      expect(unpackRoutineAddress(0x100, 8)).toBe(0x800);
      expect(unpackRoutineAddress(0x1234, 8)).toBe(0x91A0);
    });
  });

  describe('unpackStringAddress', () => {
    it('should unpack V3 addresses (multiply by 2)', () => {
      expect(unpackStringAddress(0x100, 3)).toBe(0x200);
    });

    it('should unpack V5 addresses (multiply by 4)', () => {
      expect(unpackStringAddress(0x100, 5)).toBe(0x400);
    });

    it('should unpack V6 addresses with offset', () => {
      expect(unpackStringAddress(0x100, 6, 0x10000)).toBe(0x10400);
    });

    it('should unpack V8 addresses (multiply by 8)', () => {
      expect(unpackStringAddress(0x100, 8)).toBe(0x800);
    });
  });

  describe('toUnsigned16', () => {
    it('should mask to 16 bits', () => {
      expect(toUnsigned16(0)).toBe(0);
      expect(toUnsigned16(0xFFFF)).toBe(0xFFFF);
      expect(toUnsigned16(0x10000)).toBe(0);
      expect(toUnsigned16(0x12345)).toBe(0x2345);
    });

    it('should convert negative to unsigned', () => {
      expect(toUnsigned16(-1)).toBe(0xFFFF);
      expect(toUnsigned16(-32768)).toBe(0x8000);
    });
  });

  describe('toSigned16', () => {
    it('should preserve positive values under 0x8000', () => {
      expect(toSigned16(0)).toBe(0);
      expect(toSigned16(1)).toBe(1);
      expect(toSigned16(0x7FFF)).toBe(32767);
    });

    it('should convert values >= 0x8000 to negative', () => {
      expect(toSigned16(0x8000)).toBe(-32768);
      expect(toSigned16(0xFFFF)).toBe(-1);
      expect(toSigned16(0xFFFE)).toBe(-2);
    });

    it('should mask to 16 bits first', () => {
      expect(toSigned16(0x10000)).toBe(0);
      expect(toSigned16(0x1FFFF)).toBe(-1);
    });
  });

  describe('toUnsigned8', () => {
    it('should mask to 8 bits', () => {
      expect(toUnsigned8(0)).toBe(0);
      expect(toUnsigned8(0xFF)).toBe(0xFF);
      expect(toUnsigned8(0x100)).toBe(0);
      expect(toUnsigned8(0x1AB)).toBe(0xAB);
    });

    it('should convert negative to unsigned', () => {
      expect(toUnsigned8(-1)).toBe(0xFF);
      expect(toUnsigned8(-128)).toBe(0x80);
    });
  });

  describe('toSigned8', () => {
    it('should preserve positive values under 0x80', () => {
      expect(toSigned8(0)).toBe(0);
      expect(toSigned8(1)).toBe(1);
      expect(toSigned8(0x7F)).toBe(127);
    });

    it('should convert values >= 0x80 to negative', () => {
      expect(toSigned8(0x80)).toBe(-128);
      expect(toSigned8(0xFF)).toBe(-1);
      expect(toSigned8(0xFE)).toBe(-2);
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid addresses', () => {
      expect(isValidAddress(0, 0x10000)).toBe(true);
      expect(isValidAddress(0xFFFF, 0x10000)).toBe(true);
      expect(isValidAddress(0x1234, 0x10000)).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(isValidAddress(-1, 0x10000)).toBe(false);
      expect(isValidAddress(0x10000, 0x10000)).toBe(false);
      expect(isValidAddress(0x20000, 0x10000)).toBe(false);
    });
  });

  describe('isWordAligned', () => {
    it('should return true for even addresses', () => {
      expect(isWordAligned(0)).toBe(true);
      expect(isWordAligned(2)).toBe(true);
      expect(isWordAligned(0x100)).toBe(true);
      expect(isWordAligned(0xFFFE)).toBe(true);
    });

    it('should return false for odd addresses', () => {
      expect(isWordAligned(1)).toBe(false);
      expect(isWordAligned(3)).toBe(false);
      expect(isWordAligned(0x101)).toBe(false);
      expect(isWordAligned(0xFFFF)).toBe(false);
    });
  });
});
