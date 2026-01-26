/**
 * Z-Character Encoder
 * 
 * Encodes ASCII/Unicode text into Z-character format for dictionary lookup.
 * This is the reverse of ZCharDecoder.
 * 
 * Encoding rules:
 * - Lowercase letters a-z use alphabet 0 (codes 6-31)
 * - Other characters may use shift + alphabet 1 or 2
 * - Characters not in any alphabet use escape sequence (A2 shift + 10-bit ZSCII)
 * - Words are padded to 6 Z-chars (V1-3) or 9 Z-chars (V4+)
 * - Final word has bit 15 set
 * 
 * Reference: Z-Machine Specification §3
 * 
 * @module
 */

import { ZVersion } from '../../types/ZMachineTypes';
import { ALPHABET_A0, ALPHABET_A1, ALPHABET_A2, ALPHABET_A2_V1 } from './Alphabet';

/**
 * Get the alphabet tables for a version
 */
export function getAlphabets(version: ZVersion): [string, string, string] {
  const a2 = version === 1 ? ALPHABET_A2_V1 : ALPHABET_A2;
  return [ALPHABET_A0, ALPHABET_A1, a2];
}

/**
 * Find a character in the alphabets
 * Returns [alphabet, index] or null if not found
 */
function findInAlphabets(
  char: string,
  alphabets: [string, string, string]
): [number, number] | null {
  for (let a = 0; a < 3; a++) {
    const idx = alphabets[a].indexOf(char);
    if (idx !== -1) {
      return [a, idx];
    }
  }
  return null;
}

/**
 * Encode a character to Z-characters
 * Returns an array of Z-char codes (1-3 codes depending on character)
 */
export function encodeChar(
  char: string,
  alphabets: [string, string, string]
): number[] {
  // Check alphabets
  const found = findInAlphabets(char, alphabets);

  if (found !== null) {
    const [alphabet, index] = found;
    const zcode = 6 + index; // Z-codes 6-31 map to alphabet positions 0-25

    if (alphabet === 0) {
      // A0: no shift needed
      return [zcode];
    } else if (alphabet === 1) {
      // A1: shift-4
      return [4, zcode];
    } else {
      // A2: shift-5
      return [5, zcode];
    }
  }

  // Character not in alphabets - use ZSCII escape
  // A2 shift, then code 6, then 10-bit ZSCII split into two 5-bit values
  const zscii = char.charCodeAt(0);
  const high = (zscii >> 5) & 0x1F;
  const low = zscii & 0x1F;
  return [5, 6, high, low];
}

/**
 * Encode text to Z-character bytes for dictionary lookup
 * 
 * @param text The text to encode (will be lowercased)
 * @param version Z-machine version
 * @returns Array of bytes representing the encoded word
 */
export function encodeText(text: string, version: ZVersion): number[] {
  const alphabets = getAlphabets(version);
  const zchars: number[] = [];
  const lowerText = text.toLowerCase();

  // Maximum Z-chars: 6 for V1-3, 9 for V4+
  const maxZChars = version <= 3 ? 6 : 9;

  // Encode characters until we hit the limit
  for (const char of lowerText) {
    if (zchars.length >= maxZChars) break;

    const encoded = encodeChar(char, alphabets);
    for (const zc of encoded) {
      if (zchars.length >= maxZChars) break;
      zchars.push(zc);
    }
  }

  // Pad with shift-5 (code 5) to fill remaining slots
  while (zchars.length < maxZChars) {
    zchars.push(5);
  }

  // Pack into bytes (3 Z-chars per 2 bytes)
  const bytes: number[] = [];
  const wordCount = version <= 3 ? 2 : 3; // 2 words for V1-3, 3 for V4+

  for (let w = 0; w < wordCount; w++) {
    // Note: zchars is always padded to exactly maxZChars, so all indices are valid
    const c0 = zchars[w * 3];
    const c1 = zchars[w * 3 + 1];
    const c2 = zchars[w * 3 + 2];

    // Pack: [c0:5][c1:5][c2:5] + bit 15 set on last word
    let word = ((c0 & 0x1F) << 10) | ((c1 & 0x1F) << 5) | (c2 & 0x1F);

    if (w === wordCount - 1) {
      word |= 0x8000; // Set end bit on last word
    }

    bytes.push((word >> 8) & 0xFF);
    bytes.push(word & 0xFF);
  }

  return bytes;
}

/**
 * Encode text directly to Z-character codes (not packed into bytes)
 * Useful for testing and comparison
 */
export function encodeToZChars(text: string, version: ZVersion): number[] {
  const alphabets = getAlphabets(version);
  const zchars: number[] = [];
  const lowerText = text.toLowerCase();
  const maxZChars = version <= 3 ? 6 : 9;

  for (const char of lowerText) {
    if (zchars.length >= maxZChars) break;

    const encoded = encodeChar(char, alphabets);
    for (const zc of encoded) {
      if (zchars.length >= maxZChars) break;
      zchars.push(zc);
    }
  }

  while (zchars.length < maxZChars) {
    zchars.push(5);
  }

  return zchars;
}
