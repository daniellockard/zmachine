/**
 * Memory module for Z-machine
 * 
 * Provides read/write access to the Z-machine's memory using an ArrayBuffer.
 * All multi-byte values are big-endian as per the Z-machine specification.
 * 
 * Memory layout (§1.1):
 * - Dynamic memory: 0x00 to static memory mark (read/write)
 * - Static memory: After dynamic, up to 0xFFFF (read-only during play)
 * - High memory: Above static, contains routines and strings
 * 
 * @module
 */

import { ByteAddress, Word, Byte } from '../../types/ZMachineTypes';

/**
 * Z-machine memory implementation
 * 
 * Uses ArrayBuffer for storage and DataView for big-endian access.
 * No external dependencies - uses only built-in browser/Node APIs.
 */
export class Memory {
  /** Raw memory buffer */
  private readonly buffer: ArrayBuffer;
  /** DataView for big-endian access */
  private readonly view: DataView;
  /** Original story file for restart */
  private readonly originalBuffer: ArrayBuffer;
  /** Static memory boundary - writes above this are forbidden */
  private staticMemoryBase: ByteAddress = 0;

  /**
   * Create a new Memory instance from a story file
   * 
   * @param storyData - The raw story file data as an ArrayBuffer
   */
  constructor(storyData: ArrayBuffer) {
    // Make a copy so we can modify it
    this.buffer = storyData.slice(0);
    this.view = new DataView(this.buffer);
    
    // Keep original for restart
    this.originalBuffer = storyData.slice(0);
    
    // Read static memory base from header (offset 0x0E)
    // We'll set this properly once header is parsed
    this.staticMemoryBase = this.view.getUint16(0x0E, false);
  }

  /**
   * Get the total size of memory in bytes
   */
  get size(): number {
    return this.buffer.byteLength;
  }

  /**
   * Get the static memory boundary address
   */
  get staticBase(): ByteAddress {
    return this.staticMemoryBase;
  }

  /**
   * Read a single byte from memory
   * 
   * @param address - Byte address to read from
   * @returns The byte value (0-255)
   * @throws Error if address is out of bounds
   */
  readByte(address: ByteAddress): Byte {
    this.validateAddress(address);
    return this.view.getUint8(address);
  }

  /**
   * Read a 16-bit word from memory (big-endian)
   * 
   * @param address - Byte address to read from
   * @returns The word value (0-65535)
   * @throws Error if address is out of bounds
   */
  readWord(address: ByteAddress): Word {
    this.validateAddress(address);
    this.validateAddress(address + 1);
    return this.view.getUint16(address, false); // false = big-endian
  }

  /**
   * Write a single byte to memory
   * 
   * @param address - Byte address to write to
   * @param value - Byte value to write (0-255)
   * @throws Error if address is out of bounds or in static/high memory
   */
  writeByte(address: ByteAddress, value: Byte): void {
    this.validateWriteAddress(address);
    this.view.setUint8(address, value & 0xFF);
  }

  /**
   * Write a 16-bit word to memory (big-endian)
   * 
   * @param address - Byte address to write to
   * @param value - Word value to write (0-65535)
   * @throws Error if address is out of bounds or in static/high memory
   */
  writeWord(address: ByteAddress, value: Word): void {
    this.validateWriteAddress(address);
    this.validateWriteAddress(address + 1);
    this.view.setUint16(address, value & 0xFFFF, false); // false = big-endian
  }

  /**
   * Read a sequence of bytes from memory
   * 
   * @param address - Starting byte address
   * @param length - Number of bytes to read
   * @returns Uint8Array containing the bytes
   */
  readBytes(address: ByteAddress, length: number): Uint8Array {
    this.validateAddress(address);
    this.validateAddress(address + length - 1);
    return new Uint8Array(this.buffer, address, length);
  }

  /**
   * Get direct access to the underlying buffer
   * Used for save/restore operations
   */
  getBuffer(): ArrayBuffer {
    return this.buffer;
  }

  /**
   * Get direct access to the DataView
   * Used for header parsing and other low-level operations
   */
  getView(): DataView {
    return this.view;
  }

  /**
   * Reset dynamic memory to original state (for restart)
   */
  restart(): void {
    const original = new Uint8Array(this.originalBuffer);
    const current = new Uint8Array(this.buffer);
    
    // Only copy dynamic memory (0 to staticMemoryBase)
    for (let i = 0; i < this.staticMemoryBase; i++) {
      current[i] = original[i];
    }
  }

  /**
   * Update static memory base (called after header parsing)
   */
  setStaticMemoryBase(address: ByteAddress): void {
    this.staticMemoryBase = address;
  }

  /**
   * Validate that an address is within bounds for reading
   */
  private validateAddress(address: ByteAddress): void {
    if (address < 0 || address >= this.buffer.byteLength) {
      throw new Error(`Memory read out of bounds: 0x${address.toString(16)}`);
    }
  }

  /**
   * Validate that an address is within bounds and writable
   */
  private validateWriteAddress(address: ByteAddress): void {
    this.validateAddress(address);
    if (address >= this.staticMemoryBase) {
      throw new Error(
        `Cannot write to static/high memory at 0x${address.toString(16)} ` +
        `(static memory starts at 0x${this.staticMemoryBase.toString(16)})`
      );
    }
  }
}
