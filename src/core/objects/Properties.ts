/**
 * Property Access
 *
 * Each object has a property table containing variable-length properties.
 * The table starts with the object's short name, followed by property entries.
 *
 * V1-3 Property Entry:
 * - 1 byte: size/number byte (bits 7-5 = size-1, bits 4-0 = property number)
 * - 1-8 bytes: property data
 *
 * V4+ Property Entry:
 * - 1-2 bytes: size/number bytes
 *   - If bit 7 set: 2-byte format
 *     - First byte: bit 7=1, bits 5-0 = property number
 *     - Second byte: bits 5-0 = size (0 means 64 bytes)
 *   - If bit 7 clear: 1-byte format
 *     - bit 6 = 0: 1 byte data, bit 6 = 1: 2 bytes data
 *     - bits 5-0 = property number
 * - 1-64 bytes: property data
 *
 * Properties are stored in descending order by number.
 * A size byte of 0 marks the end of the property list.
 *
 * Reference: Z-Machine Specification §12.4
 *
 * @module
 */

import { ByteAddress, PropertyNumber, ZVersion } from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { ObjectTable } from './ObjectTable';
import { ObjectError } from '../errors/ZMachineError';

/**
 * Decoded property information
 */
export interface PropertyInfo {
  /** Property number (1-31 or 1-63) */
  number: PropertyNumber;
  /** Address of property data */
  address: ByteAddress;
  /** Length of property data in bytes */
  length: number;
  /** Address of next property (or 0 if last) */
  nextAddress: ByteAddress;
}

/**
 * Property table handler
 */
export class Properties {
  private readonly memory: Memory;
  private readonly version: ZVersion;
  private readonly objectTable: ObjectTable;

  constructor(memory: Memory, version: ZVersion, objectTable: ObjectTable) {
    this.memory = memory;
    this.version = version;
    this.objectTable = objectTable;
  }

  /**
   * Get the address of the first property in an object's property table
   * (after the short name)
   */
  getFirstPropertyAddress(objectNum: number): ByteAddress {
    const propTableAddr = this.objectTable.getPropertyTableAddress(objectNum);
    // Skip the short name: first byte is length in words
    const nameLength = this.memory.readByte(propTableAddr);
    return propTableAddr + 1 + nameLength * 2;
  }

  /**
   * Decode a property entry at the given address
   * Returns null if at end of property list (size byte is 0)
   */
  decodePropertyAt(address: ByteAddress): PropertyInfo | null {
    const sizeByte = this.memory.readByte(address);

    // End of property list
    if (sizeByte === 0) {
      return null;
    }

    if (this.version <= 3) {
      // V1-3: single byte header
      // Bits 7-5: size - 1 (0-7 means 1-8 bytes)
      // Bits 4-0: property number (1-31)
      const propNum = sizeByte & 0x1f;
      const propLen = ((sizeByte >> 5) & 0x07) + 1;
      const dataAddr = address + 1;

      return {
        number: propNum,
        address: dataAddr,
        length: propLen,
        nextAddress: dataAddr + propLen,
      };
    } else {
      // V4+: 1 or 2 byte header
      if (sizeByte & 0x80) {
        // Two-byte header
        // First byte: bit 7=1, bits 5-0 = property number
        // Second byte: bits 5-0 = size (0 means 64)
        const propNum = sizeByte & 0x3f;
        const sizeByte2 = this.memory.readByte(address + 1);
        let propLen = sizeByte2 & 0x3f;
        if (propLen === 0) propLen = 64;
        const dataAddr = address + 2;

        return {
          number: propNum,
          address: dataAddr,
          length: propLen,
          nextAddress: dataAddr + propLen,
        };
      } else {
        // One-byte header
        // Bit 6: 0 = 1 byte, 1 = 2 bytes
        // Bits 5-0: property number
        const propNum = sizeByte & 0x3f;
        const propLen = sizeByte & 0x40 ? 2 : 1;
        const dataAddr = address + 1;

        return {
          number: propNum,
          address: dataAddr,
          length: propLen,
          nextAddress: dataAddr + propLen,
        };
      }
    }
  }

  /**
   * Find a specific property in an object's property table
   * Returns null if property not found
   */
  findProperty(objectNum: number, propNum: PropertyNumber): PropertyInfo | null {
    let addr = this.getFirstPropertyAddress(objectNum);

    while (true) {
      const prop = this.decodePropertyAt(addr);
      if (prop === null) {
        return null; // End of list
      }

      if (prop.number === propNum) {
        return prop;
      }

      // Properties are in descending order
      if (prop.number < propNum) {
        return null; // Passed it, not found
      }

      addr = prop.nextAddress;
    }
  }

  /**
   * Get the value of a property
   * If property doesn't exist, returns the default value
   * Only works for 1-2 byte properties
   */
  getProperty(objectNum: number, propNum: PropertyNumber): number {
    const prop = this.findProperty(objectNum, propNum);

    if (prop === null) {
      // Return default
      return this.objectTable.getPropertyDefault(propNum);
    }

    if (prop.length === 1) {
      return this.memory.readByte(prop.address);
    } else if (prop.length === 2) {
      return this.memory.readWord(prop.address);
    } else {
      // Spec says behavior is undefined for >2 bytes
      // Most interpreters return the first word
      return this.memory.readWord(prop.address);
    }
  }

  /**
   * Set the value of a property
   * Property must exist and be 1 or 2 bytes
   */
  putProperty(objectNum: number, propNum: PropertyNumber, value: number): void {
    const prop = this.findProperty(objectNum, propNum);

    if (prop === null) {
      throw new ObjectError(`Property ${propNum} not found`, objectNum);
    }

    if (prop.length === 1) {
      this.memory.writeByte(prop.address, value & 0xff);
    } else if (prop.length === 2) {
      this.memory.writeWord(prop.address, value & 0xffff);
    } else {
      throw new ObjectError(`Cannot put_prop on property of length ${prop.length}`, objectNum);
    }
  }

  /**
   * Get the address of a property's data
   * Returns 0 if property not found
   */
  getPropertyAddress(objectNum: number, propNum: PropertyNumber): ByteAddress {
    const prop = this.findProperty(objectNum, propNum);
    return prop ? prop.address : 0;
  }

  /**
   * Get the length of a property given its data address
   * This is used by get_prop_len opcode
   */
  getPropertyLength(propDataAddress: ByteAddress): number {
    if (propDataAddress === 0) {
      return 0;
    }

    // The size byte is before the data address
    const sizeByte = this.memory.readByte(propDataAddress - 1);

    if (this.version <= 3) {
      // V1-3: bits 7-5 = size - 1
      return ((sizeByte >> 5) & 0x07) + 1;
    } else {
      // V4+: Check if this is the first or second byte of header
      if (sizeByte & 0x80) {
        // This is the second byte of a 2-byte header
        let len = sizeByte & 0x3f;
        if (len === 0) len = 64;
        return len;
      } else {
        // This is a 1-byte header
        return sizeByte & 0x40 ? 2 : 1;
      }
    }
  }

  /**
   * Get the next property number after the given one
   * If propNum is 0, returns the first property number
   * Returns 0 if no more properties
   */
  getNextProperty(objectNum: number, propNum: PropertyNumber): PropertyNumber {
    if (propNum === 0) {
      // Get first property
      const firstAddr = this.getFirstPropertyAddress(objectNum);
      const prop = this.decodePropertyAt(firstAddr);
      return prop ? prop.number : 0;
    }

    // Find the given property and return the next one
    const prop = this.findProperty(objectNum, propNum);
    if (prop === null) {
      throw new ObjectError(`Property ${propNum} not found`, objectNum);
    }

    const nextProp = this.decodePropertyAt(prop.nextAddress);
    return nextProp ? nextProp.number : 0;
  }
}
