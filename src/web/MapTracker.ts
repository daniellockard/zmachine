/**
 * Automatic Map Tracker
 *
 * Tracks player movement through the game world and builds a graph
 * of connected rooms for visual display.
 *
 * @module
 */

import { ZMachine } from '../core/ZMachine';

/**
 * Cardinal directions and their opposites
 */
export const DIRECTIONS = {
  north: { short: 'n', opposite: 'south', dx: 0, dy: -1 },
  south: { short: 's', opposite: 'north', dx: 0, dy: 1 },
  east: { short: 'e', opposite: 'west', dx: 1, dy: 0 },
  west: { short: 'w', opposite: 'east', dx: -1, dy: 0 },
  northeast: { short: 'ne', opposite: 'southwest', dx: 1, dy: -1 },
  northwest: { short: 'nw', opposite: 'southeast', dx: -1, dy: -1 },
  southeast: { short: 'se', opposite: 'northwest', dx: 1, dy: 1 },
  southwest: { short: 'sw', opposite: 'northeast', dx: -1, dy: 1 },
  up: { short: 'u', opposite: 'down', dx: 0.5, dy: -0.5 },
  down: { short: 'd', opposite: 'up', dx: -0.5, dy: 0.5 },
  in: { short: 'in', opposite: 'out', dx: 0.3, dy: 0 },
  out: { short: 'out', opposite: 'in', dx: -0.3, dy: 0 },
} as const;

/** Spiral placement constants for collision avoidance */
const SPIRAL_ANGLE_INCREMENT = 0.5;
const SPIRAL_RADIUS_MULTIPLIER = 0.3;

export type Direction = keyof typeof DIRECTIONS;

/**
 * A room in the map
 */
export interface MapRoom {
  /** Object number of the room */
  id: number;
  /** Room name from the game */
  name: string;
  /** Grid position for layout */
  x: number;
  y: number;
  /** Whether this is the current room */
  isCurrent: boolean;
  /** Whether player has visited this room */
  visited: boolean;
}

/**
 * A connection between two rooms
 */
export interface MapConnection {
  /** Source room ID */
  from: number;
  /** Destination room ID */
  to: number;
  /** Direction of travel */
  direction: Direction;
  /** Whether this is a one-way connection */
  oneWay: boolean;
}

/**
 * The complete map state
 */
export interface GameMap {
  rooms: Map<number, MapRoom>;
  connections: MapConnection[];
  currentRoom: number | null;
}

/**
 * Tracks player movement and builds a map
 */
export class MapTracker {
  private map: GameMap;
  private machine: ZMachine | null = null;
  private lastLocation: number | null = null;
  private lastCommand: string = '';
  private onUpdate: (() => void) | null = null;

  constructor() {
    this.map = {
      rooms: new Map(),
      connections: [],
      currentRoom: null,
    };
  }

  /**
   * Connect to a Z-Machine instance
   */
  attach(machine: ZMachine): void {
    this.machine = machine;
    this.reset();
  }

  /**
   * Reset the map
   */
  reset(): void {
    this.map = {
      rooms: new Map(),
      connections: [],
      currentRoom: null,
    };
    this.lastLocation = null;
    this.lastCommand = '';
    this.notifyUpdate();
  }

  /**
   * Set callback for map updates
   */
  setUpdateCallback(callback: () => void): void {
    this.onUpdate = callback;
  }

  /**
   * Called before a command is executed
   */
  beforeCommand(command: string): void {
    this.lastCommand = command.toLowerCase().trim();
    this.lastLocation = this.getCurrentLocation();
  }

  /**
   * Called after a command is executed
   */
  afterCommand(): void {
    const newLocation = this.getCurrentLocation();

    if (newLocation === null || newLocation === 0) {
      return;
    }

    // Add room if not seen before
    if (!this.map.rooms.has(newLocation)) {
      this.addRoom(newLocation);
    }

    // Update current room
    if (this.map.currentRoom !== null) {
      const oldRoom = this.map.rooms.get(this.map.currentRoom);
      if (oldRoom) {
        oldRoom.isCurrent = false;
      }
    }

    const currentRoom = this.map.rooms.get(newLocation);
    if (currentRoom) {
      currentRoom.isCurrent = true;
      currentRoom.visited = true;
    }
    this.map.currentRoom = newLocation;

    // If location changed, try to add a connection
    if (
      this.lastLocation !== null &&
      this.lastLocation !== newLocation &&
      this.lastLocation !== 0
    ) {
      const direction = this.parseDirection(this.lastCommand);
      if (direction) {
        this.addConnection(this.lastLocation, newLocation, direction);
      }
    }

    this.notifyUpdate();
  }

  /**
   * Get current location from Z-Machine global variable 16
   * (the first global variable, typically the player's current room object)
   */
  private getCurrentLocation(): number | null {
    if (!this.machine) return null;

    try {
      // Read global variable 16 (index 0 in the globals table), which by convention
      // usually holds the player's current room object. In the Z-machine, globals
      // are variables 16-255, stored starting at header.globalsAddress.
      const globalsAddr = this.machine.header.globalsAddress;
      const location = this.machine.memory.readWord(globalsAddr);
      return location;
    } catch {
      return null;
    }
  }

  /**
   * Add a new room to the map
   */
  private addRoom(objectNum: number): void {
    const name = this.machine?.getObjectName(objectNum) ?? `Room ${objectNum}`;

    // Calculate position based on how we got here
    let x = 0;
    let y = 0;

    if (this.lastLocation !== null && this.map.rooms.has(this.lastLocation)) {
      const lastRoom = this.map.rooms.get(this.lastLocation)!;
      const direction = this.parseDirection(this.lastCommand);

      if (direction && DIRECTIONS[direction]) {
        const dir = DIRECTIONS[direction];
        x = lastRoom.x + dir.dx * 2;
        y = lastRoom.y + dir.dy * 2;
      } else {
        // Unknown direction - place nearby
        x = lastRoom.x + 2;
        y = lastRoom.y;
      }
    }

    // Avoid overlapping rooms - shift in a spiral pattern to find empty spot
    let attempts = 0;
    const originalX = x;
    const originalY = y;
    while (this.isPositionOccupied(x, y) && attempts < 20) {
      // Spiral outward to find empty spot
      attempts++;
      const angle = attempts * SPIRAL_ANGLE_INCREMENT;
      x = originalX + Math.cos(angle) * attempts * SPIRAL_RADIUS_MULTIPLIER;
      y = originalY + Math.sin(angle) * attempts * SPIRAL_RADIUS_MULTIPLIER;
    }

    this.map.rooms.set(objectNum, {
      id: objectNum,
      name,
      x,
      y,
      isCurrent: false,
      visited: false,
    });
  }

  /**
   * Check if a position is already occupied
   */
  private isPositionOccupied(x: number, y: number): boolean {
    for (const room of this.map.rooms.values()) {
      if (Math.abs(room.x - x) < 1 && Math.abs(room.y - y) < 1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Add a connection between rooms
   */
  private addConnection(from: number, to: number, direction: Direction): void {
    // Check if connection already exists
    const exists = this.map.connections.some(
      (c) => c.from === from && c.to === to && c.direction === direction
    );

    if (!exists) {
      const oppositeDir = DIRECTIONS[direction].opposite as Direction;

      // Look for a connection from 'to' back toward 'from' in the opposite direction
      const reverseConnection = this.map.connections.find(
        (c) => c.from === to && c.direction === oppositeDir
      );

      // Determine if this is a one-way connection:
      // - If no reverse exists yet, assume two-way (will be updated later if needed)
      // - If reverse exists and goes to us, it's two-way
      // - If reverse exists and goes elsewhere, both are one-way (inconsistent maze)
      let isOneWay = false;

      if (reverseConnection) {
        const reverseIndex = this.map.connections.indexOf(reverseConnection);

        if (reverseConnection.to !== from) {
          // Inconsistent! The reverse direction goes somewhere else
          // Mark both as one-way using truly immutable update
          isOneWay = true;
          if (reverseIndex !== -1) {
            this.map.connections = this.map.connections.map((conn, idx) =>
              idx === reverseIndex ? { ...conn, oneWay: true } : conn
            );
          }
        } else if (reverseIndex !== -1) {
          // Consistent - reverse goes back to us, use truly immutable update
          this.map.connections = this.map.connections.map((conn, idx) =>
            idx === reverseIndex ? { ...conn, oneWay: false } : conn
          );
        }
      }

      this.map.connections.push({
        from,
        to,
        direction,
        oneWay: isOneWay,
      });

      // Also check: does 'to' already have a connection in the opposite direction?
      // If not, check if we previously added from->to thinking it was two-way,
      // but now 'to' goes somewhere else
      this.validateReverseConsistency(to, from, oppositeDir);
    }
  }

  /**
   * Check if a room's exits are consistent with how we got there
   * Called when we discover new connections from a room
   */
  private validateReverseConsistency(
    room: number,
    expectedReturn: number,
    direction: Direction
  ): void {
    // Find any connection from 'room' in 'direction'
    const outgoingIndex = this.map.connections.findIndex(
      (c) => c.from === room && c.direction === direction
    );

    if (outgoingIndex !== -1) {
      const outgoing = this.map.connections[outgoingIndex];

      if (outgoing.to !== expectedReturn) {
        // Inconsistent! Going 'direction' from 'room' doesn't return to where we came from
        // Use immutable update for consistency
        this.map.connections = this.map.connections.map((conn, idx) =>
          idx === outgoingIndex ? { ...conn, oneWay: true } : conn
        );

        // Also mark the incoming connection as one-way
        const oppositeDir = DIRECTIONS[direction].opposite as Direction;
        const incomingIndex = this.map.connections.findIndex(
          (c) => c.from === expectedReturn && c.to === room && c.direction === oppositeDir
        );

        if (incomingIndex !== -1) {
          this.map.connections = this.map.connections.map((conn, idx) =>
            idx === incomingIndex ? { ...conn, oneWay: true } : conn
          );
        }
      }
    }
  }

  /**
   * Parse a command to extract direction
   */
  private parseDirection(command: string): Direction | null {
    const cmd = command.toLowerCase().trim();

    // Direct direction match
    if (cmd in DIRECTIONS) {
      return cmd as Direction;
    }

    // Short form match
    for (const [dir, info] of Object.entries(DIRECTIONS)) {
      if (cmd === info.short) {
        return dir as Direction;
      }
    }

    // "go <direction>" pattern
    if (cmd.startsWith('go ')) {
      const rest = cmd.slice(3).trim();
      return this.parseDirection(rest);
    }

    return null;
  }

  /**
   * Get the current map state
   */
  getMap(): GameMap {
    return this.map;
  }

  /**
   * Get rooms as an array for rendering
   */
  getRooms(): MapRoom[] {
    return Array.from(this.map.rooms.values());
  }

  /**
   * Get connections for rendering
   */
  getConnections(): MapConnection[] {
    return this.map.connections;
  }

  /**
   * Export map data as JSON
   */
  exportMap(): string {
    return JSON.stringify(
      {
        rooms: Array.from(this.map.rooms.entries()),
        connections: this.map.connections,
        currentRoom: this.map.currentRoom,
      },
      null,
      2
    );
  }

  /**
   * Import map data from JSON
   */
  importMap(json: string): void {
    try {
      const data = JSON.parse(json);
      this.map = {
        rooms: new Map(data.rooms),
        connections: data.connections,
        currentRoom: data.currentRoom,
      };
      this.notifyUpdate();
    } catch {
      console.error('Failed to import map');
    }
  }

  private notifyUpdate(): void {
    if (this.onUpdate) {
      this.onUpdate();
    }
  }
}
