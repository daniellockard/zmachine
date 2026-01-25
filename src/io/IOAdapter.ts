/**
 * I/O Adapter Interface
 * 
 * Abstract interface for platform-specific I/O operations.
 * Implementations can target browser (DOM), terminal, testing, etc.
 * 
 * Reference: Z-Machine Specification §8 (Output Streams)
 * 
 * @module
 */

import { ZVersion } from '../types/ZMachineTypes';

/**
 * Window properties for V4+ windowed output
 */
export interface WindowProps {
  number: number;
  cursorX: number;
  cursorY: number;
}

/**
 * Result of reading a line of input
 */
export interface ReadLineResult {
  text: string;
  terminator: number; // ZSCII terminating character
}

/**
 * Abstract I/O adapter for Z-machine input/output
 */
export interface IOAdapter {
  /**
   * Initialize the I/O adapter
   * Called once when the Z-machine starts
   */
  initialize(version: ZVersion): void;

  /**
   * Print text to the current output stream
   */
  print(text: string): void;

  /**
   * Print text followed by a newline
   */
  printLine(text: string): void;

  /**
   * Print a newline
   */
  newLine(): void;

  /**
   * Read a line of text from the user
   * 
   * @param maxLength - Maximum number of characters to accept
   * @param timeout - Timeout in tenths of a second (0 = no timeout)
   * @returns The input text and terminating character
   */
  readLine(maxLength: number, timeout?: number): Promise<ReadLineResult>;

  /**
   * Read a single character from the user
   * 
   * @param timeout - Timeout in tenths of a second (0 = no timeout)
   * @returns ZSCII character code
   */
  readChar(timeout?: number): Promise<number>;

  /**
   * Set the current output window (V4+)
   */
  setWindow?(window: number): void;

  /**
   * Split the window (V3+)
   * 
   * @param lines - Number of lines for upper window
   */
  splitWindow?(lines: number): void;

  /**
   * Erase a window
   */
  eraseWindow?(window: number): void;

  /**
   * Erase from cursor to end of line (V4+)
   */
  eraseLine?(): void;

  /**
   * Set cursor position (V4+)
   */
  setCursor?(line: number, column: number): void;

  /**
   * Get cursor position (V6+)
   */
  getCursor?(): { line: number; column: number };

  /**
   * Set text style (V4+)
   * 0 = Roman, 1 = Reverse video, 2 = Bold, 4 = Italic, 8 = Fixed
   */
  setTextStyle?(style: number): void;

  /**
   * Set foreground color (V5+)
   */
  setForegroundColor?(color: number): void;

  /**
   * Set background color (V5+)
   */
  setBackgroundColor?(color: number): void;

  /**
   * Sound effect (V3+)
   */
  soundEffect?(number: number, effect: number, volume: number): void;

  /**
   * Enable/disable output stream
   * 
   * @param stream - Stream number (1=screen, 2=transcript, 3=memory, 4=script)
   * @param enable - True to enable, false to disable
   * @param table - For stream 3, the memory address
   */
  setOutputStream?(stream: number, enable: boolean, table?: number): void;

  /**
   * Select input stream
   * 
   * @param stream - Stream number (0=keyboard, 1=file)
   */
  setInputStream?(stream: number): void;

  /**
   * Show the game status line (V3)
   * 
   * @param location - Current location name
   * @param score - Current score (or hours)
   * @param turns - Number of turns (or minutes)
   * @param isTime - True if score/turns are time-based
   */
  showStatusLine?(location: string, score: number, turns: number, isTime: boolean): void;

  /**
   * Called when the game quits
   */
  quit(): void;

  /**
   * Called when restarting
   */
  restart(): void;

  /**
   * Save game state
   * 
   * @param data - The save data
   * @returns True if save succeeded
   */
  save?(data: Uint8Array): Promise<boolean>;

  /**
   * Restore game state
   * 
   * @returns The restored data, or null if cancelled/failed
   */
  restore?(): Promise<Uint8Array | null>;

  /**
   * Check if the game file is verified (checksum)
   */
  verify?(): boolean;

  /**
   * Get buffering mode
   */
  getBufferMode?(): boolean;

  /**
   * Set buffering mode
   */
  setBufferMode?(mode: boolean): void;
}
