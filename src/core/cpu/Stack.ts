/**
 * Call Stack for Z-machine
 * 
 * Manages the stack of routine call frames. The Z-machine's stack is
 * external to addressable memory and consists of:
 * - A stack of call frames (one per active routine)
 * - Each frame has its own local variables and evaluation stack
 * 
 * Variable 0x00 (the "stack") pushes to/pops from the current frame's
 * evaluation stack.
 * 
 * Reference: Z-Machine Specification §6
 * 
 * @module
 */

import { ByteAddress, VariableNumber, Word } from '../../types/ZMachineTypes';
import { StackFrame } from './StackFrame';

/**
 * Snapshot of the entire call stack for save/restore
 */
export interface CallStackSnapshot {
  frames: Array<{
    returnPC: ByteAddress;
    storeVariable: VariableNumber | undefined;
    argumentCount: number;
    locals: Word[];
    evalStack: Word[];
  }>;
}

/**
 * Manages the Z-machine call stack
 */
export class Stack {
  /** Stack of call frames */
  private readonly frames: StackFrame[] = [];

  /**
   * Get the current call depth (number of active routines)
   */
  get depth(): number {
    return this.frames.length;
  }

  /**
   * Get the current (topmost) stack frame
   * 
   * @throws Error if no frames on stack (should never happen after initialization)
   */
  get currentFrame(): StackFrame {
    if (this.frames.length === 0) {
      throw new Error('No stack frames: call stack is empty');
    }
    return this.frames[this.frames.length - 1];
  }

  /**
   * Push a new frame for a routine call
   * 
   * @param returnPC - Address to return to after routine completes
   * @param storeVariable - Variable to store return value (undefined if discarded)
   * @param localCount - Number of local variables in the routine
   * @param argumentCount - Number of arguments passed
   * @returns The new stack frame
   */
  pushFrame(
    returnPC: ByteAddress,
    storeVariable: VariableNumber | undefined,
    localCount: number,
    argumentCount: number
  ): StackFrame {
    const frame = new StackFrame(returnPC, storeVariable, localCount, argumentCount);
    this.frames.push(frame);
    return frame;
  }

  /**
   * Pop the current frame (routine return)
   * 
   * @returns The popped frame
   * @throws Error if trying to pop the last frame
   */
  popFrame(): StackFrame {
    if (this.frames.length <= 1) {
      throw new Error('Cannot pop initial stack frame');
    }
    return this.frames.pop()!;
  }

  /**
   * Initialize the stack with the main routine's frame
   * Called at game start with PC pointing to main routine
   * 
   * @param localCount - Number of locals in main routine
   */
  initialize(localCount: number): void {
    this.frames.length = 0;
    // Main routine has no return address, no store variable
    // Using 0 as a sentinel for "nowhere to return"
    this.pushFrame(0, undefined, localCount, 0);
  }

  /**
   * Push a value onto the current frame's evaluation stack
   * (Used by variable 0x00)
   */
  push(value: Word): void {
    this.currentFrame.push(value);
  }

  /**
   * Pop a value from the current frame's evaluation stack
   * (Used by variable 0x00)
   */
  pop(): Word {
    return this.currentFrame.pop();
  }

  /**
   * Peek at top of current frame's evaluation stack
   */
  peek(): Word {
    return this.currentFrame.peek();
  }

  /**
   * Get a local variable from the current frame
   * 
   * @param index - Local variable index (0-14)
   */
  getLocal(index: number): Word {
    return this.currentFrame.getLocal(index);
  }

  /**
   * Set a local variable in the current frame
   * 
   * @param index - Local variable index (0-14)
   * @param value - Value to set
   */
  setLocal(index: number, value: Word): void {
    this.currentFrame.setLocal(index, value);
  }

  /**
   * Check if a given argument was supplied to the current routine
   * (For check_arg_count opcode)
   * 
   * @param argNumber - Argument number (1-based)
   */
  hasArgument(argNumber: number): boolean {
    return argNumber <= this.currentFrame.argumentCount;
  }

  /**
   * Create a snapshot of the entire call stack (for save)
   */
  snapshot(): CallStackSnapshot {
    return {
      frames: this.frames.map(frame => ({
        returnPC: frame.returnPC,
        storeVariable: frame.storeVariable,
        argumentCount: frame.argumentCount,
        locals: frame.getLocalsSnapshot(),
        evalStack: frame.getStackSnapshot(),
      })),
    };
  }

  /**
   * Restore the call stack from a snapshot (for restore)
   */
  restore(snapshot: CallStackSnapshot): void {
    this.frames.length = 0;
    
    for (const frameData of snapshot.frames) {
      const frame = new StackFrame(
        frameData.returnPC,
        frameData.storeVariable,
        frameData.locals.length,
        frameData.argumentCount
      );
      frame.initializeLocals(frameData.locals);
      frame.restoreStack(frameData.evalStack);
      this.frames.push(frame);
    }
  }

  /**
   * Clear the stack (for restart)
   */
  clear(): void {
    this.frames.length = 0;
  }
}
