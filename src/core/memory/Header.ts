/**
 * Z-machine Header Parser
 *
 * The header occupies bytes 0x00 to 0x3F (64 bytes) of the story file.
 * It contains essential information about the game and interpreter capabilities.
 *
 * Reference: Z-Machine Specification §11
 *
 * @module
 */

import { ByteAddress, ZVersion } from '../../types/ZMachineTypes';
import { Memory } from './Memory';
import { ZMachineError } from '../errors/ZMachineError';

/**
 * Header field addresses
 * Names match the Z-machine specification where possible
 */
export const HeaderAddress = {
  /** Version number (1 byte) - §11.1.1 */
  VERSION: 0x00,

  /** Flags 1 (1 byte) - §11.1.2 */
  FLAGS1: 0x01,

  /** Release number (2 bytes) - §11.1.3 */
  RELEASE: 0x02,

  /** Base of high memory (2 bytes) - §11.1.4 */
  HIGH_MEMORY_BASE: 0x04,

  /** Initial value of PC (2 bytes) - §11.1.5 */
  INITIAL_PC: 0x06,

  /** Location of dictionary (2 bytes) - §11.1.6 */
  DICTIONARY: 0x08,

  /** Location of object table (2 bytes) - §11.1.7 */
  OBJECT_TABLE: 0x0a,

  /** Location of global variables table (2 bytes) - §11.1.8 */
  GLOBALS: 0x0c,

  /** Base of static memory (2 bytes) - §11.1.9 */
  STATIC_MEMORY_BASE: 0x0e,

  /** Flags 2 (2 bytes) - §11.1.10 */
  FLAGS2: 0x10,

  /** Serial number (6 bytes ASCII) - §11.1.11 */
  SERIAL: 0x12,

  /** Location of abbreviations table (2 bytes) - §11.1.12 */
  ABBREVIATIONS: 0x18,

  /** Length of file (2 bytes, divided by constant) - §11.1.13 */
  FILE_LENGTH: 0x1a,

  /** Checksum of file (2 bytes) - §11.1.14 */
  CHECKSUM: 0x1c,

  /** Interpreter number (1 byte, V4+) - §11.1.15 */
  INTERPRETER_NUMBER: 0x1e,

  /** Interpreter version (1 byte, V4+) - §11.1.16 */
  INTERPRETER_VERSION: 0x1f,

  /** Screen height in lines (1 byte, V4+) */
  SCREEN_HEIGHT: 0x20,

  /** Screen width in characters (1 byte, V4+) */
  SCREEN_WIDTH: 0x21,

  /** Screen width in units (2 bytes, V5+) */
  SCREEN_WIDTH_UNITS: 0x22,

  /** Screen height in units (2 bytes, V5+) */
  SCREEN_HEIGHT_UNITS: 0x24,

  /** Font width/height in units (V5: 1 byte each, V6: reversed) */
  FONT_WIDTH: 0x26,
  FONT_HEIGHT: 0x27,

  /** Routines offset (2 bytes, V6+) */
  ROUTINES_OFFSET: 0x28,

  /** Strings offset (2 bytes, V6+) */
  STRINGS_OFFSET: 0x2a,

  /** Default background color (1 byte, V5+) */
  DEFAULT_BACKGROUND: 0x2c,

  /** Default foreground color (1 byte, V5+) */
  DEFAULT_FOREGROUND: 0x2d,

  /** Address of terminating characters table (2 bytes, V5+) */
  TERMINATING_CHARS: 0x2e,

  /** Total width of text sent to stream 3 (2 bytes, V6) */
  STREAM3_WIDTH: 0x30,

  /** Standard revision number (2 bytes) */
  STANDARD_REVISION: 0x32,

  /** Alphabet table address (2 bytes, V5+) */
  ALPHABET_TABLE: 0x34,

  /** Header extension table address (2 bytes, V5+) */
  EXTENSION_TABLE: 0x36,
} as const;

/**
 * Flags 1 bits for V3
 */
export const Flags1V3 = {
  /** Bit 1: Status line type (0=score/turns, 1=hours:mins) */
  STATUS_LINE_TYPE: 0x02,
  /** Bit 2: Story file split across two discs */
  STORY_SPLIT: 0x04,
  /** Bit 3: Status line not available (set by interpreter) */
  STATUS_LINE_NOT_AVAILABLE: 0x10,
  /** Bit 4: Screen-splitting available (set by interpreter) */
  SCREEN_SPLIT_AVAILABLE: 0x20,
  /** Bit 5: Variable-pitch font is default (set by interpreter) */
  VARIABLE_PITCH_DEFAULT: 0x40,
} as const;

/**
 * Flags 2 bits (all versions)
 */
export const Flags2 = {
  /** Bit 0: Transcripting on */
  TRANSCRIPTING: 0x01,
  /** Bit 1: Force fixed-pitch printing */
  FIXED_PITCH: 0x02,
  /** Bit 2: Request screen redraw (V6) */
  REDRAW: 0x04,
  /** Bit 3: Use pictures (V5+) */
  PICTURES: 0x08,
  /** Bit 4: Use UNDO opcodes (V5+) */
  UNDO: 0x10,
  /** Bit 5: Use mouse (V5+) */
  MOUSE: 0x20,
  /** Bit 6: Use colors (V5+) */
  COLORS: 0x40,
  /** Bit 7: Use sound effects (V5+) */
  SOUND: 0x80,
  /** Bit 8: Use menus (V6) */
  MENUS: 0x100,
} as const;

/**
 * Parsed Z-machine header data
 */
export interface HeaderData {
  /** Z-machine version (1-8) */
  version: ZVersion;

  /** Flags 1 value */
  flags1: number;

  /** Release number */
  release: number;

  /** High memory base address */
  highMemoryBase: ByteAddress;

  /** Initial program counter */
  initialPC: ByteAddress;

  /** Dictionary table address */
  dictionaryAddress: ByteAddress;

  /** Object table address */
  objectTableAddress: ByteAddress;

  /** Global variables table address */
  globalsAddress: ByteAddress;

  /** Static memory base address */
  staticMemoryBase: ByteAddress;

  /** Flags 2 value */
  flags2: number;

  /** Serial number (6-character string, usually a date YYMMDD) */
  serialNumber: string;

  /** Abbreviations table address */
  abbreviationsAddress: ByteAddress;

  /** File length in bytes */
  fileLength: number;

  /** File checksum */
  checksum: number;
}

/**
 * Parse and access Z-machine header fields
 */
export class Header {
  private readonly memory: Memory;
  private readonly data: HeaderData;

  constructor(memory: Memory) {
    this.memory = memory;
    this.data = this.parseHeader();
  }

  /**
   * Parse all header fields from memory
   */
  private parseHeader(): HeaderData {
    const version = this.memory.readByte(HeaderAddress.VERSION) as ZVersion;

    if (version < 1 || version > 8) {
      throw new ZMachineError(`Invalid Z-machine version: ${version}`);
    }

    const fileLength = this.calculateFileLength(
      this.memory.readWord(HeaderAddress.FILE_LENGTH),
      version
    );

    return {
      version,
      flags1: this.memory.readByte(HeaderAddress.FLAGS1),
      release: this.memory.readWord(HeaderAddress.RELEASE),
      highMemoryBase: this.memory.readWord(HeaderAddress.HIGH_MEMORY_BASE),
      initialPC: this.memory.readWord(HeaderAddress.INITIAL_PC),
      dictionaryAddress: this.memory.readWord(HeaderAddress.DICTIONARY),
      objectTableAddress: this.memory.readWord(HeaderAddress.OBJECT_TABLE),
      globalsAddress: this.memory.readWord(HeaderAddress.GLOBALS),
      staticMemoryBase: this.memory.readWord(HeaderAddress.STATIC_MEMORY_BASE),
      flags2: this.memory.readWord(HeaderAddress.FLAGS2),
      serialNumber: this.parseSerialNumber(),
      abbreviationsAddress: this.memory.readWord(HeaderAddress.ABBREVIATIONS),
      fileLength,
      checksum: this.memory.readWord(HeaderAddress.CHECKSUM),
    };
  }

  /**
   * Parse the 6-byte serial number as ASCII string
   */
  private parseSerialNumber(): string {
    const bytes = this.memory.readBytes(HeaderAddress.SERIAL, 6);
    let serial = '';
    for (let i = 0; i < 6; i++) {
      serial += String.fromCharCode(bytes[i]);
    }
    return serial;
  }

  /**
   * Calculate actual file length from header value
   *
   * The stored value is divided by a version-dependent constant:
   * - V1-3: divide by 2
   * - V4-5: divide by 4
   * - V6+: divide by 8
   */
  private calculateFileLength(headerValue: number, version: ZVersion): number {
    if (version <= 3) {
      return headerValue * 2;
    } else if (version <= 5) {
      return headerValue * 4;
    } else {
      return headerValue * 8;
    }
  }

  /** Get Z-machine version */
  get version(): ZVersion {
    return this.data.version;
  }

  /** Get flags 1 value */
  get flags1(): number {
    return this.data.flags1;
  }

  /** Get release number */
  get release(): number {
    return this.data.release;
  }

  /** Get high memory base address */
  get highMemoryBase(): ByteAddress {
    return this.data.highMemoryBase;
  }

  /** Get initial program counter */
  get initialPC(): ByteAddress {
    return this.data.initialPC;
  }

  /** Get dictionary table address */
  get dictionaryAddress(): ByteAddress {
    return this.data.dictionaryAddress;
  }

  /** Get object table address */
  get objectTableAddress(): ByteAddress {
    return this.data.objectTableAddress;
  }

  /** Get global variables table address */
  get globalsAddress(): ByteAddress {
    return this.data.globalsAddress;
  }

  /** Get static memory base address */
  get staticMemoryBase(): ByteAddress {
    return this.data.staticMemoryBase;
  }

  /** Get flags 2 value */
  get flags2(): number {
    return this.data.flags2;
  }

  /** Get serial number */
  get serialNumber(): string {
    return this.data.serialNumber;
  }

  /** Get abbreviations table address */
  get abbreviationsAddress(): ByteAddress {
    return this.data.abbreviationsAddress;
  }

  /** Get file length in bytes */
  get fileLength(): number {
    return this.data.fileLength;
  }

  /** Get file checksum */
  get checksum(): number {
    return this.data.checksum;
  }

  /**
   * Check if a Flags1 bit is set (for V3)
   */
  hasFlag1(flag: number): boolean {
    return (this.data.flags1 & flag) !== 0;
  }

  /**
   * Check if a Flags2 bit is set
   */
  hasFlag2(flag: number): boolean {
    return (this.data.flags2 & flag) !== 0;
  }

  /**
   * Set a Flags2 bit (these are writable by the interpreter)
   */
  setFlag2(flag: number, value: boolean): void {
    const currentFlags = this.memory.readWord(HeaderAddress.FLAGS2);
    const newFlags = value ? currentFlags | flag : currentFlags & ~flag;
    this.memory.writeWord(HeaderAddress.FLAGS2, newFlags);
    this.data.flags2 = newFlags;
  }

  /**
   * Get the packed address multiplier for this version
   * Used to convert packed addresses to byte addresses
   */
  get packedAddressMultiplier(): number {
    if (this.data.version <= 3) {
      return 2;
    } else if (this.data.version <= 5) {
      return 4;
    } else {
      return 8;
    }
  }

  /**
   * Convert a packed address to a byte address
   */
  unpackAddress(packed: number, isString: boolean = false): ByteAddress {
    const version = this.data.version;

    if (version <= 3) {
      return packed * 2;
    } else if (version <= 5) {
      return packed * 4;
    } else if (version <= 7) {
      // V6-7 have separate offsets for routines and strings
      const offset = isString
        ? this.memory.readWord(HeaderAddress.STRINGS_OFFSET) * 8
        : this.memory.readWord(HeaderAddress.ROUTINES_OFFSET) * 8;
      return packed * 4 + offset;
    } else {
      return packed * 8;
    }
  }

  /**
   * Set interpreter information in header (for V4+)
   */
  setInterpreterInfo(interpreterNumber: number, interpreterVersion: number): void {
    if (this.data.version >= 4) {
      this.memory.writeByte(HeaderAddress.INTERPRETER_NUMBER, interpreterNumber);
      this.memory.writeByte(HeaderAddress.INTERPRETER_VERSION, interpreterVersion);
    }
  }

  /**
   * Set screen dimensions in header (for V4+)
   */
  setScreenDimensions(width: number, height: number): void {
    if (this.data.version >= 4) {
      this.memory.writeByte(HeaderAddress.SCREEN_WIDTH, width);
      this.memory.writeByte(HeaderAddress.SCREEN_HEIGHT, height);
    }
    if (this.data.version >= 5) {
      this.memory.writeWord(HeaderAddress.SCREEN_WIDTH_UNITS, width);
      this.memory.writeWord(HeaderAddress.SCREEN_HEIGHT_UNITS, height);
    }
  }
}
