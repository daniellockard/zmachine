/**
 * Test I/O Adapter
 * 
 * A simple in-memory I/O adapter for testing purposes.
 * Captures all output and can be configured with pre-set inputs.
 * 
 * @module
 */

import { IOAdapter, ReadLineResult } from './IOAdapter';
import { ZVersion } from '../types/ZMachineTypes';

/**
 * Test I/O adapter that records output and uses predefined inputs
 */
export class TestIOAdapter implements IOAdapter {
  /** All captured output */
  readonly output: string[] = [];
  
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

  initialize(_version: ZVersion): void {
    // Nothing to do for tests
  }

  print(text: string): void {
    // Append to last output element if it exists and doesn't end with newline
    if (this.output.length > 0 && !this.output[this.output.length - 1].endsWith('\n')) {
      this.output[this.output.length - 1] += text;
    } else {
      this.output.push(text);
    }
  }

  printLine(text: string): void {
    this.print(text + '\n');
  }

  newLine(): void {
    this.print('\n');
  }

  async readLine(maxLength: number, _timeout?: number): Promise<ReadLineResult> {
    if (this.lineInputs.length === 0) {
      throw new Error('No line input available');
    }
    const text = this.lineInputs.shift()!.substring(0, maxLength);
    return { text, terminator: 13 }; // Enter key
  }

  async readChar(_timeout?: number): Promise<number> {
    if (this.charInputs.length === 0) {
      throw new Error('No character input available');
    }
    return this.charInputs.shift()!;
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
   * Get all output as a single string
   */
  getFullOutput(): string {
    return this.output.join('');
  }

  /**
   * Clear all output
   */
  clearOutput(): void {
    this.output.length = 0;
  }

  /**
   * Reset the adapter to initial state
   */
  reset(): void {
    this.output.length = 0;
    this.lineInputs.length = 0;
    this.charInputs.length = 0;
    this.hasQuit = false;
    this.hasRestarted = false;
    this.lastStatusLine = undefined;
  }
}
