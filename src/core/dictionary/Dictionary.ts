/**
 * Dictionary
 *
 * The Z-machine dictionary is used to look up words entered by the player.
 * It consists of:
 * - A list of word separator characters
 * - The dictionary entries, each containing:
 *   - Encoded word (4 bytes V1-3, 6 bytes V4+)
 *   - Game-specific data bytes
 *
 * Dictionary entries are sorted in numerical order (treating the encoded
 * bytes as an unsigned number), enabling binary search.
 *
 * Reference: Z-Machine Specification §13
 *
 * @module
 */

import { ByteAddress, ZVersion } from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { DictionaryError } from '../errors/ZMachineError';

/**
 * Dictionary lookup result
 */
export interface DictionaryEntry {
  /** Address of the dictionary entry (0 if not found) */
  address: ByteAddress;
  /** The entry index in the dictionary (0-based) */
  index: number;
}

/**
 * Dictionary handler
 */
export class Dictionary {
  private readonly memory: Memory;

  /** Word separator characters */
  readonly separators: string;
  /** Number of bytes in each dictionary entry */
  readonly entryLength: number;
  /** Number of entries in the dictionary */
  readonly entryCount: number;
  /** Address where dictionary entries begin */
  readonly entriesStart: ByteAddress;
  /** Number of bytes used for the encoded word */
  readonly wordBytes: number;

  constructor(memory: Memory, version: ZVersion, dictionaryAddress: ByteAddress) {
    this.memory = memory;

    // Number of bytes for encoded words
    this.wordBytes = version <= 3 ? 4 : 6;

    // Parse dictionary header
    let offset = dictionaryAddress;

    // First byte: number of word separator characters
    const separatorCount = memory.readByte(offset++);

    // Read separator characters
    let seps = '';
    for (let i = 0; i < separatorCount; i++) {
      seps += String.fromCharCode(memory.readByte(offset++));
    }
    this.separators = seps;

    // Next byte: entry length
    this.entryLength = memory.readByte(offset++);

    // Next word: number of entries
    this.entryCount = memory.readWord(offset);
    offset += 2;

    this.entriesStart = offset;
  }

  /**
   * Check if a character is a word separator
   */
  isSeparator(char: string): boolean {
    return this.separators.includes(char);
  }

  /**
   * Get the address of a dictionary entry by index
   */
  getEntryAddress(index: number): ByteAddress {
    if (index < 0 || index >= this.entryCount) {
      throw new DictionaryError(`Invalid dictionary index: ${index}`);
    }
    return this.entriesStart + index * this.entryLength;
  }

  /**
   * Read the encoded word bytes at an entry address
   */
  readEncodedWord(address: ByteAddress): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < this.wordBytes; i++) {
      bytes.push(this.memory.readByte(address + i));
    }
    return bytes;
  }

  /**
   * Compare two encoded words
   * Returns <0 if a < b, 0 if equal, >0 if a > b
   */
  compareEncodedWords(a: number[], b: number[]): number {
    for (let i = 0; i < this.wordBytes; i++) {
      if (a[i] !== b[i]) {
        return a[i] - b[i];
      }
    }
    return 0;
  }

  /**
   * Look up a word in the dictionary using binary search
   * @param encodedWord The encoded word bytes to search for
   * @returns The dictionary entry address, or 0 if not found
   */
  lookup(encodedWord: number[]): ByteAddress {
    let low = 0;
    let high = this.entryCount - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entryAddr = this.getEntryAddress(mid);
      const entryWord = this.readEncodedWord(entryAddr);

      const cmp = this.compareEncodedWords(encodedWord, entryWord);

      if (cmp === 0) {
        return entryAddr;
      } else if (cmp < 0) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return 0; // Not found
  }

  /**
   * Look up a word and return detailed entry info
   */
  lookupEntry(encodedWord: number[]): DictionaryEntry {
    let low = 0;
    let high = this.entryCount - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entryAddr = this.getEntryAddress(mid);
      const entryWord = this.readEncodedWord(entryAddr);

      const cmp = this.compareEncodedWords(encodedWord, entryWord);

      if (cmp === 0) {
        return { address: entryAddr, index: mid };
      } else if (cmp < 0) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return { address: 0, index: -1 };
  }

  /**
   * Iterate over all dictionary entries
   */
  *entries(): Generator<{ address: ByteAddress; index: number; encodedWord: number[] }> {
    for (let i = 0; i < this.entryCount; i++) {
      const address = this.getEntryAddress(i);
      yield {
        address,
        index: i,
        encodedWord: this.readEncodedWord(address),
      };
    }
  }
}
