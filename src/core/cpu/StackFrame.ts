/**
 * Stack Frame for Z-machine routine calls
 * 
 * Each routine call creates a new stack frame containing:
 * - Return address (where to resume after routine returns)
 * - Local variables (0-15 per routine)
 * - Evaluation stack for the routine
 * - Store variable (where to put return value)
 * 
 * Reference: Z-Machine Specification §5
 * 
 * @module
 */

import { ByteAddress, VariableNumber, Word } from '../../types/ZMachineTypes';

/**
 * Represents a single routine call frame on the call stack
 */
export class StackFrame {
  /** Address to return to when routine completes */
  readonly returnPC: ByteAddress;
  
  /** Variable to store return value (undefined for V3 call with no store) */
  readonly storeVariable: VariableNumber | undefined;
  
  /** Local variables for this routine (0-15) */
  private readonly locals: Word[];
  
  /** Evaluation stack for this routine */
  private readonly evalStack: Word[];
  
  /** Number of arguments passed to this routine (for argc checks) */
  readonly argumentCount: number;

  /**
   * Create a new stack frame
   * 
   * @param returnPC - Address to return to when routine completes
   * @param storeVariable - Variable to store return value (undefined if discarded)
   * @param localCount - Number of local variables (0-15)
   * @param argumentCount - Number of arguments passed
   */
  constructor(
    returnPC: ByteAddress,
    storeVariable: VariableNumber | undefined,
    localCount: number,
    argumentCount: number
  ) {
    if (localCount < 0 || localCount > 15) {
      throw new Error(`Invalid local variable count: ${localCount} (must be 0-15)`);
    }
    
    this.returnPC = returnPC;
    this.storeVariable = storeVariable;
    this.locals = new Array(localCount).fill(0);
    this.evalStack = [];
    this.argumentCount = argumentCount;
  }

  /**
   * Get the number of local variables in this frame
   */
  get localCount(): number {
    return this.locals.length;
  }

  /**
   * Get the current evaluation stack depth
   */
  get stackDepth(): number {
    return this.evalStack.length;
  }

  /**
   * Get a local variable value
   * 
   * @param index - Local variable number (0-14, as 1-15 in opcodes)
   * @returns The variable value
   */
  getLocal(index: number): Word {
    if (index < 0 || index >= this.locals.length) {
      throw new Error(
        `Local variable ${index + 1} out of range (routine has ${this.locals.length} locals)`
      );
    }
    return this.locals[index];
  }

  /**
   * Set a local variable value
   * 
   * @param index - Local variable number (0-14, as 1-15 in opcodes)
   * @param value - The value to set
   */
  setLocal(index: number, value: Word): void {
    if (index < 0 || index >= this.locals.length) {
      throw new Error(
        `Local variable ${index + 1} out of range (routine has ${this.locals.length} locals)`
      );
    }
    this.locals[index] = value & 0xFFFF;
  }

  /**
   * Initialize local variables with values (for V3 routine headers or arguments)
   * 
   * @param values - Array of initial values
   */
  initializeLocals(values: Word[]): void {
    for (let i = 0; i < values.length && i < this.locals.length; i++) {
      this.locals[i] = values[i] & 0xFFFF;
    }
  }

  /**
   * Push a value onto the evaluation stack
   * 
   * @param value - The value to push
   */
  push(value: Word): void {
    this.evalStack.push(value & 0xFFFF);
  }

  /**
   * Pop a value from the evaluation stack
   * 
   * @returns The popped value
   * @throws Error if stack is empty
   */
  pop(): Word {
    if (this.evalStack.length === 0) {
      throw new Error('Stack underflow: cannot pop from empty evaluation stack');
    }
    return this.evalStack.pop()!;
  }

  /**
   * Peek at the top of the evaluation stack without removing it
   * 
   * @returns The top value
   * @throws Error if stack is empty
   */
  peek(): Word {
    if (this.evalStack.length === 0) {
      throw new Error('Stack underflow: cannot peek at empty evaluation stack');
    }
    return this.evalStack[this.evalStack.length - 1];
  }

  /**
   * Get a copy of all local variables (for save/restore)
   */
  getLocalsSnapshot(): Word[] {
    return [...this.locals];
  }

  /**
   * Get a copy of the evaluation stack (for save/restore)
   */
  getStackSnapshot(): Word[] {
    return [...this.evalStack];
  }

  /**
   * Restore evaluation stack from a snapshot
   */
  restoreStack(stack: Word[]): void {
    this.evalStack.length = 0;
    this.evalStack.push(...stack);
  }
}
