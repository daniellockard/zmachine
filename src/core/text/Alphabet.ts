/**
 * Z-Character Alphabet Tables
 * 
 * Z-characters are 5-bit codes (0-31) that map to ZSCII characters
 * via three alphabet tables: A0 (lowercase), A1 (uppercase), A2 (punctuation).
 * 
 * Z-char 0 = space
 * Z-char 1 = abbreviation (V2+) or newline (V1)
 * Z-char 2-3 = abbreviations (V3+) or shift
 * Z-char 4-5 = shift to A1/A2
 * Z-char 6 in A2 = escape to 10-bit ZSCII
 * 
 * Reference: Z-Machine Specification §3.5
 * 
 * @module
 */

import { ZVersion } from '../../types/ZMachineTypes';

/**
 * Default alphabet table A0 (lowercase letters)
 * Z-chars 6-31 map to indices 0-25
 */
export const ALPHABET_A0 = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Default alphabet table A1 (uppercase letters)
 */
export const ALPHABET_A1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Default alphabet table A2 for V1 (punctuation/special)
 * Note: V1 has a different A2 table
 */
export const ALPHABET_A2_V1 = ' 0123456789.,!?_#\'"/\\<-:()';

/**
 * Default alphabet table A2 for V2+ (punctuation/special)
 * Z-char 6 is special (10-bit ZSCII escape)
 * Z-char 7 is newline
 */
export const ALPHABET_A2 = ' \n0123456789.,!?_#\'"/\\-:()';

/**
 * Get the character for a Z-character in a given alphabet
 * 
 * @param zchar - Z-character (6-31, after shift handling)
 * @param alphabet - Which alphabet (0, 1, or 2)
 * @param version - Z-machine version
 * @param customAlphabets - Optional custom alphabet tables from header
 * @returns The ZSCII character, or null for special codes
 */
export function getAlphabetChar(
  zchar: number,
  alphabet: 0 | 1 | 2,
  version: ZVersion,
  customAlphabets?: [string, string, string]
): string | null {
  // Z-chars 0-5 are special, not looked up in alphabets
  if (zchar < 6) {
    return null;
  }
  
  const index = zchar - 6;
  
  if (customAlphabets) {
    return customAlphabets[alphabet].charAt(index) || null;
  }
  
  switch (alphabet) {
    case 0:
      return ALPHABET_A0.charAt(index) || null;
    case 1:
      return ALPHABET_A1.charAt(index) || null;
    case 2:
      if (version === 1) {
        return ALPHABET_A2_V1.charAt(index) || null;
      }
      // Z-char 6 in A2 is escape sequence, handled separately
      if (zchar === 6) {
        return null;
      }
      return ALPHABET_A2.charAt(index) || null;
    default:
      return null;
  }
}

/**
 * Shift types for Z-character decoding
 */
export enum ShiftType {
  /** No shift, use current alphabet */
  None = 0,
  /** Shift to next alphabet for one character */
  Single = 1,
  /** Shift lock to next alphabet (V1-2 only) */
  Lock = 2,
}

/**
 * Get the target alphabet after a shift
 * 
 * @param currentAlphabet - Current alphabet (0, 1, 2)
 * @param shiftChar - The shift Z-character (4 or 5)
 * @param version - Z-machine version
 * @returns The new alphabet number
 */
export function getShiftedAlphabet(
  currentAlphabet: 0 | 1 | 2,
  shiftChar: 4 | 5,
  version: ZVersion
): 0 | 1 | 2 {
  if (version <= 2) {
    // V1-2: 4 = shift up, 5 = shift down (wrapping)
    if (shiftChar === 4) {
      // Shift up: 0->1, 1->2, 2->0
      return ((currentAlphabet + 1) % 3) as 0 | 1 | 2;
    } else {
      // Shift down: 0->2, 1->0, 2->1
      return ((currentAlphabet + 2) % 3) as 0 | 1 | 2;
    }
  } else {
    // V3+: 4 = shift to A1, 5 = shift to A2 (always from A0)
    return shiftChar === 4 ? 1 : 2;
  }
}

/**
 * Check if a Z-character is a shift character
 */
export function isShiftChar(zchar: number, version: ZVersion): boolean {
  if (version <= 2) {
    // V1-2: 2-5 are shifts (2-3 are shift locks)
    return zchar >= 2 && zchar <= 5;
  } else {
    // V3+: 4-5 are shifts
    return zchar === 4 || zchar === 5;
  }
}

/**
 * Check if a Z-character starts an abbreviation
 * 
 * @param zchar - Z-character value
 * @param version - Z-machine version
 * @returns true if this Z-char starts an abbreviation sequence
 */
export function isAbbreviationChar(zchar: number, version: ZVersion): boolean {
  if (version === 1) {
    // V1: 1 is newline, not abbreviation
    return false;
  } else if (version === 2) {
    // V2: only 1 is abbreviation
    return zchar === 1;
  } else {
    // V3+: 1, 2, 3 are abbreviation prefixes
    return zchar >= 1 && zchar <= 3;
  }
}

/**
 * Calculate abbreviation table index from Z-chars
 * 
 * @param prefixChar - The prefix Z-char (1, 2, or 3)
 * @param indexChar - The following Z-char (0-31)
 * @returns Index into abbreviation table (0-95)
 */
export function getAbbreviationIndex(prefixChar: number, indexChar: number): number {
  // Abbreviation number is 32*(z-1) + next_zchar
  return 32 * (prefixChar - 1) + indexChar;
}
