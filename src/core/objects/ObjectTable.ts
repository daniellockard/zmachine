/**
 * Object Table
 * 
 * The Z-machine's object system is a tree structure where each object has:
 * - A parent object (0 = no parent)
 * - A sibling object (0 = no sibling)
 * - A child object (0 = no child)
 * - A set of attributes (flags)
 * - A property table with variable-length properties
 * 
 * V1-3: 31 attributes, 255 objects max, object entries are 9 bytes
 * V4+:  48 attributes, 65535 objects max, object entries are 14 bytes
 * 
 * Reference: Z-Machine Specification §12
 * 
 * @module
 */

import { ByteAddress, ObjectNumber, ZVersion } from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';

/**
 * Object entry structure for V1-3
 * 9 bytes total:
 * - 4 bytes: 32 attribute flags (only 31 used)
 * - 1 byte: parent object number
 * - 1 byte: sibling object number
 * - 1 byte: child object number
 * - 2 bytes: property table address
 */
const V3_ENTRY_SIZE = 9;
const V3_ATTR_BYTES = 4;
const V3_MAX_OBJECTS = 255;

/**
 * Object entry structure for V4+
 * 14 bytes total:
 * - 6 bytes: 48 attribute flags
 * - 2 bytes: parent object number
 * - 2 bytes: sibling object number
 * - 2 bytes: child object number
 * - 2 bytes: property table address
 */
const V4_ENTRY_SIZE = 14;
const V4_ATTR_BYTES = 6;
const V4_MAX_OBJECTS = 65535;

/**
 * Object table handler
 */
export class ObjectTable {
  private readonly memory: Memory;
  private readonly version: ZVersion;
  private readonly tableAddress: ByteAddress;

  /** Size of each object entry in bytes */
  readonly entrySize: number;
  /** Number of attribute bytes per object */
  readonly attrBytes: number;
  /** Maximum number of objects */
  readonly maxObjects: number;
  /** Address where object entries begin (after property defaults) */
  private readonly entriesStart: ByteAddress;

  constructor(memory: Memory, version: ZVersion, objectTableAddress: ByteAddress) {
    this.memory = memory;
    this.version = version;
    this.tableAddress = objectTableAddress;

    if (version <= 3) {
      this.entrySize = V3_ENTRY_SIZE;
      this.attrBytes = V3_ATTR_BYTES;
      this.maxObjects = V3_MAX_OBJECTS;
      // Property defaults table is 31 words (62 bytes) for V1-3
      this.entriesStart = objectTableAddress + 31 * 2;
    } else {
      this.entrySize = V4_ENTRY_SIZE;
      this.attrBytes = V4_ATTR_BYTES;
      this.maxObjects = V4_MAX_OBJECTS;
      // Property defaults table is 63 words (126 bytes) for V4+
      this.entriesStart = objectTableAddress + 63 * 2;
    }
  }

  /**
   * Get the address of an object entry
   * Object numbers are 1-based
   */
  getObjectAddress(objectNum: ObjectNumber): ByteAddress {
    if (objectNum < 1 || objectNum > this.maxObjects) {
      throw new Error(`Invalid object number: ${objectNum}`);
    }
    // Objects are 1-indexed, so subtract 1
    return this.entriesStart + (objectNum - 1) * this.entrySize;
  }

  /**
   * Get the parent of an object
   * Returns 0 if object has no parent
   */
  getParent(objectNum: ObjectNumber): ObjectNumber {
    const addr = this.getObjectAddress(objectNum);
    const parentOffset = this.attrBytes;

    if (this.version <= 3) {
      return this.memory.readByte(addr + parentOffset);
    } else {
      return this.memory.readWord(addr + parentOffset);
    }
  }

  /**
   * Set the parent of an object
   */
  setParent(objectNum: ObjectNumber, parent: ObjectNumber): void {
    const addr = this.getObjectAddress(objectNum);
    const parentOffset = this.attrBytes;

    if (this.version <= 3) {
      this.memory.writeByte(addr + parentOffset, parent);
    } else {
      this.memory.writeWord(addr + parentOffset, parent);
    }
  }

  /**
   * Get the sibling of an object
   * Returns 0 if object has no sibling
   */
  getSibling(objectNum: ObjectNumber): ObjectNumber {
    const addr = this.getObjectAddress(objectNum);
    const siblingOffset = this.attrBytes + (this.version <= 3 ? 1 : 2);

    if (this.version <= 3) {
      return this.memory.readByte(addr + siblingOffset);
    } else {
      return this.memory.readWord(addr + siblingOffset);
    }
  }

  /**
   * Set the sibling of an object
   */
  setSibling(objectNum: ObjectNumber, sibling: ObjectNumber): void {
    const addr = this.getObjectAddress(objectNum);
    const siblingOffset = this.attrBytes + (this.version <= 3 ? 1 : 2);

    if (this.version <= 3) {
      this.memory.writeByte(addr + siblingOffset, sibling);
    } else {
      this.memory.writeWord(addr + siblingOffset, sibling);
    }
  }

  /**
   * Get the first child of an object
   * Returns 0 if object has no children
   */
  getChild(objectNum: ObjectNumber): ObjectNumber {
    const addr = this.getObjectAddress(objectNum);
    const childOffset = this.attrBytes + (this.version <= 3 ? 2 : 4);

    if (this.version <= 3) {
      return this.memory.readByte(addr + childOffset);
    } else {
      return this.memory.readWord(addr + childOffset);
    }
  }

  /**
   * Set the first child of an object
   */
  setChild(objectNum: ObjectNumber, child: ObjectNumber): void {
    const addr = this.getObjectAddress(objectNum);
    const childOffset = this.attrBytes + (this.version <= 3 ? 2 : 4);

    if (this.version <= 3) {
      this.memory.writeByte(addr + childOffset, child);
    } else {
      this.memory.writeWord(addr + childOffset, child);
    }
  }

  /**
   * Get the property table address for an object
   */
  getPropertyTableAddress(objectNum: ObjectNumber): ByteAddress {
    const addr = this.getObjectAddress(objectNum);
    const propOffset = this.attrBytes + (this.version <= 3 ? 3 : 6);
    return this.memory.readWord(addr + propOffset);
  }

  /**
   * Test if an attribute is set on an object
   * Attributes are numbered 0 to 31 (V1-3) or 0 to 47 (V4+)
   */
  testAttribute(objectNum: ObjectNumber, attribute: number): boolean {
    if (attribute < 0 || attribute >= this.attrBytes * 8) {
      throw new Error(`Invalid attribute number: ${attribute}`);
    }

    const addr = this.getObjectAddress(objectNum);
    // Attributes are stored from highest bit first
    // Attribute 0 is bit 7 of byte 0, attribute 7 is bit 0 of byte 0
    // Attribute 8 is bit 7 of byte 1, etc.
    const byteIndex = Math.floor(attribute / 8);
    const bitIndex = 7 - (attribute % 8);
    const byte = this.memory.readByte(addr + byteIndex);

    return (byte & (1 << bitIndex)) !== 0;
  }

  /**
   * Set an attribute on an object
   */
  setAttribute(objectNum: ObjectNumber, attribute: number): void {
    if (attribute < 0 || attribute >= this.attrBytes * 8) {
      throw new Error(`Invalid attribute number: ${attribute}`);
    }

    const addr = this.getObjectAddress(objectNum);
    const byteIndex = Math.floor(attribute / 8);
    const bitIndex = 7 - (attribute % 8);
    const byte = this.memory.readByte(addr + byteIndex);

    this.memory.writeByte(addr + byteIndex, byte | (1 << bitIndex));
  }

  /**
   * Clear an attribute on an object
   */
  clearAttribute(objectNum: ObjectNumber, attribute: number): void {
    if (attribute < 0 || attribute >= this.attrBytes * 8) {
      throw new Error(`Invalid attribute number: ${attribute}`);
    }

    const addr = this.getObjectAddress(objectNum);
    const byteIndex = Math.floor(attribute / 8);
    const bitIndex = 7 - (attribute % 8);
    const byte = this.memory.readByte(addr + byteIndex);

    this.memory.writeByte(addr + byteIndex, byte & ~(1 << bitIndex));
  }

  /**
   * Remove an object from its parent's child list
   * This unlinks the object from the tree but doesn't delete it
   */
  removeFromParent(objectNum: ObjectNumber): void {
    const parent = this.getParent(objectNum);
    if (parent === 0) {
      return; // Already orphaned
    }

    const child = this.getChild(parent);

    if (child === objectNum) {
      // Object is first child - set parent's child to object's sibling
      this.setChild(parent, this.getSibling(objectNum));
    } else {
      // Find previous sibling
      let prev = child;
      let curr = this.getSibling(prev);

      while (curr !== 0 && curr !== objectNum) {
        prev = curr;
        curr = this.getSibling(curr);
      }

      if (curr === objectNum) {
        // Link previous sibling to object's sibling
        this.setSibling(prev, this.getSibling(objectNum));
      }
    }

    // Clear object's parent and sibling
    this.setParent(objectNum, 0);
    this.setSibling(objectNum, 0);
  }

  /**
   * Insert an object as the first child of a destination object
   */
  insertObject(objectNum: ObjectNumber, destination: ObjectNumber): void {
    // First remove from current parent
    this.removeFromParent(objectNum);

    // Insert as first child of destination
    const oldChild = this.getChild(destination);
    this.setChild(destination, objectNum);
    this.setParent(objectNum, destination);
    this.setSibling(objectNum, oldChild);
  }

  /**
   * Get the short name of an object (from property table header)
   * Returns the address of the short name text and its length in words
   */
  getShortNameAddress(objectNum: ObjectNumber): { address: ByteAddress; lengthBytes: number } {
    const propTableAddr = this.getPropertyTableAddress(objectNum);
    // First byte of property table is text length in words
    const lengthWords = this.memory.readByte(propTableAddr);
    return {
      address: propTableAddr + 1,
      lengthBytes: lengthWords * 2,
    };
  }

  /**
   * Get a property default value
   * Properties 1-31 (V1-3) or 1-63 (V4+) have defaults
   */
  getPropertyDefault(propNum: number): number {
    const maxProps = this.version <= 3 ? 31 : 63;
    if (propNum < 1 || propNum > maxProps) {
      throw new Error(`Invalid property number: ${propNum}`);
    }
    // Property defaults are stored as words, 1-indexed
    return this.memory.readWord(this.tableAddress + (propNum - 1) * 2);
  }
}
