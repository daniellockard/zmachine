/**
 * Address utility functions for Z-machine
 * 
 * The Z-machine uses three types of addresses:
 * - Byte addresses: Direct offsets into memory
 * - Word addresses: Multiply by 2 to get byte address
 * - Packed addresses: Multiply by 2/4/8 depending on version
 * 
 * Reference: Z-Machine Specification §1.2.3
 * 
 * @module
 */

import { ByteAddress, WordAddress, PackedAddress, ZVersion } from '../../types/ZMachineTypes';

/**
 * Convert a word address to a byte address
 * Word addresses are multiplied by 2
 */
export function wordAddressToByteAddress(wordAddress: WordAddress): ByteAddress {
  return wordAddress * 2;
}

/**
 * Convert a byte address to a word address
 * Byte address must be even
 */
export function byteAddressToWordAddress(byteAddress: ByteAddress): WordAddress {
  if (byteAddress % 2 !== 0) {
    throw new Error(`Byte address 0x${byteAddress.toString(16)} is not word-aligned`);
  }
  return byteAddress / 2;
}

/**
 * Get the packed address multiplier for a Z-machine version
 * 
 * - V1-3: 2
 * - V4-5: 4
 * - V6-7: 4 (with offset, handled separately)
 * - V8: 8
 */
export function getPackedAddressMultiplier(version: ZVersion): number {
  if (version <= 3) {
    return 2;
  } else if (version <= 5) {
    return 4;
  } else if (version <= 7) {
    return 4;
  } else {
    return 8;
  }
}

/**
 * Convert a packed routine address to a byte address
 * 
 * @param packedAddress - The packed address from the instruction
 * @param version - Z-machine version
 * @param routineOffset - Routine offset for V6-7 (from header, multiplied by 8)
 */
export function unpackRoutineAddress(
  packedAddress: PackedAddress,
  version: ZVersion,
  routineOffset: number = 0
): ByteAddress {
  if (version <= 3) {
    return packedAddress * 2;
  } else if (version <= 5) {
    return packedAddress * 4;
  } else if (version <= 7) {
    return packedAddress * 4 + routineOffset;
  } else {
    return packedAddress * 8;
  }
}

/**
 * Convert a packed string address to a byte address
 * 
 * @param packedAddress - The packed address from the instruction
 * @param version - Z-machine version
 * @param stringOffset - String offset for V6-7 (from header, multiplied by 8)
 */
export function unpackStringAddress(
  packedAddress: PackedAddress,
  version: ZVersion,
  stringOffset: number = 0
): ByteAddress {
  if (version <= 3) {
    return packedAddress * 2;
  } else if (version <= 5) {
    return packedAddress * 4;
  } else if (version <= 7) {
    return packedAddress * 4 + stringOffset;
  } else {
    return packedAddress * 8;
  }
}

/**
 * Convert a signed 16-bit value to unsigned
 * Z-machine uses 16-bit values that can be interpreted as signed or unsigned
 */
export function toUnsigned16(value: number): number {
  return value & 0xFFFF;
}

/**
 * Convert an unsigned 16-bit value to signed
 */
export function toSigned16(value: number): number {
  const unsigned = value & 0xFFFF;
  return unsigned > 0x7FFF ? unsigned - 0x10000 : unsigned;
}

/**
 * Convert a signed 8-bit value to unsigned
 */
export function toUnsigned8(value: number): number {
  return value & 0xFF;
}

/**
 * Convert an unsigned 8-bit value to signed
 */
export function toSigned8(value: number): number {
  const unsigned = value & 0xFF;
  return unsigned > 0x7F ? unsigned - 0x100 : unsigned;
}

/**
 * Check if a byte address is valid for a given memory size
 */
export function isValidAddress(address: ByteAddress, memorySize: number): boolean {
  return address >= 0 && address < memorySize;
}

/**
 * Check if a byte address is word-aligned (even)
 */
export function isWordAligned(address: ByteAddress): boolean {
  return address % 2 === 0;
}
