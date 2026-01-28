/**
 * Automatic Inventory Tracker
 *
 * Tracks items the player picks up and drops, maintaining a history
 * of item locations and ownership changes.
 *
 * @module
 */

import { ZMachine } from '../core/ZMachine';

/**
 * An item in the game world
 */
export interface InventoryItem {
  /** Object number of the item */
  id: number;
  /** Item name from the game */
  name: string;
  /** Current location (parent object number, 0 = no parent) */
  location: number;
  /** Name of the current location */
  locationName: string;
  /** Whether the item is currently held by the player */
  inInventory: boolean;
  /** When the item was first seen */
  firstSeen: number;
  /** History of location changes */
  history: ItemHistoryEntry[];
}

/**
 * A record of an item changing location
 */
export interface ItemHistoryEntry {
  /** Timestamp (command number) */
  turn: number;
  /** Previous location object number */
  fromLocation: number;
  /** Previous location name */
  fromLocationName: string;
  /** New location object number */
  toLocation: number;
  /** New location name */
  toLocationName: string;
  /** The command that triggered this change (if known) */
  command?: string;
}

/**
 * The complete inventory state
 */
export interface InventoryState {
  /** All known items indexed by object number */
  items: Map<number, InventoryItem>;
  /** Current player object number */
  playerObject: number | null;
  /** Current turn/command count */
  currentTurn: number;
}

/**
 * Tracks inventory changes and builds item history
 */
export class InventoryTracker {
  /**
   * Number of consecutive invalid objects to find before stopping the scan.
   * Most Z-machine games use <500 objects, so this provides a reasonable
   * heuristic to avoid scanning all 65535 possible objects in V4+ games.
   */
  private static readonly MAX_CONSECUTIVE_INVALID_OBJECTS = 10;

  private machine: ZMachine | null = null;
  private state: InventoryState;
  private lastCommand: string = '';
  private playerObjectCache: number | null = null;

  constructor() {
    this.state = {
      items: new Map(),
      playerObject: null,
      currentTurn: 0,
    };
  }

  /**
   * Attach to a Z-Machine instance
   */
  attach(machine: ZMachine): void {
    this.machine = machine;
    this.state = {
      items: new Map(),
      playerObject: null,
      currentTurn: 0,
    };
    this.playerObjectCache = null;

    // Scan for initial items
    this.scanAllObjects();
  }

  /**
   * Detach from the current Z-Machine
   */
  detach(): void {
    this.machine = null;
  }

  /**
   * Called before a command is processed
   */
  beforeCommand(command: string): void {
    this.lastCommand = command;
  }

  /**
   * Called after a command is processed
   */
  afterCommand(): void {
    this.state.currentTurn++;
    this.scanForChanges();
  }

  /**
   * Get the current inventory state
   */
  getState(): InventoryState {
    return this.state;
  }

  /**
   * Get items currently in the player's inventory
   */
  getInventory(): InventoryItem[] {
    return Array.from(this.state.items.values()).filter((item) => item.inInventory);
  }

  /**
   * Get all known items
   */
  getAllItems(): InventoryItem[] {
    return Array.from(this.state.items.values());
  }

  /**
   * Get an item by its object number
   */
  getItem(objectNum: number): InventoryItem | undefined {
    return this.state.items.get(objectNum);
  }

  /**
   * Get the player object number
   * In most Z-machine games, this is stored in a global variable or is a fixed object
   */
  private getPlayerObject(): number | null {
    if (!this.machine) return null;

    // Cache the player object since it rarely changes
    if (this.playerObjectCache !== null) {
      return this.playerObjectCache;
    }

    // Common conventions for player object:
    // 1. In Infocom games, the player is often object with ID from global variable
    // 2. Object whose parent is the current room (location from global 16)
    // 3. Sometimes hardcoded as a low-numbered object

    // Try to find player by looking at what's in the current room
    const currentRoom = this.getCurrentRoom();
    if (currentRoom) {
      // Look for objects in this room that could be the player
      // First try to identify by common player object names
      let child = this.machine.objectTable.getChild(currentRoom);
      while (child !== 0) {
        // Check if this object has a known player object name
        const name = this.getObjectName(child);
        const lowerName = name.toLowerCase();
        // Common player object names. Some Z-machine story files use
        // "cretin" as the internal short name for the player object,
        // so we keep that here for compatibility.
        if (
          lowerName.includes('you') ||
          lowerName === 'cretin' ||
          lowerName === 'player' ||
          lowerName === 'self'
        ) {
          this.playerObjectCache = child;
          this.state.playerObject = child;
          return child;
        }
        child = this.machine.objectTable.getSibling(child);
      }

      // If we didn't find by name, try a different heuristic:
      // The player is often the first object in the room that has items
      child = this.machine.objectTable.getChild(currentRoom);
      while (child !== 0) {
        if (this.machine.objectTable.getChild(child) !== 0) {
          // This object has children - might be the player
          this.playerObjectCache = child;
          this.state.playerObject = child;
          return child;
        }
        child = this.machine.objectTable.getSibling(child);
      }
    }

    return null;
  }

  /**
   * Get current room from global variable 16
   * In the Z-machine, global 16 (0-indexed) traditionally stores the current location.
   */
  private getCurrentRoom(): number | null {
    if (!this.machine) return null;

    try {
      const globalsAddr = this.machine.header.globalsAddress;
      const globalIndex = 16;
      const roomGlobalAddr = globalsAddr + globalIndex * 2;
      const roomObjectNum = this.machine.memory.readWord(roomGlobalAddr);
      return roomObjectNum > 0 ? roomObjectNum : null;
    } catch {
      return null;
    }
  }

  /**
   * Get the name of an object
   */
  private getObjectName(objectNum: number): string {
    if (!this.machine || objectNum === 0) return 'nowhere';

    try {
      const name = this.machine.getObjectName(objectNum);
      return name && name.trim().length > 0 ? name : `Object ${objectNum}`;
    } catch {
      return `Object ${objectNum}`;
    }
  }

  /**
   * Get a friendly display name for a location
   * Replaces player object names like "cretin" with "You"
   */
  private getDisplayName(objectNum: number): string {
    const playerObj = this.getPlayerObject();
    if (objectNum === playerObj) {
      return 'You';
    }
    return this.getObjectName(objectNum);
  }

  /**
   * Scan all objects in the game to find items
   * This is called once when attaching to identify objects
   */
  private scanAllObjects(): void {
    if (!this.machine) return;

    const playerObj = this.getPlayerObject();

    // Scan through objects to find items
    // Z-machine objects are numbered 1-255 (v1-3) or 1-65535 (v4+)
    // Most games use far fewer objects (<500), so stop when finding consecutive invalid objects
    const maxObjects = this.machine.version <= 3 ? 255 : 65535;
    let consecutiveInvalid = 0;

    for (let objNum = 1; objNum <= maxObjects; objNum++) {
      try {
        // Check if this object exists by trying to get its parent
        // Objects with parent 0 and no name are likely unused
        const parent = this.machine.objectTable.getParent(objNum);
        const name = this.getObjectName(objNum);

        if (name === `Object ${objNum}` && parent === 0) {
          // This object appears unused
          consecutiveInvalid++;
          if (consecutiveInvalid >= InventoryTracker.MAX_CONSECUTIVE_INVALID_OBJECTS) {
            // Found too many consecutive invalid objects - stop scanning
            break;
          }
          continue;
        }

        // Found a valid object - reset counter
        consecutiveInvalid = 0;

        // Check if this is a takeable item (child of player or a room)
        const isInInventory = parent === playerObj && playerObj !== null;
        const locationName = this.getDisplayName(parent);

        // Add to tracked items
        this.state.items.set(objNum, {
          id: objNum,
          name,
          location: parent,
          locationName,
          inInventory: isInInventory,
          firstSeen: this.state.currentTurn,
          history: [],
        });
      } catch (error: unknown) {
        // Only stop scanning when we hit the end of valid objects.
        // For other errors, skip this object and continue scanning.
        if (error instanceof RangeError) {
          // Object doesn't exist, stop scanning
          break;
        }
        continue;
      }
    }
  }

  /**
   * Scan for changes in item locations
   */
  private scanForChanges(): void {
    if (!this.machine) return;

    const playerObj = this.getPlayerObject();

    // Check each tracked item for location changes
    for (const [objNum, item] of this.state.items) {
      try {
        const newParent = this.machine.objectTable.getParent(objNum);

        if (newParent !== item.location) {
          // Item has moved!
          const newLocationName = this.getDisplayName(newParent);
          const isNowInInventory = newParent === playerObj && playerObj !== null;

          // Record the change
          const historyEntry: ItemHistoryEntry = {
            turn: this.state.currentTurn,
            fromLocation: item.location,
            fromLocationName: item.locationName,
            toLocation: newParent,
            toLocationName: newLocationName,
            command: this.lastCommand || undefined,
          };

          // Update the item using immutable update
          this.state.items.set(objNum, {
            ...item,
            location: newParent,
            locationName: newLocationName,
            inInventory: isNowInInventory,
            history: [...item.history, historyEntry],
          });

          // At this point the movement is fully recorded: consumers can interpret
          // "picked up" vs "dropped" by comparing from/to locations and the inInventory flag.
        }
      } catch {
        // Object no longer exists, remove from tracking
        this.state.items.delete(objNum);
      }
    }
  }

  /**
   * Export the inventory state as JSON for saving
   */
  exportState(): string {
    const exportData = {
      items: Array.from(this.state.items.entries()),
      playerObject: this.state.playerObject,
      currentTurn: this.state.currentTurn,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import inventory state from JSON
   * @returns true if import was successful, false if the JSON was invalid
   */
  importState(json: string): boolean {
    try {
      const data = JSON.parse(json);
      this.state = {
        items: new Map(data.items),
        playerObject: data.playerObject,
        currentTurn: data.currentTurn,
      };
      return true;
    } catch {
      // Invalid JSON or malformed data - state remains unchanged
      return false;
    }
  }

  /**
   * Reset the tracker state
   */
  reset(): void {
    this.state = {
      items: new Map(),
      playerObject: null,
      currentTurn: 0,
    };
    this.playerObjectCache = null;
    this.lastCommand = '';

    if (this.machine) {
      this.scanAllObjects();
    }
  }
}
