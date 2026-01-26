/**
 * Z-Machine Error Classes
 *
 * Custom error hierarchy for Z-machine emulator errors.
 * Provides structured error information for better debugging.
 *
 * @module
 */

import { ByteAddress } from '../../types/ZMachineTypes';

/**
 * Base error class for all Z-machine errors
 */
export class ZMachineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZMachineError';
    Object.setPrototypeOf(this, ZMachineError.prototype);
  }
}

/**
 * Error during memory operations (read/write out of bounds, static memory write)
 */
export class MemoryError extends ZMachineError {
  readonly address: ByteAddress;
  readonly operation: 'read' | 'write';

  constructor(message: string, address: ByteAddress, operation: 'read' | 'write') {
    super(`${message} at address 0x${address.toString(16).toUpperCase().padStart(4, '0')}`);
    this.name = 'MemoryError';
    this.address = address;
    this.operation = operation;
    Object.setPrototypeOf(this, MemoryError.prototype);
  }
}

/**
 * Error during opcode execution
 */
export class OpcodeError extends ZMachineError {
  readonly opcode: string;
  readonly address: ByteAddress;

  constructor(message: string, opcode: string, address: ByteAddress) {
    super(
      `${message} (opcode: ${opcode} at 0x${address.toString(16).toUpperCase().padStart(4, '0')})`
    );
    this.name = 'OpcodeError';
    this.opcode = opcode;
    this.address = address;
    Object.setPrototypeOf(this, OpcodeError.prototype);
  }
}

/**
 * Error during instruction decoding
 */
export class DecodeError extends ZMachineError {
  readonly address: ByteAddress;
  readonly opcodeByte: number;

  constructor(message: string, address: ByteAddress, opcodeByte: number) {
    super(
      `${message} at 0x${address.toString(16).toUpperCase().padStart(4, '0')} (byte: 0x${opcodeByte.toString(16).toUpperCase().padStart(2, '0')})`
    );
    this.name = 'DecodeError';
    this.address = address;
    this.opcodeByte = opcodeByte;
    Object.setPrototypeOf(this, DecodeError.prototype);
  }
}

/**
 * Error during stack operations
 */
export class StackError extends ZMachineError {
  constructor(message: string) {
    super(message);
    this.name = 'StackError';
    Object.setPrototypeOf(this, StackError.prototype);
  }
}

/**
 * Error with object operations (invalid object number, etc.)
 */
export class ObjectError extends ZMachineError {
  readonly objectNumber: number;

  constructor(message: string, objectNumber: number) {
    super(`${message} (object: ${objectNumber})`);
    this.name = 'ObjectError';
    this.objectNumber = objectNumber;
    Object.setPrototypeOf(this, ObjectError.prototype);
  }
}

/**
 * Error during save/restore operations
 */
export class SaveError extends ZMachineError {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
    Object.setPrototypeOf(this, SaveError.prototype);
  }
}

/**
 * Error with I/O operations
 */
export class IOError extends ZMachineError {
  constructor(message: string) {
    super(message);
    this.name = 'IOError';
    Object.setPrototypeOf(this, IOError.prototype);
  }
}

/**
 * Error with variable operations (invalid variable number)
 */
export class VariableError extends ZMachineError {
  readonly variableNumber: number;

  constructor(message: string, variableNumber: number) {
    super(`${message} (variable: ${variableNumber})`);
    this.name = 'VariableError';
    this.variableNumber = variableNumber;
    Object.setPrototypeOf(this, VariableError.prototype);
  }
}

/**
 * Error with dictionary operations
 */
export class DictionaryError extends ZMachineError {
  constructor(message: string) {
    super(message);
    this.name = 'DictionaryError';
    Object.setPrototypeOf(this, DictionaryError.prototype);
  }
}

/**
 * Format an address as a hex string
 */
export function formatAddress(address: ByteAddress): string {
  return `0x${address.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Format a byte as a hex string
 */
export function formatByte(byte: number): string {
  return `0x${(byte & 0xff).toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * Format a word as a hex string
 */
export function formatWord(word: number): string {
  return `0x${(word & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}
