/**
 * Tests for StackFrame module
 */

import { describe, it, expect } from 'vitest';
import { StackFrame } from './StackFrame';

describe('StackFrame', () => {
  describe('constructor', () => {
    it('should create a frame with valid parameters', () => {
      const frame = new StackFrame(0x1234, 0x10, 5, 3);
      
      expect(frame.returnPC).toBe(0x1234);
      expect(frame.storeVariable).toBe(0x10);
      expect(frame.localCount).toBe(5);
      expect(frame.argumentCount).toBe(3);
      expect(frame.stackDepth).toBe(0);
    });

    it('should allow undefined store variable', () => {
      const frame = new StackFrame(0x1234, undefined, 3, 2);
      
      expect(frame.storeVariable).toBeUndefined();
    });

    it('should allow 0 local variables', () => {
      const frame = new StackFrame(0x1234, 0x10, 0, 0);
      
      expect(frame.localCount).toBe(0);
    });

    it('should allow 15 local variables', () => {
      const frame = new StackFrame(0x1234, 0x10, 15, 0);
      
      expect(frame.localCount).toBe(15);
    });

    it('should throw on negative local count', () => {
      expect(() => new StackFrame(0x1234, 0x10, -1, 0))
        .toThrow('Invalid local variable count');
    });

    it('should throw on local count > 15', () => {
      expect(() => new StackFrame(0x1234, 0x10, 16, 0))
        .toThrow('Invalid local variable count');
    });

    it('should initialize all locals to 0', () => {
      const frame = new StackFrame(0x1234, 0x10, 5, 0);
      
      for (let i = 0; i < 5; i++) {
        expect(frame.getLocal(i)).toBe(0);
      }
    });
  });

  describe('local variables', () => {
    it('should get and set locals', () => {
      const frame = new StackFrame(0x1234, 0x10, 5, 0);
      
      frame.setLocal(0, 100);
      frame.setLocal(2, 200);
      frame.setLocal(4, 300);
      
      expect(frame.getLocal(0)).toBe(100);
      expect(frame.getLocal(1)).toBe(0);
      expect(frame.getLocal(2)).toBe(200);
      expect(frame.getLocal(3)).toBe(0);
      expect(frame.getLocal(4)).toBe(300);
    });

    it('should mask values to 16 bits', () => {
      const frame = new StackFrame(0x1234, 0x10, 3, 0);
      
      frame.setLocal(0, 0x1FFFF);
      expect(frame.getLocal(0)).toBe(0xFFFF);
      
      frame.setLocal(1, -1);
      expect(frame.getLocal(1)).toBe(0xFFFF);
    });

    it('should throw on get out of range', () => {
      const frame = new StackFrame(0x1234, 0x10, 3, 0);
      
      expect(() => frame.getLocal(-1)).toThrow('out of range');
      expect(() => frame.getLocal(3)).toThrow('out of range');
      expect(() => frame.getLocal(10)).toThrow('out of range');
    });

    it('should throw on set out of range', () => {
      const frame = new StackFrame(0x1234, 0x10, 3, 0);
      
      expect(() => frame.setLocal(-1, 100)).toThrow('out of range');
      expect(() => frame.setLocal(3, 100)).toThrow('out of range');
    });

    it('should initialize locals with values', () => {
      const frame = new StackFrame(0x1234, 0x10, 5, 3);
      
      frame.initializeLocals([10, 20, 30]);
      
      expect(frame.getLocal(0)).toBe(10);
      expect(frame.getLocal(1)).toBe(20);
      expect(frame.getLocal(2)).toBe(30);
      expect(frame.getLocal(3)).toBe(0);
      expect(frame.getLocal(4)).toBe(0);
    });

    it('should truncate initialization if too many values', () => {
      const frame = new StackFrame(0x1234, 0x10, 3, 0);
      
      frame.initializeLocals([10, 20, 30, 40, 50]);
      
      expect(frame.getLocal(0)).toBe(10);
      expect(frame.getLocal(1)).toBe(20);
      expect(frame.getLocal(2)).toBe(30);
    });
  });

  describe('evaluation stack', () => {
    it('should push and pop values', () => {
      const frame = new StackFrame(0x1234, 0x10, 3, 0);
      
      frame.push(100);
      frame.push(200);
      frame.push(300);
      
      expect(frame.stackDepth).toBe(3);
      expect(frame.pop()).toBe(300);
      expect(frame.pop()).toBe(200);
      expect(frame.pop()).toBe(100);
      expect(frame.stackDepth).toBe(0);
    });

    it('should mask pushed values to 16 bits', () => {
      const frame = new StackFrame(0x1234, 0x10, 0, 0);
      
      frame.push(0x1FFFF);
      expect(frame.pop()).toBe(0xFFFF);
    });

    it('should peek without removing', () => {
      const frame = new StackFrame(0x1234, 0x10, 0, 0);
      
      frame.push(100);
      frame.push(200);
      
      expect(frame.peek()).toBe(200);
      expect(frame.peek()).toBe(200);
      expect(frame.stackDepth).toBe(2);
    });

    it('should throw on pop from empty stack', () => {
      const frame = new StackFrame(0x1234, 0x10, 0, 0);
      
      expect(() => frame.pop()).toThrow('Stack underflow');
    });

    it('should throw on peek at empty stack', () => {
      const frame = new StackFrame(0x1234, 0x10, 0, 0);
      
      expect(() => frame.peek()).toThrow('Stack underflow');
    });
  });

  describe('snapshots', () => {
    it('should get locals snapshot', () => {
      const frame = new StackFrame(0x1234, 0x10, 3, 0);
      frame.setLocal(0, 10);
      frame.setLocal(1, 20);
      frame.setLocal(2, 30);
      
      const snapshot = frame.getLocalsSnapshot();
      
      expect(snapshot).toEqual([10, 20, 30]);
      
      // Modifying snapshot should not affect frame
      snapshot[0] = 999;
      expect(frame.getLocal(0)).toBe(10);
    });

    it('should get stack snapshot', () => {
      const frame = new StackFrame(0x1234, 0x10, 0, 0);
      frame.push(100);
      frame.push(200);
      
      const snapshot = frame.getStackSnapshot();
      
      expect(snapshot).toEqual([100, 200]);
      
      // Modifying snapshot should not affect frame
      snapshot.push(999);
      expect(frame.stackDepth).toBe(2);
    });

    it('should restore stack from snapshot', () => {
      const frame = new StackFrame(0x1234, 0x10, 0, 0);
      frame.push(100);
      
      frame.restoreStack([10, 20, 30]);
      
      expect(frame.stackDepth).toBe(3);
      expect(frame.pop()).toBe(30);
      expect(frame.pop()).toBe(20);
      expect(frame.pop()).toBe(10);
    });
  });
});
