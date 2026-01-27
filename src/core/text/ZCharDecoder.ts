/**
 * Z-Character Decoder
 *
 * Decodes Z-encoded strings from memory into Unicode text.
 *
 * Z-strings are packed 3 Z-characters per 2-byte word:
 * - Bits 14-10: First Z-character
 * - Bits 9-5: Second Z-character
 * - Bits 4-0: Third Z-character
 * - Bit 15: End of string marker
 *
 * Reference: Z-Machine Specification §3
 *
 * @module
 */

import { ByteAddress, ZVersion } from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { zsciiToUnicode } from './ZSCII';
import { getAlphabetChar, getShiftedAlphabet, getAbbreviationIndex } from './Alphabet';

/**
 * Result of decoding a Z-string
 */
export interface DecodeResult {
  /** The decoded Unicode text */
  text: string;
  /** Number of bytes consumed from memory */
  bytesConsumed: number;
}

/**
 * Decodes Z-encoded strings from memory
 */
export class ZCharDecoder {
  private readonly memory: Memory;
  private readonly version: ZVersion;
  private readonly abbreviationsAddress: ByteAddress;
  private customAlphabets?: [string, string, string];

  constructor(memory: Memory, version: ZVersion, abbreviationsAddress: ByteAddress) {
    this.memory = memory;
    this.version = version;
    this.abbreviationsAddress = abbreviationsAddress;
  }

  /**
   * Set custom alphabet tables (from header extension, V5+)
   */
  setCustomAlphabets(alphabets: [string, string, string]): void {
    this.customAlphabets = alphabets;
  }

  /**
   * Decode a Z-string at the given address
   *
   * @param address - Start address of the Z-string
   * @returns Decoded text and number of bytes consumed
   */
  decode(address: ByteAddress): DecodeResult {
    const zchars = this.extractZChars(address);
    const text = this.zcharsToText(zchars.chars);
    return {
      text,
      bytesConsumed: zchars.bytesConsumed,
    };
  }

  /**
   * Extract raw Z-characters from a packed string
   */
  private extractZChars(address: ByteAddress): { chars: number[]; bytesConsumed: number } {
    const chars: number[] = [];
    let offset = 0;
    let done = false;

    while (!done) {
      const word = this.memory.readWord(address + offset);
      offset += 2;

      // Extract 3 Z-characters from the word
      chars.push((word >> 10) & 0x1f);
      chars.push((word >> 5) & 0x1f);
      chars.push(word & 0x1f);

      // High bit marks end of string
      if (word & 0x8000) {
        done = true;
      }
    }

    return { chars, bytesConsumed: offset };
  }

  /**
   * Convert Z-characters to text
   */
  private zcharsToText(zchars: number[], preventAbbreviation: boolean = false): string {
    let result = '';
    let currentAlphabet: 0 | 1 | 2 = 0;
    let shiftAlphabet: 0 | 1 | 2 | null = null;
    let i = 0;

    while (i < zchars.length) {
      const zchar = zchars[i];
      i++;

      // Determine which alphabet to use
      const alphabet = shiftAlphabet ?? currentAlphabet;
      shiftAlphabet = null; // Single shift resets

      // Z-char 0: space
      if (zchar === 0) {
        result += ' ';
        continue;
      }

      // Z-char 1: V1 newline or abbreviation
      if (zchar === 1) {
        if (this.version === 1) {
          result += '\n';
        } else if (!preventAbbreviation && i < zchars.length) {
          // Abbreviation
          const nextZchar = zchars[i];
          i++;
          result += this.expandAbbreviation(zchar, nextZchar);
        }
        continue;
      }

      // Z-chars 2-3: abbreviations (V3+) or shifts (V1-2)
      if (zchar === 2 || zchar === 3) {
        if (this.version <= 2) {
          // V1-2 shift lock
          if (zchar === 2) {
            currentAlphabet = getShiftedAlphabet(currentAlphabet, 4, this.version);
          } else {
            currentAlphabet = getShiftedAlphabet(currentAlphabet, 5, this.version);
          }
        } else if (!preventAbbreviation) {
          // V3+ Abbreviation
          const nextZchar = zchars[i++];
          result += this.expandAbbreviation(zchar, nextZchar);
        }
        // V3+ with preventAbbreviation: ignore the z-char
        continue;
      }

      // Z-chars 4-5: shift
      if (zchar === 4 || zchar === 5) {
        shiftAlphabet = getShiftedAlphabet(currentAlphabet, zchar, this.version);
        continue;
      }

      // Z-char 6 in A2: 10-bit ZSCII escape
      if (alphabet === 2 && zchar === 6) {
        // Need 2 more z-chars for the 10-bit code
        const high = zchars[i++];
        const low = zchars[i++];
        const zsciiCode = (high << 5) | low;
        result += zsciiToUnicode(zsciiCode);
        continue;
      }

      // Regular character from alphabet (z-char 6-31)
      // By this point all special z-chars (0-5, and 6 in A2) have been handled
      // In normal operation, Z-chars 6-31 always produce a character, but we
      // defensively handle a missing mapping in case of misconfigured tables
      const decodedChar = getAlphabetChar(zchar, alphabet, this.version, this.customAlphabets);
      if (decodedChar === null || decodedChar === undefined) {
        // Fallback for invalid z-char or misconfigured alphabet: use replacement char
        result += '\uFFFD';
      } else {
        result += decodedChar;
      }
    }

    return result;
  }

  /**
   * Expand an abbreviation
   */
  private expandAbbreviation(prefixChar: number, indexChar: number): string {
    const abbrevIndex = getAbbreviationIndex(prefixChar, indexChar);

    // Abbreviation table contains word addresses
    const tableOffset = abbrevIndex * 2;
    const wordAddress = this.memory.readWord(this.abbreviationsAddress + tableOffset);

    // Convert word address to byte address
    const byteAddress = wordAddress * 2;

    // Decode the abbreviation (prevent nested abbreviations)
    const zchars = this.extractZChars(byteAddress);
    return this.zcharsToText(zchars.chars, true);
  }

  /**
   * Decode a Z-string and return just the text
   * (Convenience method for use with Decoder)
   */
  decodeString(address: ByteAddress): { text: string; bytesConsumed: number } {
    return this.decode(address);
  }
}
