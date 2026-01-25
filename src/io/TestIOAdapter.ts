/**
 * Test I/O Adapter
 * 
 * A simple in-memory I/O adapter for testing purposes.
 * Captures all output and can be configured with pre-set inputs.
 * Implements V5 screen model for proper game support.
 * 
 * @module
 */

import { IOAdapter, ReadLineResult } from './IOAdapter';
import { ZVersion } from '../types/ZMachineTypes';

/**
 * Test I/O adapter that records output and uses predefined inputs
 */
export class TestIOAdapter implements IOAdapter {
  /** All captured output from lower window (window 0) */
  readonly output: string[] = [];
  
  /** Captured output from upper window (window 1) */
  readonly upperOutput: string[] = [];
  
  /** Current window (0 = lower/main, 1 = upper/status) */
  private currentWindow: number = 0;
  
  /** Number of lines in upper window */
  private upperWindowLines: number = 0;
  
  /** Cursor position for upper window */
  private upperCursor: { line: number; column: number } = { line: 1, column: 1 };
  
  /** Pending line inputs */
  private lineInputs: string[] = [];
  
  /** Pending character inputs */
  private charInputs: number[] = [];
  
  /** Whether the game has quit */
  hasQuit: boolean = false;
  
  /** Whether the game has restarted */
  hasRestarted: boolean = false;
  
  /** Last status line shown */
  lastStatusLine?: { location: string; score: number; turns: number; isTime: boolean };

  /** Current text style */
  private textStyle: number = 0;
  
  /** Buffer mode (true = buffered) */
  private bufferMode: boolean = true;

  /** Z-machine version for version-specific behavior */
  private version: ZVersion = 3;

  initialize(version: ZVersion): void {
    this.version = version;
    this.currentWindow = 0;
    this.upperWindowLines = 0;
  }

  print(text: string): void {
    const targetOutput = this.currentWindow === 0 ? this.output : this.upperOutput;
    
    // Append to last output element if it exists and doesn't end with newline
    if (targetOutput.length > 0 && !targetOutput[targetOutput.length - 1].endsWith('\n')) {
      targetOutput[targetOutput.length - 1] += text;
    } else {
      targetOutput.push(text);
    }
  }

  printLine(text: string): void {
    this.print(text + '\n');
  }

  newLine(): void {
    this.print('\n');
  }

  async readLine(maxLength: number, timeout?: number): Promise<ReadLineResult> {
    if (this.lineInputs.length === 0) {
      // If timeout is specified and no input, return empty (timeout expired)
      if (timeout !== undefined && timeout > 0) {
        return { text: '', terminator: 0 }; // 0 = timeout
      }
      throw new Error('No line input available');
    }
    const text = this.lineInputs.shift()!.substring(0, maxLength);
    return { text, terminator: 13 }; // Enter key
  }

  async readChar(timeout?: number): Promise<number> {
    if (this.charInputs.length === 0) {
      // If timeout is specified and no input, return 0 (no key pressed)
      if (timeout !== undefined && timeout > 0) {
        return 0; // No key pressed before timeout
      }
      throw new Error('No character input available');
    }
    return this.charInputs.shift()!;
  }

  // V5 Screen Model Methods
  
  setWindow(window: number): void {
    this.currentWindow = window;
  }
  
  splitWindow(lines: number): void {
    this.upperWindowLines = lines;
    // Clear upper window content when splitting
    if (lines > 0) {
      this.upperOutput.length = 0;
    }
  }
  
  eraseWindow(window: number): void {
    if (window === -1) {
      // Erase all and unsplit
      this.output.length = 0;
      this.upperOutput.length = 0;
      this.upperWindowLines = 0;
      this.currentWindow = 0;
    } else if (window === -2) {
      // Erase all, keep split
      this.output.length = 0;
      this.upperOutput.length = 0;
    } else if (window === 0) {
      this.output.length = 0;
    } else if (window === 1) {
      this.upperOutput.length = 0;
    }
  }
  
  setCursor(line: number, column: number): void {
    this.upperCursor = { line, column };
  }
  
  getCursor(): { line: number; column: number } {
    return { ...this.upperCursor };
  }
  
  setTextStyle(style: number): void {
    this.textStyle = style;
  }
  
  setBufferMode(mode: boolean): void {
    this.bufferMode = mode;
  }
  
  getBufferMode(): boolean {
    return this.bufferMode;
  }

  showStatusLine(location: string, score: number, turns: number, isTime: boolean): void {
    this.lastStatusLine = { location, score, turns, isTime };
  }

  quit(): void {
    this.hasQuit = true;
  }

  restart(): void {
    this.hasRestarted = true;
    this.output.length = 0;
    this.upperOutput.length = 0;
    this.currentWindow = 0;
    this.upperWindowLines = 0;
  }

  // Test helper methods

  /**
   * Add a line input to the queue
   */
  queueLineInput(text: string): void {
    this.lineInputs.push(text);
  }

  /**
   * Add a character input to the queue
   */
  queueCharInput(char: number): void {
    this.charInputs.push(char);
  }

  /**
   * Get all output as a single string (both windows)
   */
  getFullOutput(): string {
    const upper = this.upperOutput.join('');
    const lower = this.output.join('');
    return upper + lower;
  }
  
  /**
   * Get lower window output only
   */
  getLowerOutput(): string {
    return this.output.join('');
  }
  
  /**
   * Get upper window output only
   */
  getUpperOutput(): string {
    return this.upperOutput.join('');
  }

  /**
   * Clear all output
   */
  clearOutput(): void {
    this.output.length = 0;
    this.upperOutput.length = 0;
  }

  /**
   * Reset the adapter to initial state
   */
  reset(): void {
    this.output.length = 0;
    this.upperOutput.length = 0;
    this.lineInputs.length = 0;
    this.charInputs.length = 0;
    this.hasQuit = false;
    this.hasRestarted = false;
    this.lastStatusLine = undefined;
    this.currentWindow = 0;
    this.upperWindowLines = 0;
    this.textStyle = 0;
    this.bufferMode = true;
  }
  
  /**
   * Get current window number
   */
  getCurrentWindow(): number {
    return this.currentWindow;
  }
  
  /**
   * Get number of upper window lines
   */
  getUpperWindowLines(): number {
    return this.upperWindowLines;
  }
}
