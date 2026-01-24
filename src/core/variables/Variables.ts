/**
 * Variables Module
 * 
 * Handles reading and writing Z-machine variables:
 * - Variable 0: Top of stack
 * - Variables 1-15: Local variables
 * - Variables 16-255: Global variables
 * 
 * Reference: Z-Machine Specification §4.2
 * 
 * @module
 */

import { ByteAddress } from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { Stack } from '../cpu/Stack';

/**
 * Variable number type
 * 0 = stack, 1-15 = locals, 16-255 = globals
 */
export type VariableNumber = number;

/**
 * Manages Z-machine variable access
 */
export class Variables {
  private readonly memory: Memory;
  private readonly stack: Stack;
  private readonly globalsAddress: ByteAddress;

  /**
   * Create a Variables manager
   * 
   * @param memory - The Z-machine memory
   * @param stack - The call stack
   * @param globalsAddress - Address of the global variables table
   */
  constructor(memory: Memory, stack: Stack, globalsAddress: ByteAddress) {
    this.memory = memory;
    this.stack = stack;
    this.globalsAddress = globalsAddress;
  }

  /**
   * Read a variable value
   * 
   * @param variable - Variable number (0-255)
   * @returns The variable value (16-bit)
   */
  read(variable: VariableNumber): number {
    if (variable < 0 || variable > 255) {
      throw new Error(`Invalid variable number: ${variable}`);
    }

    if (variable === 0) {
      // Stack variable - pop from stack
      return this.stack.pop();
    } else if (variable <= 15) {
      // Local variable (1-15)
      return this.stack.currentFrame.getLocal(variable - 1);
    } else {
      // Global variable (16-255)
      const offset = (variable - 16) * 2;
      return this.memory.readWord(this.globalsAddress + offset);
    }
  }

  /**
   * Read a variable value without popping from stack
   * Used for indirect reads where we need the value but shouldn't modify stack
   * 
   * @param variable - Variable number (0-255)
   * @returns The variable value (16-bit)
   */
  peek(variable: VariableNumber): number {
    if (variable < 0 || variable > 255) {
      throw new Error(`Invalid variable number: ${variable}`);
    }

    if (variable === 0) {
      // Peek at top of stack without popping
      return this.stack.peek();
    } else if (variable <= 15) {
      // Local variable (1-15)
      return this.stack.currentFrame.getLocal(variable - 1);
    } else {
      // Global variable (16-255)
      const offset = (variable - 16) * 2;
      return this.memory.readWord(this.globalsAddress + offset);
    }
  }

  /**
   * Write a variable value
   * 
   * @param variable - Variable number (0-255)
   * @param value - Value to write (16-bit)
   */
  write(variable: VariableNumber, value: number): void {
    if (variable < 0 || variable > 255) {
      throw new Error(`Invalid variable number: ${variable}`);
    }

    // Ensure 16-bit value
    const maskedValue = value & 0xFFFF;

    if (variable === 0) {
      // Stack variable - push to stack
      this.stack.push(maskedValue);
    } else if (variable <= 15) {
      // Local variable (1-15)
      this.stack.currentFrame.setLocal(variable - 1, maskedValue);
    } else {
      // Global variable (16-255)
      const offset = (variable - 16) * 2;
      this.memory.writeWord(this.globalsAddress + offset, maskedValue);
    }
  }

  /**
   * Store a result value to a variable
   * This is used for instruction store operations
   * For variable 0, it pushes (not replacing top)
   * 
   * @param variable - Variable number (0-255)
   * @param value - Value to store (16-bit)
   */
  store(variable: VariableNumber, value: number): void {
    this.write(variable, value);
  }

  /**
   * Load a value from a variable for operand evaluation
   * For variable 0, it pops the stack
   * 
   * @param variable - Variable number (0-255)
   * @returns The variable value (16-bit)
   */
  load(variable: VariableNumber): number {
    return this.read(variable);
  }

  /**
   * Increment a variable
   * 
   * @param variable - Variable number (0-255)
   */
  increment(variable: VariableNumber): void {
    const value = this.peek(variable);
    const newValue = (value + 1) & 0xFFFF;
    
    if (variable === 0) {
      // For stack, pop old value and push new
      this.stack.pop();
      this.stack.push(newValue);
    } else {
      this.write(variable, newValue);
    }
  }

  /**
   * Decrement a variable
   * 
   * @param variable - Variable number (0-255)
   */
  decrement(variable: VariableNumber): void {
    const value = this.peek(variable);
    const newValue = (value - 1) & 0xFFFF;
    
    if (variable === 0) {
      // For stack, pop old value and push new
      this.stack.pop();
      this.stack.push(newValue);
    } else {
      this.write(variable, newValue);
    }
  }

  /**
   * Check if a variable number is the stack
   */
  isStack(variable: VariableNumber): boolean {
    return variable === 0;
  }

  /**
   * Check if a variable number is a local
   */
  isLocal(variable: VariableNumber): boolean {
    return variable >= 1 && variable <= 15;
  }

  /**
   * Check if a variable number is a global
   */
  isGlobal(variable: VariableNumber): boolean {
    return variable >= 16 && variable <= 255;
  }

  /**
   * Get the address of a global variable in memory
   */
  getGlobalAddress(variable: VariableNumber): ByteAddress {
    if (!this.isGlobal(variable)) {
      throw new Error(`Not a global variable: ${variable}`);
    }
    return this.globalsAddress + (variable - 16) * 2;
  }
}
