/**
 * Inventory Renderer
 *
 * Renders the inventory state as an HTML panel showing items
 * currently held and their history.
 *
 * @module
 */

import { InventoryTracker, InventoryItem } from './InventoryTracker';

/**
 * Configuration options for the inventory renderer
 */
export interface InventoryRendererConfig {
  /** Container element for the inventory panel */
  container: HTMLElement;
  /** Whether to show item history */
  showHistory?: boolean;
  /** Maximum history entries to show per item */
  maxHistoryEntries?: number;
}

/**
 * Renders the inventory state to an HTML panel
 */
export class InventoryRenderer {
  private tracker: InventoryTracker;
  private container: HTMLElement;
  private showHistory: boolean;
  private maxHistoryEntries: number;

  constructor(tracker: InventoryTracker, config: InventoryRendererConfig) {
    this.tracker = tracker;
    this.container = config.container;
    this.showHistory = config.showHistory ?? true;
    this.maxHistoryEntries = config.maxHistoryEntries ?? 5;

    // Only initialize if container exists
    if (this.container) {
      this.createPanel();
      this.render();
    }
  }

  /**
   * Create the inventory panel structure
   */
  private createPanel(): void {
    if (!this.container) return;

    // Create content directly in the container (no extra wrapper needed)
    this.container.innerHTML = `
      <div class="inventory-list"></div>
      <div class="inventory-empty">No items</div>
    `;
  }

  /**
   * Render the current inventory state
   */
  render(): void {
    if (!this.container) return;

    const listEl = this.container.querySelector('.inventory-list') as HTMLElement;
    const emptyEl = this.container.querySelector('.inventory-empty') as HTMLElement;

    if (!listEl || !emptyEl) return;

    const inventory = this.tracker.getInventory();

    if (inventory.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    listEl.style.display = 'block';
    emptyEl.style.display = 'none';

    // Sort items by name
    const sortedItems = [...inventory].sort((a, b) => a.name.localeCompare(b.name));

    listEl.innerHTML = sortedItems.map((item) => this.renderItem(item)).join('');
  }

  /**
   * Render a single inventory item
   */
  private renderItem(item: InventoryItem): string {
    const historyHtml = this.showHistory ? this.renderHistory(item) : '';

    return `
      <div class="inventory-item" data-id="${item.id}">
        <div class="item-name">${this.escapeHtml(item.name)}</div>
        ${historyHtml}
      </div>
    `;
  }

  /**
   * Render the history for an item
   */
  private renderHistory(item: InventoryItem): string {
    if (item.history.length === 0) return '';

    const recentHistory = item.history.slice(-this.maxHistoryEntries);

    const entries = recentHistory.map((entry) => {
      const fromName = this.escapeHtml(entry.fromLocationName);
      const toName = this.escapeHtml(entry.toLocationName);
      const command = entry.command ? ` (${this.escapeHtml(entry.command)})` : '';

      return `<div class="history-entry">Turn ${entry.turn}: ${fromName} → ${toName}${command}</div>`;
    });

    return `<div class="item-history">${entries.join('')}</div>`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get CSS styles for the inventory panel
   */
  static getStyles(): string {
    return `
      .inventory-panel {
        background: #1a1a2e;
        border: 1px solid #4a4a6a;
        border-radius: 8px;
        color: #e0e0e0;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 14px;
        max-height: 400px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .inventory-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: #252540;
        border-bottom: 1px solid #4a4a6a;
      }

      .inventory-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #a0a0ff;
      }

      .inventory-toggle {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 4px;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .inventory-toggle:hover {
        opacity: 1;
      }

      .inventory-content {
        overflow-y: auto;
        flex: 1;
        padding: 8px;
      }

      .inventory-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .inventory-empty {
        color: #888;
        text-align: center;
        padding: 20px;
        font-style: italic;
      }

      .inventory-item {
        background: #252540;
        border-radius: 4px;
        padding: 8px 12px;
      }

      .item-name {
        font-weight: 500;
        color: #e0e0ff;
      }

      .item-history {
        margin-top: 6px;
        padding-left: 12px;
        border-left: 2px solid #4a4a6a;
        font-size: 12px;
        color: #888;
      }

      .history-entry {
        padding: 2px 0;
      }
    `;
  }

  /**
   * Clean up the renderer
   */
  destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
