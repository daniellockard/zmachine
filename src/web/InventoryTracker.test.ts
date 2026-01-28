/**
 * Tests for InventoryTracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InventoryTracker,
  InventoryItem,
  InventoryState,
  ItemHistoryEntry,
} from './InventoryTracker';

describe('InventoryTracker', () => {
  let tracker: InventoryTracker;

  beforeEach(() => {
    tracker = new InventoryTracker();
  });

  describe('construction', () => {
    it('should create an InventoryTracker instance', () => {
      expect(tracker).toBeInstanceOf(InventoryTracker);
    });

    it('should have empty state initially', () => {
      const state = tracker.getState();
      expect(state.items.size).toBe(0);
      expect(state.playerObject).toBeNull();
      expect(state.currentTurn).toBe(0);
    });
  });

  describe('getInventory', () => {
    it('should return empty array when no items', () => {
      const inventory = tracker.getInventory();
      expect(inventory).toEqual([]);
    });
  });

  describe('getAllItems', () => {
    it('should return empty array when no items', () => {
      const items = tracker.getAllItems();
      expect(items).toEqual([]);
    });
  });

  describe('getItem', () => {
    it('should return undefined for unknown object', () => {
      const item = tracker.getItem(999);
      expect(item).toBeUndefined();
    });
  });

  describe('beforeCommand', () => {
    it('should accept a command string', () => {
      // Should not throw
      expect(() => tracker.beforeCommand('take lamp')).not.toThrow();
    });
  });

  describe('afterCommand', () => {
    it('should increment turn counter', () => {
      expect(tracker.getState().currentTurn).toBe(0);
      tracker.afterCommand();
      expect(tracker.getState().currentTurn).toBe(1);
      tracker.afterCommand();
      expect(tracker.getState().currentTurn).toBe(2);
    });
  });

  describe('reset', () => {
    it('should clear state', () => {
      // Simulate some state
      tracker.afterCommand();
      tracker.afterCommand();
      expect(tracker.getState().currentTurn).toBe(2);

      tracker.reset();

      const state = tracker.getState();
      expect(state.items.size).toBe(0);
      expect(state.playerObject).toBeNull();
      expect(state.currentTurn).toBe(0);
    });
  });

  describe('exportState', () => {
    it('should export state as JSON', () => {
      const json = tracker.exportState();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('items');
      expect(parsed).toHaveProperty('playerObject');
      expect(parsed).toHaveProperty('currentTurn');
    });

    it('should export current turn count', () => {
      tracker.afterCommand();
      tracker.afterCommand();
      tracker.afterCommand();

      const json = tracker.exportState();
      const parsed = JSON.parse(json);

      expect(parsed.currentTurn).toBe(3);
    });
  });

  describe('importState', () => {
    it('should import state from JSON', () => {
      const exportedJson = tracker.exportState();

      const newTracker = new InventoryTracker();
      const result = newTracker.importState(exportedJson);

      expect(result).toBe(true);
      const state = newTracker.getState();
      expect(state.currentTurn).toBe(0);
    });

    it('should return false for invalid JSON', () => {
      const result = tracker.importState('not valid json');
      expect(result).toBe(false);
    });

    it('should preserve state when import fails', () => {
      tracker.afterCommand();
      tracker.afterCommand();
      expect(tracker.getState().currentTurn).toBe(2);

      const result = tracker.importState('invalid');

      expect(result).toBe(false);
      expect(tracker.getState().currentTurn).toBe(2);
    });

    it('should preserve turn count across import', () => {
      tracker.afterCommand();
      tracker.afterCommand();
      const json = tracker.exportState();

      const newTracker = new InventoryTracker();
      newTracker.importState(json);

      expect(newTracker.getState().currentTurn).toBe(2);
    });
  });

  describe('detach', () => {
    it('should clear machine reference', () => {
      tracker.detach();
      // Should not throw when calling methods after detach
      expect(() => tracker.afterCommand()).not.toThrow();
    });
  });
});

describe('InventoryItem interface', () => {
  it('should have expected properties', () => {
    const item: InventoryItem = {
      id: 1,
      name: 'brass lantern',
      location: 5,
      locationName: 'West of House',
      inInventory: false,
      firstSeen: 0,
      history: [],
    };

    expect(item.id).toBe(1);
    expect(item.name).toBe('brass lantern');
    expect(item.location).toBe(5);
    expect(item.locationName).toBe('West of House');
    expect(item.inInventory).toBe(false);
    expect(item.firstSeen).toBe(0);
    expect(item.history).toEqual([]);
  });
});

describe('ItemHistoryEntry interface', () => {
  it('should have expected properties', () => {
    const entry: ItemHistoryEntry = {
      turn: 5,
      fromLocation: 10,
      fromLocationName: 'West of House',
      toLocation: 4,
      toLocationName: 'player',
      command: 'take lamp',
    };

    expect(entry.turn).toBe(5);
    expect(entry.fromLocation).toBe(10);
    expect(entry.fromLocationName).toBe('West of House');
    expect(entry.toLocation).toBe(4);
    expect(entry.toLocationName).toBe('player');
    expect(entry.command).toBe('take lamp');
  });

  it('should allow optional command', () => {
    const entry: ItemHistoryEntry = {
      turn: 5,
      fromLocation: 10,
      fromLocationName: 'West of House',
      toLocation: 4,
      toLocationName: 'player',
    };

    expect(entry.command).toBeUndefined();
  });
});

describe('InventoryState interface', () => {
  it('should have expected properties', () => {
    const state: InventoryState = {
      items: new Map(),
      playerObject: null,
      currentTurn: 0,
    };

    expect(state.items).toBeInstanceOf(Map);
    expect(state.playerObject).toBeNull();
    expect(state.currentTurn).toBe(0);
  });
});
