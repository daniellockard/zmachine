/**
 * Game State Management
 * 
 * Handles save, restore, and undo operations using the Quetzal format.
 * 
 * @module
 */

import { ByteAddress } from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { Stack, CallStackSnapshot } from '../cpu/Stack';
import { 
  createQuetzalSave, 
  parseQuetzalSave, 
  verifySaveCompatibility,
} from './Quetzal';

/**
 * Maximum number of undo states to keep
 */
const MAX_UNDO_STATES = 10;

/**
 * Snapshot of game state for undo
 */
interface UndoSnapshot {
  dynamicMemory: Uint8Array;
  callStack: CallStackSnapshot;
  pc: ByteAddress;
}

/**
 * Manages game state for save/restore/undo
 */
export class GameState {
  private readonly memory: Memory;
  private readonly stack: Stack;
  private readonly originalMemory: Uint8Array;
  
  /** Undo stack */
  private undoStack: UndoSnapshot[] = [];
  
  /** Current PC (updated before save/undo operations) */
  private currentPC: ByteAddress = 0;

  constructor(memory: Memory, stack: Stack) {
    this.memory = memory;
    this.stack = stack;
    
    // Store original memory for CMem compression
    const staticBase = memory.staticBase;
    this.originalMemory = new Uint8Array(staticBase);
    for (let i = 0; i < staticBase; i++) {
      this.originalMemory[i] = memory.readByte(i);
    }
  }

  /**
   * Update the current PC (call before save/undo operations)
   */
  setPC(pc: ByteAddress): void {
    this.currentPC = pc;
  }

  /**
   * Create a save file in Quetzal format
   */
  createSaveData(): Uint8Array {
    return createQuetzalSave(
      this.memory,
      this.stack.snapshot(),
      this.currentPC
    );
  }

  /**
   * Restore game state from Quetzal save data
   * 
   * @returns The PC to resume execution at, or null if restore failed
   */
  restoreFromSaveData(data: Uint8Array): ByteAddress | null {
    try {
      const saveState = parseQuetzalSave(data);
      
      // Verify compatibility
      if (!verifySaveCompatibility(saveState, this.memory)) {
        return null;
      }
      
      // Determine if memory is compressed
      // The parsed dynamicMemory could be CMem or UMem
      // For now, assume UMem (uncompressed) since that's what we create
      const dynamicMem = saveState.dynamicMemory;
      
      // Restore dynamic memory
      const staticBase = this.memory.staticBase;
      const restoreSize = Math.min(dynamicMem.length, staticBase);
      for (let i = 0; i < restoreSize; i++) {
        this.memory.writeByte(i, dynamicMem[i]);
      }
      
      // Restore call stack
      this.stack.restore(saveState.callStack);
      
      // Clear undo stack on restore
      this.undoStack = [];
      
      return saveState.gameId.pc;
    } catch {
      return null;
    }
  }

  /**
   * Save current state for undo
   * 
   * @returns true if undo state was saved
   */
  saveUndo(): boolean {
    const staticBase = this.memory.staticBase;
    const dynamicMemory = new Uint8Array(staticBase);
    for (let i = 0; i < staticBase; i++) {
      dynamicMemory[i] = this.memory.readByte(i);
    }
    
    const snapshot: UndoSnapshot = {
      dynamicMemory,
      callStack: this.stack.snapshot(),
      pc: this.currentPC,
    };
    
    this.undoStack.push(snapshot);
    
    // Limit undo stack size
    while (this.undoStack.length > MAX_UNDO_STATES) {
      this.undoStack.shift();
    }
    
    return true;
  }

  /**
   * Restore from undo stack
   * 
   * @returns The PC to resume at, or null if no undo available
   */
  restoreUndo(): ByteAddress | null {
    const snapshot = this.undoStack.pop();
    if (!snapshot) {
      return null;
    }
    
    // Restore dynamic memory
    const staticBase = this.memory.staticBase;
    const restoreSize = Math.min(snapshot.dynamicMemory.length, staticBase);
    for (let i = 0; i < restoreSize; i++) {
      this.memory.writeByte(i, snapshot.dynamicMemory[i]);
    }
    
    // Restore call stack
    this.stack.restore(snapshot.callStack);
    
    return snapshot.pc;
  }

  /**
   * Check if undo is available
   */
  hasUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Clear all undo history
   */
  clearUndo(): void {
    this.undoStack = [];
  }

  /**
   * Get the original memory (for CMem compression)
   */
  getOriginalMemory(): Uint8Array {
    return this.originalMemory;
  }
}
