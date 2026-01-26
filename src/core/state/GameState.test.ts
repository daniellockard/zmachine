/**
 * Tests for GameState save/restore/undo functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import { Memory } from '../memory/Memory';
import { Stack } from '../cpu/Stack';

/**
 * Create a minimal valid Z-machine story file for testing
 * Sets up proper header with version, static memory base, etc.
 */
function createTestStory(size: number = 0x1000, staticBase: number = 0x100): ArrayBuffer {
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  
  // Version 5
  view.setUint8(0x00, 5);
  
  // Static memory base (offset 0x0E)
  view.setUint16(0x0E, staticBase, false);
  
  // High memory base (offset 0x04)
  view.setUint16(0x04, staticBase, false);
  
  // Dictionary, object table, etc. - set to valid addresses
  view.setUint16(0x08, 0x40, false); // Abbreviations
  view.setUint16(0x0A, 0x50, false); // Objects
  view.setUint16(0x0C, 0x60, false); // Globals
  
  // Serial number (6 bytes at 0x12)
  const serial = '123456';
  for (let i = 0; i < 6; i++) {
    view.setUint8(0x12 + i, serial.charCodeAt(i));
  }
  
  // Release number (offset 0x02)
  view.setUint16(0x02, 1, false);
  
  // Checksum (offset 0x1C)
  view.setUint16(0x1C, 0x1234, false);
  
  return buffer;
}

describe('GameState', () => {
  let memory: Memory;
  let stack: Stack;
  let gameState: GameState;

  beforeEach(() => {
    memory = new Memory(createTestStory());
    stack = new Stack();
    stack.initialize(0);
    gameState = new GameState(memory, stack);
  });

  describe('constructor', () => {
    it('should store original dynamic memory on creation', () => {
      // Modify memory after creation
      memory.writeByte(0x40, 99);
      
      // Original should still be stored (can verify via getOriginalMemory)
      const original = gameState.getOriginalMemory();
      expect(original[0x40]).toBe(0); // Original was 0, not 99
    });

    it('should capture static memory base worth of original memory', () => {
      const original = gameState.getOriginalMemory();
      expect(original.length).toBe(memory.staticBase);
    });
  });

  describe('setPC', () => {
    it('should update current PC for save operations', () => {
      gameState.setPC(0x1234);
      
      // Save and restore to verify PC was captured
      const saveData = gameState.createSaveData();
      
      // Create a fresh state and restore
      const memory2 = new Memory(createTestStory());
      const stack2 = new Stack();
      stack2.initialize(0);
      const gameState2 = new GameState(memory2, stack2);
      
      const restoredPC = gameState2.restoreFromSaveData(saveData);
      expect(restoredPC).toBe(0x1234);
    });
  });

  describe('createSaveData', () => {
    it('should create a valid Quetzal save file', () => {
      gameState.setPC(0x500);
      const saveData = gameState.createSaveData();
      
      // Quetzal files start with 'FORM' chunk
      const text = String.fromCharCode(...saveData.slice(0, 4));
      expect(text).toBe('FORM');
    });

    it('should create save data that can be parsed', () => {
      gameState.setPC(0x600);
      const saveData = gameState.createSaveData();
      
      // Should be parseable by restoreFromSaveData
      const memory2 = new Memory(createTestStory());
      const stack2 = new Stack();
      stack2.initialize(0);
      const gameState2 = new GameState(memory2, stack2);
      
      const restoredPC = gameState2.restoreFromSaveData(saveData);
      expect(restoredPC).toBe(0x600);
    });

    it('should capture dynamic memory changes', () => {
      // Modify some dynamic memory
      memory.writeByte(0x40, 42);
      memory.writeByte(0x50, 123);
      
      gameState.setPC(0x700);
      const saveData = gameState.createSaveData();
      
      // Restore to a fresh state
      const memory2 = new Memory(createTestStory());
      const stack2 = new Stack();
      stack2.initialize(0);
      const gameState2 = new GameState(memory2, stack2);
      
      gameState2.restoreFromSaveData(saveData);
      
      // Memory should be restored
      expect(memory2.readByte(0x40)).toBe(42);
      expect(memory2.readByte(0x50)).toBe(123);
    });
  });

  describe('restoreFromSaveData', () => {
    it('should restore dynamic memory from save', () => {
      // Set up initial state
      memory.writeByte(0x40, 10);
      memory.writeByte(0x41, 20);
      gameState.setPC(0x800);
      const saveData = gameState.createSaveData();
      
      // Modify memory
      memory.writeByte(0x40, 99);
      memory.writeByte(0x41, 99);
      
      // Restore
      const restoredPC = gameState.restoreFromSaveData(saveData);
      
      expect(restoredPC).toBe(0x800);
      expect(memory.readByte(0x40)).toBe(10);
      expect(memory.readByte(0x41)).toBe(20);
    });

    it('should return null for invalid save data', () => {
      const invalidData = new Uint8Array([1, 2, 3, 4]);
      const result = gameState.restoreFromSaveData(invalidData);
      expect(result).toBeNull();
    });

    it('should return null for incompatible save (different game)', () => {
      gameState.setPC(0x100);
      const saveData = gameState.createSaveData();
      
      // Create a different "game" with different checksum
      const differentStory = createTestStory();
      new DataView(differentStory).setUint16(0x1C, 0x9999, false); // Different checksum
      
      const memory2 = new Memory(differentStory);
      const stack2 = new Stack();
      stack2.initialize(0);
      const gameState2 = new GameState(memory2, stack2);
      
      const result = gameState2.restoreFromSaveData(saveData);
      expect(result).toBeNull();
    });

    it('should clear undo stack on restore', () => {
      // Create some undo states
      gameState.saveUndo();
      gameState.saveUndo();
      expect(gameState.hasUndo()).toBe(true);
      
      // Save and restore
      gameState.setPC(0x100);
      const saveData = gameState.createSaveData();
      gameState.restoreFromSaveData(saveData);
      
      // Undo stack should be cleared
      expect(gameState.hasUndo()).toBe(false);
    });

    it('should restore call stack from save', () => {
      // Push a frame: pushFrame(returnPC, storeVariable, localCount, argumentCount)
      stack.pushFrame(0x1000, 5, 2, 1);
      stack.setLocal(0, 100);
      stack.setLocal(1, 200);
      stack.push(999);
      
      gameState.setPC(0x900);
      const saveData = gameState.createSaveData();
      
      // Create fresh state and restore
      const memory2 = new Memory(createTestStory());
      const stack2 = new Stack();
      stack2.initialize(0);
      const gameState2 = new GameState(memory2, stack2);
      
      gameState2.restoreFromSaveData(saveData);
      
      // Stack should be restored - verify by checking frame depth
      expect(stack2.depth).toBe(2); // Initial + pushed frame
    });
  });

  describe('saveUndo', () => {
    it('should save current state to undo stack', () => {
      memory.writeByte(0x40, 55);
      gameState.setPC(0x1000);
      
      const result = gameState.saveUndo();
      
      expect(result).toBe(true);
      expect(gameState.hasUndo()).toBe(true);
    });

    it('should save multiple undo states', () => {
      gameState.saveUndo();
      gameState.saveUndo();
      gameState.saveUndo();
      
      expect(gameState.hasUndo()).toBe(true);
    });

    it('should limit undo stack to MAX_UNDO_STATES', () => {
      // Push more than the limit
      for (let i = 0; i < 15; i++) {
        gameState.saveUndo();
      }
      
      // Should still have undo available (oldest ones discarded)
      expect(gameState.hasUndo()).toBe(true);
      
      // Pop all and count
      let count = 0;
      while (gameState.hasUndo()) {
        gameState.restoreUndo();
        count++;
      }
      
      // Should be limited to MAX_UNDO_STATES (10)
      expect(count).toBe(10);
    });
  });

  describe('restoreUndo', () => {
    it('should restore previous state from undo stack', () => {
      memory.writeByte(0x40, 11);
      gameState.setPC(0x2000);
      gameState.saveUndo();
      
      // Modify state
      memory.writeByte(0x40, 99);
      
      // Restore
      const restoredPC = gameState.restoreUndo();
      
      expect(restoredPC).toBe(0x2000);
      expect(memory.readByte(0x40)).toBe(11);
    });

    it('should return null when no undo available', () => {
      const result = gameState.restoreUndo();
      expect(result).toBeNull();
    });

    it('should restore in LIFO order', () => {
      memory.writeByte(0x40, 1);
      gameState.setPC(0x100);
      gameState.saveUndo();
      
      memory.writeByte(0x40, 2);
      gameState.setPC(0x200);
      gameState.saveUndo();
      
      memory.writeByte(0x40, 3);
      gameState.setPC(0x300);
      gameState.saveUndo();
      
      // Restore should go in reverse order
      expect(gameState.restoreUndo()).toBe(0x300);
      expect(memory.readByte(0x40)).toBe(3);
      
      expect(gameState.restoreUndo()).toBe(0x200);
      expect(memory.readByte(0x40)).toBe(2);
      
      expect(gameState.restoreUndo()).toBe(0x100);
      expect(memory.readByte(0x40)).toBe(1);
      
      expect(gameState.restoreUndo()).toBeNull();
    });

    it('should restore call stack state', () => {
      stack.pushFrame(0x1000, 2, 1, 5);
      stack.setLocal(0, 42);
      gameState.saveUndo();
      
      // Pop frame
      stack.popFrame();
      
      // Restore
      gameState.restoreUndo();
      
      // Frame should be back
      expect(stack.depth).toBe(2);
    });
  });

  describe('hasUndo', () => {
    it('should return false initially', () => {
      expect(gameState.hasUndo()).toBe(false);
    });

    it('should return true after saveUndo', () => {
      gameState.saveUndo();
      expect(gameState.hasUndo()).toBe(true);
    });

    it('should return false after all undos consumed', () => {
      gameState.saveUndo();
      gameState.restoreUndo();
      expect(gameState.hasUndo()).toBe(false);
    });
  });

  describe('clearUndo', () => {
    it('should clear all undo history', () => {
      gameState.saveUndo();
      gameState.saveUndo();
      gameState.saveUndo();
      
      gameState.clearUndo();
      
      expect(gameState.hasUndo()).toBe(false);
    });

    it('should do nothing if already empty', () => {
      gameState.clearUndo();
      expect(gameState.hasUndo()).toBe(false);
    });
  });

  describe('getOriginalMemory', () => {
    it('should return the original memory captured at construction', () => {
      const original = gameState.getOriginalMemory();
      
      expect(original).toBeInstanceOf(Uint8Array);
      expect(original.length).toBe(memory.staticBase);
    });

    it('should not change when memory is modified', () => {
      const original1 = gameState.getOriginalMemory();
      const valueBefore = original1[0x40];
      
      memory.writeByte(0x40, 0xFF);
      
      const original2 = gameState.getOriginalMemory();
      expect(original2[0x40]).toBe(valueBefore);
    });
  });
});
