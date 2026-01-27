/**
 * Map Renderer
 *
 * Renders the game map as an SVG visualization.
 *
 * @module
 */

import { MapTracker, MapRoom, MapConnection, DIRECTIONS } from './MapTracker';

/**
 * Configuration for the map renderer
 */
export interface MapRendererConfig {
  /** Container element for the map */
  container: HTMLElement;
  /** Room width in pixels */
  roomWidth?: number;
  /** Room height in pixels */
  roomHeight?: number;
  /** Grid spacing multiplier */
  gridSpacing?: number;
  /** Show room names */
  showNames?: boolean;
}

/**
 * Renders the map as an SVG
 */
export class MapRenderer {
  private container: HTMLElement;
  private svg: SVGSVGElement;
  private tracker: MapTracker;

  private roomWidth: number;
  private roomHeight: number;
  private gridSpacing: number;
  private showNames: boolean;

  // Pan and zoom state
  private panX: number = 0;
  private panY: number = 0;
  private zoom: number = 1;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  constructor(tracker: MapTracker, config: MapRendererConfig) {
    this.tracker = tracker;
    this.container = config.container;
    this.roomWidth = config.roomWidth ?? 80;
    this.roomHeight = config.roomHeight ?? 40;
    this.gridSpacing = config.gridSpacing ?? 120; // Must be larger than roomWidth for no overlap
    this.showNames = config.showNames ?? true;

    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'map-svg');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.container.appendChild(this.svg);

    // Set up event handlers
    this.setupEventHandlers();

    // Subscribe to map updates
    tracker.setUpdateCallback(() => this.render());
  }

  private setupEventHandlers(): void {
    // Pan with mouse drag
    this.svg.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
      this.svg.style.cursor = 'grabbing';
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.updateViewBox();
      }
    });

    this.svg.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.svg.style.cursor = 'grab';
    });

    this.svg.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.svg.style.cursor = 'grab';
    });

    // Zoom with wheel
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.25, Math.min(4, this.zoom * delta));
      this.updateViewBox();
    });

    // Touch support
    let lastTouchDist = 0;
    this.svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStartX = e.touches[0].clientX - this.panX;
        this.dragStartY = e.touches[0].clientY - this.panY;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    this.svg.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        this.panX = e.touches[0].clientX - this.dragStartX;
        this.panY = e.touches[0].clientY - this.dragStartY;
        this.updateViewBox();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDist > 0) {
          const delta = dist / lastTouchDist;
          this.zoom = Math.max(0.25, Math.min(4, this.zoom * delta));
          this.updateViewBox();
        }
        lastTouchDist = dist;
      }
    });

    this.svg.addEventListener('touchend', () => {
      this.isDragging = false;
      lastTouchDist = 0;
    });
  }

  private updateViewBox(): void {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width / this.zoom;
    const height = rect.height / this.zoom;
    const x = -this.panX / this.zoom - width / 2;
    const y = -this.panY / this.zoom - height / 2;
    this.svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  }

  /**
   * Center view on the current room
   */
  centerOnCurrentRoom(): void {
    const map = this.tracker.getMap();
    if (map.currentRoom !== null) {
      const room = map.rooms.get(map.currentRoom);
      if (room) {
        const x = room.x * this.gridSpacing;
        const y = room.y * this.gridSpacing;
        this.panX = -x * this.zoom;
        this.panY = -y * this.zoom;
        this.updateViewBox();
      }
    }
  }

  /**
   * Render the complete map
   */
  render(): void {
    // Clear existing content
    this.svg.innerHTML = '';

    // Add defs for markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrowhead" markerWidth="10" markerHeight="7" 
              refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#cc6666" />
      </marker>
    `;
    this.svg.appendChild(defs);

    // Render connections first (so rooms appear on top)
    const connections = this.tracker.getConnections();
    for (const conn of connections) {
      this.renderConnection(conn);
    }

    // Render rooms
    const rooms = this.tracker.getRooms();
    for (const room of rooms) {
      this.renderRoom(room);
    }

    this.updateViewBox();
  }

  private renderRoom(room: MapRoom): void {
    const x = room.x * this.gridSpacing;
    const y = room.y * this.gridSpacing;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'map-room');
    g.setAttribute('data-room-id', String(room.id));

    // Room rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x - this.roomWidth / 2));
    rect.setAttribute('y', String(y - this.roomHeight / 2));
    rect.setAttribute('width', String(this.roomWidth));
    rect.setAttribute('height', String(this.roomHeight));
    rect.setAttribute('rx', '4');
    rect.setAttribute('ry', '4');

    if (room.isCurrent) {
      rect.setAttribute('class', 'room-current');
    } else if (room.visited) {
      rect.setAttribute('class', 'room-visited');
    } else {
      rect.setAttribute('class', 'room-unvisited');
    }

    g.appendChild(rect);

    // Room name
    if (this.showNames) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('class', 'room-name');

      // Truncate long names
      const maxLen = Math.floor(this.roomWidth / 7);
      const displayName =
        room.name.length > maxLen ? room.name.slice(0, maxLen - 1) + '…' : room.name;
      text.textContent = displayName;

      g.appendChild(text);
    }

    // Tooltip
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = room.name;
    g.appendChild(title);

    this.svg.appendChild(g);
  }

  private renderConnection(conn: MapConnection): void {
    const fromRoom = this.tracker.getMap().rooms.get(conn.from);
    const toRoom = this.tracker.getMap().rooms.get(conn.to);

    if (!fromRoom || !toRoom) return;

    const x1 = fromRoom.x * this.gridSpacing;
    const y1 = fromRoom.y * this.gridSpacing;
    const x2 = toRoom.x * this.gridSpacing;
    const y2 = toRoom.y * this.gridSpacing;

    // Calculate edge points (from room border, not center)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len === 0) return;

    const nx = dx / len;
    const ny = dy / len;

    // Start and end points at room edges
    const startX = x1 + nx * (this.roomWidth / 2);
    const startY = y1 + ny * (this.roomHeight / 2);
    const endX = x2 - nx * (this.roomWidth / 2);
    const endY = y2 - ny * (this.roomHeight / 2);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(startX));
    line.setAttribute('y1', String(startY));
    line.setAttribute('x2', String(endX));
    line.setAttribute('y2', String(endY));
    line.setAttribute('class', conn.oneWay ? 'connection-oneway' : 'connection');

    if (conn.oneWay) {
      line.setAttribute('marker-end', 'url(#arrowhead)');
    }

    // Direction label
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    const dirInfo = DIRECTIONS[conn.direction];
    if (dirInfo) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(midX));
      label.setAttribute('y', String(midY - 5));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'connection-label');
      label.textContent = dirInfo.short.toUpperCase();
      this.svg.appendChild(label);
    }

    this.svg.appendChild(line);
  }

  /**
   * Toggle room name visibility
   */
  setShowNames(show: boolean): void {
    this.showNames = show;
    this.render();
  }

  /**
   * Reset zoom and pan
   */
  resetView(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.centerOnCurrentRoom();
  }
}
