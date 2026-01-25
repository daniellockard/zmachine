/**
 * Web I/O Adapter
 * 
 * Browser-based I/O adapter that connects the Z-machine to a web interface.
 * Uses DOM elements for output and captures keyboard input.
 * 
 * @module
 */

import { IOAdapter, ReadLineResult } from '../io/IOAdapter';
import { ZVersion } from '../types/ZMachineTypes';

/**
 * Configuration for the WebIOAdapter
 */
export interface WebIOConfig {
  /** Element to display game output */
  outputElement: HTMLElement;
  /** Input element for user text */
  inputElement: HTMLInputElement;
  /** Optional element for status line */
  statusElement?: HTMLElement;
  /** Optional callback when game quits */
  onQuit?: () => void;
  /** Optional callback when game restarts */
  onRestart?: () => void;
}

/**
 * Web-based I/O adapter for browser gameplay
 */
export class WebIOAdapter implements IOAdapter {
  private output: HTMLElement;
  private input: HTMLInputElement;
  private status?: HTMLElement;
  private onQuit?: () => void;
  private onRestart?: () => void;
  
  private lineResolve?: (result: ReadLineResult) => void;
  private charResolve?: (char: number) => void;
  private version: ZVersion = 3;
  
  /** Current active window (0 = lower/main, 1 = upper/status) */
  private currentWindow: number = 0;
  
  /** Number of lines in upper window */
  private upperWindowLines: number = 0;
  
  /** Buffer for upper window text (V4+ games write directly) */
  private upperWindowText: string = '';
  
  /** Current text style (bitmask: 1=reverse, 2=bold, 4=italic, 8=fixed) */
  private textStyle: number = 0;
  
  /** Cursor position in upper window (1-based) */
  private upperCursor: { line: number; column: number } = { line: 1, column: 1 };

  constructor(config: WebIOConfig) {
    this.output = config.outputElement;
    this.input = config.inputElement;
    this.status = config.statusElement;
    this.onQuit = config.onQuit;
    this.onRestart = config.onRestart;

    this.setupInputHandler();
  }

  private setupInputHandler(): void {
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.lineResolve) {
        const text = this.input.value;
        this.input.value = '';
        
        // Echo input to output
        this.print(text + '\n');
        
        this.lineResolve({ text, terminator: 13 });
        this.lineResolve = undefined;
      } else if (this.charResolve) {
        // Single character input
        const charCode = e.key.length === 1 ? e.key.charCodeAt(0) : 0;
        if (charCode > 0) {
          e.preventDefault();
          this.charResolve(charCode);
          this.charResolve = undefined;
        }
      }
    });
  }

  initialize(version: ZVersion): void {
    this.version = version;
    this.output.innerHTML = '';
  }

  print(text: string): void {
    // Route output based on current window
    if (this.currentWindow === 1 && this.status) {
      // Upper window (status line area) - buffer text for display
      this.upperWindowText += text;
      // Update status element with the buffered text
      // Strip newlines and show as single line
      this.status.textContent = this.upperWindowText.replace(/\n/g, ' ').trim();
    } else {
      // Lower window (main output)
      const span = document.createElement('span');
      span.textContent = text;
      
      // Apply text styles
      this.applyTextStyle(span);
      
      this.output.appendChild(span);
      
      // Auto-scroll to bottom
      this.output.scrollTop = this.output.scrollHeight;
    }
  }
  
  /**
   * Apply current text style and colors to an element
   * Style bits: 1=reverse, 2=bold, 4=italic, 8=fixed-width
   */
  private applyTextStyle(element: HTMLElement): void {
    // Apply colors (unless reverse video is set, which swaps them)
    if (!(this.textStyle & 1)) {
      if (this.foregroundColor) {
        element.style.color = this.foregroundColor;
      }
      if (this.backgroundColor) {
        element.style.backgroundColor = this.backgroundColor;
      }
    }
    
    if (this.textStyle & 1) {
      // Reverse video - swap foreground and background
      const fg = this.foregroundColor || 'var(--text-color, #00ff00)';
      const bg = this.backgroundColor || 'var(--bg-color, #0a0a0a)';
      element.style.backgroundColor = fg;
      element.style.color = bg;
    }
    if (this.textStyle & 2) {
      // Bold
      element.style.fontWeight = 'bold';
    }
    if (this.textStyle & 4) {
      // Italic
      element.style.fontStyle = 'italic';
    }
    if (this.textStyle & 8) {
      // Fixed-width (already monospace, but ensure it)
      element.style.fontFamily = 'monospace';
    }
  }

  printLine(text: string): void {
    this.print(text + '\n');
  }

  newLine(): void {
    this.output.appendChild(document.createElement('br'));
    this.output.scrollTop = this.output.scrollHeight;
  }

  async readLine(maxLength: number, timeout?: number): Promise<ReadLineResult> {
    // TODO: Implement timeout support (timeout is in tenths of a second)
    // For now, timeout is ignored and input waits indefinitely
    if (timeout && timeout > 0) {
      // Future: Use setTimeout to resolve with empty input after timeout
    }
    
    // Show prompt
    this.print('>');
    
    // Focus input and wait for Enter
    this.input.focus();
    this.input.maxLength = maxLength;

    return new Promise((resolve) => {
      this.lineResolve = resolve;
    });
  }

  async readChar(timeout?: number): Promise<number> {
    // TODO: Implement timeout support (timeout is in tenths of a second)
    // For now, timeout is ignored and input waits indefinitely
    if (timeout && timeout > 0) {
      // Future: Use setTimeout to resolve with 0 after timeout
    }
    
    this.input.focus();

    return new Promise((resolve) => {
      this.charResolve = resolve;
    });
  }

  showStatusLine(location: string, scoreOrHours: number, turnsOrMinutes: number, isTime: boolean): void {
    if (!this.status) return;

    const rightSide = isTime
      ? `Time: ${scoreOrHours}:${turnsOrMinutes.toString().padStart(2, '0')}`
      : `Score: ${scoreOrHours}  Moves: ${turnsOrMinutes}`;

    this.status.innerHTML = `
      <span class="location">${this.escapeHtml(location)}</span>
      <span class="score">${rightSide}</span>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setWindow(window: number): void {
    // When switching windows, clear upper window buffer if switching TO upper window
    if (window === 1 && this.currentWindow !== 1) {
      this.upperWindowText = '';
    }
    this.currentWindow = window;
  }

  splitWindow(lines: number): void {
    this.upperWindowLines = lines;
    // Clear upper window when resizing
    if (lines > 0) {
      this.upperWindowText = '';
      this.upperCursor = { line: 1, column: 1 };
      if (this.status) {
        this.status.textContent = '';
      }
    }
  }

  setCursor(line: number, column: number): void {
    // Cursor positioning only applies to upper window
    if (this.currentWindow === 1) {
      this.upperCursor = { line, column };
      // When cursor moves to column 1, reset the line text
      if (column === 1) {
        this.upperWindowText = '';
      }
    }
  }

  getCursor(): { line: number; column: number } {
    return { ...this.upperCursor };
  }

  eraseLine(): void {
    // Erase from cursor to end of line in upper window
    if (this.currentWindow === 1 && this.status) {
      // For simple implementation, just clear the pending text
      // A full implementation would need to track line content
      this.upperWindowText = '';
    }
  }

  setTextStyle(style: number): void {
    // Style 0 resets to roman, otherwise styles are cumulative (bitmask)
    if (style === 0) {
      this.textStyle = 0;
    } else {
      this.textStyle = style;
    }
  }

  /** Z-machine color palette */
  private static readonly COLORS: Record<number, string> = {
    2: '#000000',  // black
    3: '#ff0000',  // red
    4: '#00ff00',  // green
    5: '#ffff00',  // yellow
    6: '#0000ff',  // blue
    7: '#ff00ff',  // magenta
    8: '#00ffff',  // cyan
    9: '#ffffff',  // white
  };

  /** Current foreground color (CSS) */
  private foregroundColor: string = '';
  
  /** Current background color (CSS) */
  private backgroundColor: string = '';

  setForegroundColor(color: number): void {
    if (color === 1) {
      // Default
      this.foregroundColor = '';
    } else if (color in WebIOAdapter.COLORS) {
      this.foregroundColor = WebIOAdapter.COLORS[color];
    }
  }

  setBackgroundColor(color: number): void {
    if (color === 1) {
      // Default
      this.backgroundColor = '';
    } else if (color in WebIOAdapter.COLORS) {
      this.backgroundColor = WebIOAdapter.COLORS[color];
    }
  }

  eraseWindow(window: number): void {
    if (window === -1) {
      // Unsplit and clear all
      this.output.innerHTML = '';
      this.upperWindowText = '';
      if (this.status) this.status.textContent = '';
      this.upperWindowLines = 0;
      this.currentWindow = 0;
    } else if (window === -2) {
      // Clear all, keep split
      this.output.innerHTML = '';
      this.upperWindowText = '';
      if (this.status) this.status.textContent = '';
    } else if (window === 0) {
      this.output.innerHTML = '';
    } else if (window === 1) {
      this.upperWindowText = '';
      if (this.status) this.status.textContent = '';
    }
  }

  quit(): void {
    this.print('\n[Game ended]\n');
    this.input.disabled = true;
    this.onQuit?.();
  }

  restart(): void {
    this.output.innerHTML = '';
    this.onRestart?.();
  }

  // Save/restore through browser file download/upload
  async save(data: Uint8Array): Promise<boolean> {
    try {
      // Create a Blob from the save data (use slice to ensure plain ArrayBuffer)
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `zmachine-save-${Date.now()}.qzl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Also store in localStorage as backup
      const base64 = btoa(String.fromCharCode(...data));
      localStorage.setItem('zmachine-save', base64);
      
      this.print('[Game saved]\n');
      return true;
    } catch {
      this.print('[Save failed]\n');
      return false;
    }
  }

  async restore(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      // Create file input for upload
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.qzl,.sav';
      
      fileInput.onchange = async (): Promise<void> => {
        const file = fileInput.files?.[0];
        if (file) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            this.print('[Game restored]\n');
            resolve(data);
          } catch {
            this.print('[Restore failed]\n');
            resolve(null);
          }
        } else {
          // User cancelled - try localStorage backup
          const base64 = localStorage.getItem('zmachine-save');
          if (base64) {
            try {
              const binary = atob(base64);
              const data = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                data[i] = binary.charCodeAt(i);
              }
              this.print('[Game restored from backup]\n');
              resolve(data);
            } catch {
              this.print('[No saved game found]\n');
              resolve(null);
            }
          } else {
            this.print('[No saved game found]\n');
            resolve(null);
          }
        }
      };
      
      // Trigger file selection
      fileInput.click();
    });
  }
}
