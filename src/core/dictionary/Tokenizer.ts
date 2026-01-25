/**
 * Tokenizer
 * 
 * Tokenizes player input for the Z-machine's `read` opcode.
 * The tokenizer:
 * 1. Splits input into words using spaces and dictionary separators
 * 2. Encodes each word into Z-characters
 * 3. Looks up each word in the dictionary
 * 4. Writes results to the parse buffer
 * 
 * Parse buffer format:
 * - Byte 0: Maximum number of tokens
 * - Byte 1: Number of tokens found (written by tokenizer)
 * - For each token (4 bytes each):
 *   - Word 0: Dictionary address (0 if not found)
 *   - Byte 2: Length of word in text buffer
 *   - Byte 3: Position in text buffer (1-indexed)
 * 
 * Reference: Z-Machine Specification §15.3
 * 
 * @module
 */

import { ByteAddress, ZVersion } from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { Dictionary } from './Dictionary';
import { encodeText } from '../text/ZCharEncoder';

/**
 * A parsed token from player input
 */
export interface Token {
  /** The word text */
  text: string;
  /** Position in the input string (0-indexed) */
  position: number;
  /** Length of the word */
  length: number;
  /** Dictionary address (0 if not found) */
  dictionaryAddress: ByteAddress;
}

/**
 * Tokenizer for player input
 */
export class Tokenizer {
  private readonly memory: Memory;
  private readonly version: ZVersion;
  private readonly dictionary: Dictionary;

  constructor(memory: Memory, version: ZVersion, dictionary: Dictionary) {
    this.memory = memory;
    this.version = version;
    this.dictionary = dictionary;
  }

  /**
   * Tokenize an input string
   * @param input The player's input string
   * @returns Array of tokens
   */
  tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    const lowerInput = input.toLowerCase();
    let pos = 0;

    while (pos < lowerInput.length) {
      // Skip leading spaces
      while (pos < lowerInput.length && lowerInput[pos] === ' ') {
        pos++;
      }

      if (pos >= lowerInput.length) break;

      // Check if current character is a separator
      if (this.dictionary.isSeparator(lowerInput[pos])) {
        // Separators are tokens themselves
        const sepText = lowerInput[pos];
        const encoded = encodeText(sepText, this.version);
        const dictAddr = this.dictionary.lookup(encoded);

        tokens.push({
          text: sepText,
          position: pos,
          length: 1,
          dictionaryAddress: dictAddr,
        });
        pos++;
        continue;
      }

      // Read a word until space or separator
      const wordStart = pos;
      while (
        pos < lowerInput.length &&
        lowerInput[pos] !== ' ' &&
        !this.dictionary.isSeparator(lowerInput[pos])
      ) {
        pos++;
      }

      const wordText = lowerInput.slice(wordStart, pos);
      const encoded = encodeText(wordText, this.version);
      const dictAddr = this.dictionary.lookup(encoded);

      tokens.push({
        text: wordText,
        position: wordStart,
        length: pos - wordStart,
        dictionaryAddress: dictAddr,
      });
    }

    return tokens;
  }

  /**
   * Tokenize input from a text buffer and write results to a parse buffer
   * This is used by the `read` opcode
   * 
   * @param textBuffer Address of text buffer (V1-4: byte 0 = max chars, byte 1+ = text;
   *                   V5+: byte 0 = max chars, byte 1 = actual length, byte 2+ = text)
   * @param parseBuffer Address of parse buffer (byte 0 = max tokens, byte 1 = token count)
   * @param dictionaryAddr Optional custom dictionary address (0 = use default)
   * @param skipUnknown If true, don't store tokens not in dictionary
   */
  tokenizeBuffer(
    textBuffer: ByteAddress,
    parseBuffer: ByteAddress,
    dictionaryAddr: ByteAddress = 0,
    skipUnknown: boolean = false
  ): void {
    // Read input text from text buffer
    let text: string;
    let textStart: number; // Offset where text starts in buffer

    if (this.version <= 4) {
      // V1-4: text starts at byte 1, null-terminated
      textStart = 1;
      let chars = '';
      let offset = 1;
      while (true) {
        const c = this.memory.readByte(textBuffer + offset);
        if (c === 0) break;
        chars += String.fromCharCode(c);
        offset++;
      }
      text = chars;
    } else {
      // V5+: byte 1 = length, text starts at byte 2
      textStart = 2;
      const length = this.memory.readByte(textBuffer + 1);
      let chars = '';
      for (let i = 0; i < length; i++) {
        chars += String.fromCharCode(this.memory.readByte(textBuffer + 2 + i));
      }
      text = chars;
    }

    // Use custom dictionary if provided
    const dict = dictionaryAddr !== 0
      ? new Dictionary(this.memory, this.version, dictionaryAddr)
      : this.dictionary;

    // Tokenize
    const tokens = this.tokenizeWithDictionary(text, dict);

    // Write to parse buffer
    const maxTokens = this.memory.readByte(parseBuffer);
    let tokenCount = 0;

    for (const token of tokens) {
      if (tokenCount >= maxTokens) break;

      if (skipUnknown && token.dictionaryAddress === 0) {
        continue;
      }

      const tokenAddr = parseBuffer + 2 + tokenCount * 4;

      // Dictionary address (word)
      this.memory.writeWord(tokenAddr, token.dictionaryAddress);
      // Length (byte)
      this.memory.writeByte(tokenAddr + 2, token.length);
      // Position in text buffer (1-indexed in V1-4, offset from start)
      this.memory.writeByte(tokenAddr + 3, token.position + textStart);

      tokenCount++;
    }

    // Write token count
    this.memory.writeByte(parseBuffer + 1, tokenCount);
  }

  /**
   * Tokenize with a specific dictionary
   */
  private tokenizeWithDictionary(input: string, dict: Dictionary): Token[] {
    const tokens: Token[] = [];
    const lowerInput = input.toLowerCase();
    let pos = 0;

    while (pos < lowerInput.length) {
      // Skip leading spaces
      while (pos < lowerInput.length && lowerInput[pos] === ' ') {
        pos++;
      }

      if (pos >= lowerInput.length) break;

      // Check if current character is a separator
      if (dict.isSeparator(lowerInput[pos])) {
        const sepText = lowerInput[pos];
        const encoded = encodeText(sepText, this.version);
        const dictAddr = dict.lookup(encoded);

        tokens.push({
          text: sepText,
          position: pos,
          length: 1,
          dictionaryAddress: dictAddr,
        });
        pos++;
        continue;
      }

      // Read a word
      const wordStart = pos;
      while (
        pos < lowerInput.length &&
        lowerInput[pos] !== ' ' &&
        !dict.isSeparator(lowerInput[pos])
      ) {
        pos++;
      }

      const wordText = lowerInput.slice(wordStart, pos);
      const encoded = encodeText(wordText, this.version);
      const dictAddr = dict.lookup(encoded);

      tokens.push({
        text: wordText,
        position: wordStart,
        length: pos - wordStart,
        dictionaryAddress: dictAddr,
      });
    }

    return tokens;
  }
}
