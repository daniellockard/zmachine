/**
 * Tests for Stack module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Stack } from './Stack';

describe('Stack', () => {
  let stack: Stack;

  beforeEach(() => {
    stack = new Stack();
  });

  describe('initialization', () => {
    it('should start empty', () => {
      expect(stack.depth).toBe(0);
    });

    it('should throw when accessing currentFrame on empty stack', () => {
      expect(() => stack.currentFrame).toThrow('call stack is empty');
    });

    it('should initialize with main routine frame', () => {
      stack.initialize(5);
      
      expect(stack.depth).toBe(1);
      expect(stack.currentFrame.localCount).toBe(5);
      expect(stack.currentFrame.returnPC).toBe(0);
      expect(stack.currentFrame.storeVariable).toBeUndefined();
    });
  });

  describe('pushFrame', () => {
    beforeEach(() => {
      stack.initialize(3);
    });

    it('should push a new frame', () => {
      const frame = stack.pushFrame(0x1234, 0x10, 5, 3);
      
      expect(stack.depth).toBe(2);
      expect(stack.currentFrame).toBe(frame);
      expect(frame.returnPC).toBe(0x1234);
      expect(frame.storeVariable).toBe(0x10);
      expect(frame.localCount).toBe(5);
      expect(frame.argumentCount).toBe(3);
    });

    it('should support multiple nested calls', () => {
      stack.pushFrame(0x1000, 0x10, 3, 1);
      stack.pushFrame(0x2000, 0x11, 4, 2);
      stack.pushFrame(0x3000, 0x12, 5, 3);
      
      expect(stack.depth).toBe(4);
      expect(stack.currentFrame.returnPC).toBe(0x3000);
    });
  });

  describe('popFrame', () => {
    beforeEach(() => {
      stack.initialize(3);
      stack.pushFrame(0x1000, 0x10, 3, 1);
      stack.pushFrame(0x2000, 0x11, 4, 2);
    });

    it('should pop and return the current frame', () => {
      const popped = stack.popFrame();
      
      expect(popped.returnPC).toBe(0x2000);
      expect(stack.depth).toBe(2);
      expect(stack.currentFrame.returnPC).toBe(0x1000);
    });

    it('should pop until only initial frame remains', () => {
      stack.popFrame();
      stack.popFrame();
      
      expect(stack.depth).toBe(1);
    });

    it('should throw when trying to pop initial frame', () => {
      stack.popFrame();
      stack.popFrame();
      
      expect(() => stack.popFrame()).toThrow('Cannot pop initial stack frame');
    });
  });

  describe('evaluation stack operations', () => {
    beforeEach(() => {
      stack.initialize(3);
    });

    it('should push and pop values', () => {
      stack.push(100);
      stack.push(200);
      
      expect(stack.pop()).toBe(200);
      expect(stack.pop()).toBe(100);
    });

    it('should peek at top value', () => {
      stack.push(100);
      stack.push(200);
      
      expect(stack.peek()).toBe(200);
      expect(stack.peek()).toBe(200);
    });

    it('should keep separate stacks per frame', () => {
      stack.push(100);
      stack.pushFrame(0x1000, 0x10, 2, 0);
      stack.push(200);
      
      expect(stack.pop()).toBe(200);
      
      stack.popFrame();
      expect(stack.pop()).toBe(100);
    });
  });

  describe('local variable operations', () => {
    beforeEach(() => {
      stack.initialize(5);
    });

    it('should get and set locals', () => {
      stack.setLocal(0, 100);
      stack.setLocal(2, 200);
      
      expect(stack.getLocal(0)).toBe(100);
      expect(stack.getLocal(2)).toBe(200);
    });

    it('should access locals of current frame only', () => {
      stack.setLocal(0, 100);
      
      stack.pushFrame(0x1000, 0x10, 3, 0);
      stack.setLocal(0, 200);
      
      expect(stack.getLocal(0)).toBe(200);
      
      stack.popFrame();
      expect(stack.getLocal(0)).toBe(100);
    });
  });

  describe('hasArgument', () => {
    beforeEach(() => {
      stack.initialize(3);
    });

    it('should return true for valid argument numbers', () => {
      stack.pushFrame(0x1000, 0x10, 5, 3);
      
      expect(stack.hasArgument(1)).toBe(true);
      expect(stack.hasArgument(2)).toBe(true);
      expect(stack.hasArgument(3)).toBe(true);
    });

    it('should return false for argument numbers beyond count', () => {
      stack.pushFrame(0x1000, 0x10, 5, 3);
      
      expect(stack.hasArgument(4)).toBe(false);
      expect(stack.hasArgument(5)).toBe(false);
    });

    it('should return false for routine with no arguments', () => {
      stack.pushFrame(0x1000, 0x10, 5, 0);
      
      expect(stack.hasArgument(1)).toBe(false);
    });
  });

  describe('snapshot and restore', () => {
    it('should create accurate snapshot', () => {
      stack.initialize(3);
      stack.setLocal(0, 10);
      stack.push(100);
      
      stack.pushFrame(0x1000, 0x10, 2, 1);
      stack.setLocal(0, 20);
      stack.push(200);
      
      const snapshot = stack.snapshot();
      
      expect(snapshot.frames.length).toBe(2);
      expect(snapshot.frames[0].locals).toEqual([10, 0, 0]);
      expect(snapshot.frames[0].evalStack).toEqual([100]);
      expect(snapshot.frames[1].returnPC).toBe(0x1000);
      expect(snapshot.frames[1].locals).toEqual([20, 0]);
      expect(snapshot.frames[1].evalStack).toEqual([200]);
    });

    it('should restore from snapshot', () => {
      stack.initialize(2);
      
      const snapshot = {
        frames: [
          {
            returnPC: 0,
            storeVariable: undefined,
            argumentCount: 0,
            locals: [10, 20, 30],
            evalStack: [100],
          },
          {
            returnPC: 0x1000,
            storeVariable: 0x10,
            argumentCount: 2,
            locals: [40, 50],
            evalStack: [200, 300],
          },
        ],
      };
      
      stack.restore(snapshot);
      
      expect(stack.depth).toBe(2);
      expect(stack.currentFrame.returnPC).toBe(0x1000);
      expect(stack.getLocal(0)).toBe(40);
      expect(stack.pop()).toBe(300);
      expect(stack.pop()).toBe(200);
      
      stack.popFrame();
      expect(stack.getLocal(0)).toBe(10);
      expect(stack.pop()).toBe(100);
    });
  });

  describe('clear', () => {
    it('should remove all frames', () => {
      stack.initialize(3);
      stack.pushFrame(0x1000, 0x10, 2, 0);
      stack.pushFrame(0x2000, 0x11, 2, 0);
      
      stack.clear();
      
      expect(stack.depth).toBe(0);
    });
  });

  describe('serialize and deserialize', () => {
    it('should serialize and deserialize stack with locals and evalStack', () => {
      stack.initialize(3);
      stack.setLocal(0, 10);
      stack.setLocal(1, 20);
      stack.setLocal(2, 30);
      stack.push(100);
      stack.push(101);

      stack.pushFrame(0x1000, 0x10, 2, 1);
      stack.setLocal(0, 40);
      stack.setLocal(1, 50);
      stack.push(200);
      stack.push(201);
      stack.push(202);

      const serialized = stack.serialize();

      // Create a new stack and deserialize
      const newStack = new Stack();
      newStack.deserialize(serialized);

      // Verify the restored stack
      expect(newStack.depth).toBe(2);
      expect(newStack.currentFrame.returnPC).toBe(0x1000);
      expect(newStack.currentFrame.storeVariable).toBe(0x10);
      expect(newStack.currentFrame.argumentCount).toBe(1);

      // Verify locals in current frame
      expect(newStack.getLocal(0)).toBe(40);
      expect(newStack.getLocal(1)).toBe(50);

      // Verify eval stack in current frame
      expect(newStack.pop()).toBe(202);
      expect(newStack.pop()).toBe(201);
      expect(newStack.pop()).toBe(200);

      // Pop to previous frame and verify
      newStack.popFrame();
      expect(newStack.getLocal(0)).toBe(10);
      expect(newStack.getLocal(1)).toBe(20);
      expect(newStack.getLocal(2)).toBe(30);
      expect(newStack.pop()).toBe(101);
      expect(newStack.pop()).toBe(100);
    });

    it('should handle undefined storeVariable during serialize/deserialize', () => {
      stack.initialize(2);
      stack.setLocal(0, 5);
      stack.push(50);

      // Initial frame has undefined storeVariable
      const serialized = stack.serialize();
      
      const newStack = new Stack();
      newStack.deserialize(serialized);

      expect(newStack.depth).toBe(1);
      expect(newStack.currentFrame.storeVariable).toBeUndefined();
      expect(newStack.getLocal(0)).toBe(5);
      expect(newStack.pop()).toBe(50);
    });
  });

  describe('unwindTo', () => {
    beforeEach(() => {
      stack.initialize(2);
    });

    it('should throw for invalid target depth less than 1', () => {
      expect(() => stack.unwindTo(0)).toThrow('Invalid stack frame pointer: 0');
    });

    it('should throw for target depth greater than current depth', () => {
      expect(() => stack.unwindTo(5)).toThrow('Invalid stack frame pointer: 5');
    });

    it('should unwind directly to target frame when at target depth', () => {
      // Stack has 1 frame, unwind to depth 1 should pop and return that frame
      const frame = stack.unwindTo(1);
      expect(frame.localCount).toBe(2);
      expect(stack.depth).toBe(0);
    });

    it('should unwind through multiple frames to reach target depth', () => {
      // Push additional frames to create depth: 1 -> 2 -> 3 -> 4
      stack.pushFrame(0x1000, 0x10, 3, 1);  // depth 2
      stack.pushFrame(0x2000, 0x11, 4, 2);  // depth 3
      stack.pushFrame(0x3000, 0x12, 5, 3);  // depth 4
      
      expect(stack.depth).toBe(4);
      
      // Unwind to depth 2 - should pop frames at depth 4 and 3, then return frame at depth 2
      const frame = stack.unwindTo(2);
      
      expect(frame.returnPC).toBe(0x1000);
      expect(frame.localCount).toBe(3);
      expect(stack.depth).toBe(1);  // Only initial frame remains
    });

    it('should unwind through all frames except initial', () => {
      stack.pushFrame(0x1000, 0x10, 3, 1);  // depth 2
      stack.pushFrame(0x2000, 0x11, 4, 2);  // depth 3
      
      expect(stack.depth).toBe(3);
      
      // Unwind to depth 1 - pops frames 3 and 2, returns initial frame
      const frame = stack.unwindTo(1);
      
      expect(frame.returnPC).toBe(0);  // Initial frame has returnPC 0
      expect(frame.localCount).toBe(2);
      expect(stack.depth).toBe(0);
    });
  });
});
