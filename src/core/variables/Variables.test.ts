/**
 * Tests for Variables module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Variables } from './Variables';
import { Memory } from '../memory/Memory';
import { Stack } from '../cpu/Stack';

describe('Variables', () => {
  let memory: Memory;
  let stack: Stack;
  let variables: Variables;
  const GLOBALS_ADDRESS = 0x100;

  function createTestMemory(): Memory {
    const size = 0x1000; // 4KB - enough for globals table
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // Header
    view.setUint8(0x00, 3); // Version 3
    view.setUint16(0x0C, GLOBALS_ADDRESS, false); // Globals table
    view.setUint16(0x0E, 0x800, false); // Static memory base (after globals table)

    return new Memory(buffer);
  }

  beforeEach(() => {
    memory = createTestMemory();
    stack = new Stack();
    stack.initialize(0); // No locals for main frame
    variables = new Variables(memory, stack, GLOBALS_ADDRESS);
  });

  describe('stack variable (0)', () => {
    it('should push on write', () => {
      variables.write(0, 42);
      expect(stack.peek()).toBe(42);
    });

    it('should pop on read', () => {
      stack.push(42);
      expect(variables.read(0)).toBe(42);
      expect(() => stack.peek()).toThrow(); // Stack should be empty
    });

    it('should peek without popping', () => {
      stack.push(42);
      expect(variables.peek(0)).toBe(42);
      expect(variables.peek(0)).toBe(42); // Still there
    });

    it('should handle multiple pushes', () => {
      variables.write(0, 1);
      variables.write(0, 2);
      variables.write(0, 3);
      expect(variables.read(0)).toBe(3);
      expect(variables.read(0)).toBe(2);
      expect(variables.read(0)).toBe(1);
    });
  });

  describe('local variables (1-15)', () => {
    beforeEach(() => {
      // Create frame with 5 locals and set their values
      stack.pushFrame(0x200, undefined, 5, 0);
      stack.currentFrame.setLocal(0, 10);
      stack.currentFrame.setLocal(1, 20);
      stack.currentFrame.setLocal(2, 30);
      stack.currentFrame.setLocal(3, 40);
      stack.currentFrame.setLocal(4, 50);
    });

    it('should read local variable', () => {
      expect(variables.read(1)).toBe(10);
      expect(variables.read(2)).toBe(20);
      expect(variables.read(5)).toBe(50);
    });

    it('should write local variable', () => {
      variables.write(1, 100);
      expect(variables.read(1)).toBe(100);
    });

    it('should not affect other locals', () => {
      variables.write(3, 999);
      expect(variables.read(1)).toBe(10);
      expect(variables.read(2)).toBe(20);
      expect(variables.read(3)).toBe(999);
      expect(variables.read(4)).toBe(40);
    });

    it('should mask to 16 bits', () => {
      variables.write(1, 0x1FFFF);
      expect(variables.read(1)).toBe(0xFFFF);
    });
  });

  describe('global variables (16-255)', () => {
    it('should read global variable', () => {
      memory.writeWord(GLOBALS_ADDRESS + 0, 1234);
      expect(variables.read(16)).toBe(1234);
    });

    it('should write global variable', () => {
      variables.write(16, 5678);
      expect(memory.readWord(GLOBALS_ADDRESS + 0)).toBe(5678);
    });

    it('should access correct offsets', () => {
      variables.write(16, 100);  // Offset 0
      variables.write(17, 200);  // Offset 2
      variables.write(18, 300);  // Offset 4
      
      expect(memory.readWord(GLOBALS_ADDRESS + 0)).toBe(100);
      expect(memory.readWord(GLOBALS_ADDRESS + 2)).toBe(200);
      expect(memory.readWord(GLOBALS_ADDRESS + 4)).toBe(300);
    });

    it('should handle high global numbers', () => {
      variables.write(255, 9999);
      expect(memory.readWord(GLOBALS_ADDRESS + (255 - 16) * 2)).toBe(9999);
    });
  });

  describe('increment', () => {
    beforeEach(() => {
      stack.pushFrame(0x200, undefined, 1, 0);
      stack.currentFrame.setLocal(0, 100);
    });

    it('should increment stack', () => {
      stack.push(42);
      variables.increment(0);
      expect(stack.peek()).toBe(43);
    });

    it('should increment local', () => {
      variables.increment(1);
      expect(variables.read(1)).toBe(101);
    });

    it('should increment global', () => {
      variables.write(16, 200);
      variables.increment(16);
      expect(variables.read(16)).toBe(201);
    });

    it('should wrap on overflow', () => {
      variables.write(16, 0xFFFF);
      variables.increment(16);
      expect(variables.read(16)).toBe(0);
    });
  });

  describe('decrement', () => {
    beforeEach(() => {
      stack.pushFrame(0x200, undefined, 1, 0);
      stack.currentFrame.setLocal(0, 100);
    });

    it('should decrement stack', () => {
      stack.push(42);
      variables.decrement(0);
      expect(stack.peek()).toBe(41);
    });

    it('should decrement local', () => {
      variables.decrement(1);
      expect(variables.read(1)).toBe(99);
    });

    it('should decrement global', () => {
      variables.write(16, 200);
      variables.decrement(16);
      expect(variables.read(16)).toBe(199);
    });

    it('should wrap on underflow', () => {
      variables.write(16, 0);
      variables.decrement(16);
      expect(variables.read(16)).toBe(0xFFFF);
    });
  });

  describe('type checks', () => {
    it('should identify stack variable', () => {
      expect(variables.isStack(0)).toBe(true);
      expect(variables.isStack(1)).toBe(false);
    });

    it('should identify local variables', () => {
      expect(variables.isLocal(0)).toBe(false);
      expect(variables.isLocal(1)).toBe(true);
      expect(variables.isLocal(15)).toBe(true);
      expect(variables.isLocal(16)).toBe(false);
    });

    it('should identify global variables', () => {
      expect(variables.isGlobal(15)).toBe(false);
      expect(variables.isGlobal(16)).toBe(true);
      expect(variables.isGlobal(255)).toBe(true);
    });
  });

  describe('getGlobalAddress', () => {
    it('should return correct address', () => {
      expect(variables.getGlobalAddress(16)).toBe(GLOBALS_ADDRESS);
      expect(variables.getGlobalAddress(17)).toBe(GLOBALS_ADDRESS + 2);
      expect(variables.getGlobalAddress(255)).toBe(GLOBALS_ADDRESS + (255 - 16) * 2);
    });

    it('should throw for non-global', () => {
      expect(() => variables.getGlobalAddress(0)).toThrow();
      expect(() => variables.getGlobalAddress(15)).toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw for invalid variable number', () => {
      expect(() => variables.read(-1)).toThrow();
      expect(() => variables.read(256)).toThrow();
      expect(() => variables.write(-1, 0)).toThrow();
      expect(() => variables.write(256, 0)).toThrow();
    });
  });
});
