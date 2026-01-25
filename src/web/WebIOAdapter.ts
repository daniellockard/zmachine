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
    // Convert newlines to <br> and append
    const span = document.createElement('span');
    span.textContent = text;
    this.output.appendChild(span);
    
    // Auto-scroll to bottom
    this.output.scrollTop = this.output.scrollHeight;
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
    // Track current window for V3+ windowing support
    // Window 0 = lower/main, Window 1 = upper/status
    this.currentWindow = window;
  }

  splitWindow(lines: number): void {
    // Track upper window size for V3+ windowing support
    this.upperWindowLines = lines;
    // Could be used to create a fixed upper window
    // For now, just track the value for future implementation
  }

  eraseWindow(window: number): void {
    if (window === -1 || window === 0) {
      this.output.innerHTML = '';
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

  // Optional save/restore through browser storage
  async save(data: Uint8Array): Promise<boolean> {
    try {
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
    try {
      const base64 = localStorage.getItem('zmachine-save');
      if (!base64) {
        this.print('[No saved game found]\n');
        return null;
      }
      const binary = atob(base64);
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        data[i] = binary.charCodeAt(i);
      }
      this.print('[Game restored]\n');
      return data;
    } catch {
      this.print('[Restore failed]\n');
      return null;
    }
  }
}
