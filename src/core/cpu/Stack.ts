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
import { StackError } from '../errors/ZMachineError';

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
      throw new StackError('No stack frames: call stack is empty');
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
      throw new StackError('Cannot pop initial stack frame');
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
      frames: this.frames.map((frame) => ({
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

  /**
   * Get the current stack frame depth (for catch opcode)
   * Returns 0 for the initial/main routine frame
   */
  getFramePointer(): number {
    return this.frames.length;
  }

  /**
   * Unwind the stack to a specific depth (for throw opcode)
   * Pops frames until we reach the target depth
   *
   * @param targetDepth - The frame depth to unwind to (from catch)
   * @returns The frame we unwound to (for getting return PC)
   * @throws Error if target depth is invalid
   */
  unwindTo(targetDepth: number): StackFrame {
    if (targetDepth < 1 || targetDepth > this.frames.length) {
      throw new StackError(`Invalid stack frame pointer: ${targetDepth}`);
    }

    // Pop frames until we reach target depth
    while (this.frames.length > targetDepth) {
      this.frames.pop();
    }

    // Pop and return the target frame (the one we're returning from)
    return this.frames.pop()!;
  }

  /**
   * Serialize stack for undo (lightweight format)
   */
  serialize(): { data: number[]; framePointers: number[] } {
    const snapshot = this.snapshot();
    const data: number[] = [];
    const framePointers: number[] = [];

    for (const frame of snapshot.frames) {
      framePointers.push(data.length);
      data.push(frame.returnPC);
      data.push(frame.storeVariable ?? -1);
      data.push(frame.argumentCount);
      data.push(frame.locals.length);
      data.push(...frame.locals);
      data.push(frame.evalStack.length);
      data.push(...frame.evalStack);
    }

    return { data, framePointers };
  }

  /**
   * Deserialize stack from undo format
   */
  deserialize(serialized: { data: number[]; framePointers: number[] }): void {
    const { data, framePointers } = serialized;
    this.frames.length = 0;

    for (const ptr of framePointers) {
      let i = ptr;
      const returnPC = data[i++];
      const storeVar = data[i++];
      const storeVariable = storeVar === -1 ? undefined : storeVar;
      const argumentCount = data[i++];
      const localCount = data[i++];
      const locals: number[] = [];
      for (let j = 0; j < localCount; j++) {
        locals.push(data[i++]);
      }
      const stackLen = data[i++];
      const evalStack: number[] = [];
      for (let j = 0; j < stackLen; j++) {
        evalStack.push(data[i++]);
      }

      const frame = new StackFrame(returnPC, storeVariable, localCount, argumentCount);
      frame.initializeLocals(locals);
      frame.restoreStack(evalStack);
      this.frames.push(frame);
    }
  }
}
