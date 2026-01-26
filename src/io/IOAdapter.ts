/**
 * I/O Adapter Interfaces
 *
 * Abstract interfaces for platform-specific I/O operations.
 * Split into focused interfaces for better modularity and testability.
 * Implementations can target browser (DOM), terminal, testing, etc.
 *
 * Interface hierarchy:
 * - {@link IOAdapterCore} - Required methods all adapters must implement
 * - {@link IOAdapterWindowed} - Window management (V3+)
 * - {@link IOAdapterStyled} - Text styling (V4+)
 * - {@link IOAdapterColor} - Color support (V5+)
 * - {@link IOAdapterSound} - Sound effects (V3+)
 * - {@link IOAdapterSave} - Save/restore functionality
 * - {@link IOAdapterCursor} - Advanced cursor control (V4+/V6+)
 * - {@link IOAdapterStreams} - I/O stream management
 * - {@link IOAdapterStatus} - Status line display (V3)
 *
 * The combined {@link IOAdapter} type includes all interfaces.
 *
 * Reference: Z-Machine Specification §8 (Output Streams)
 *
 * @module
 */

import { ZVersion } from '../types/ZMachineTypes';

// ============================================================================
// Supporting Types
// ============================================================================

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
  /** The text entered by the user */
  text: string;
  /** ZSCII terminating character (13 = enter, or function key code) */
  terminator: number;
}

/**
 * Cursor position for getCursor()
 */
export interface CursorPosition {
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
}

// ============================================================================
// Core Interface (Required)
// ============================================================================

/**
 * Core I/O adapter interface - required methods all adapters must implement.
 *
 * This is the minimal interface for basic Z-machine operation.
 * All I/O adapters must implement these methods.
 */
export interface IOAdapterCore {
  /**
   * Initialize the I/O adapter.
   * Called once when the Z-machine starts.
   *
   * @param version - The Z-machine version (1-8)
   */
  initialize(version: ZVersion): void;

  /**
   * Print text to the current output stream.
   *
   * @param text - The text to print (ZSCII decoded to Unicode)
   */
  print(text: string): void;

  /**
   * Print text followed by a newline.
   *
   * @param text - The text to print
   */
  printLine(text: string): void;

  /**
   * Print a newline character.
   */
  newLine(): void;

  /**
   * Read a line of text from the user.
   *
   * The implementation should:
   * - Echo typed characters to the current window
   * - Support basic line editing (backspace)
   * - Return when Enter is pressed or timeout expires
   *
   * @param maxLength - Maximum number of characters to accept
   * @param timeout - Timeout in tenths of a second (0 = no timeout)
   * @returns Promise resolving to the input text and terminating character
   */
  readLine(maxLength: number, timeout?: number): Promise<ReadLineResult>;

  /**
   * Read a single character from the user.
   *
   * Should not echo the character. Returns immediately when a key is pressed
   * or timeout expires.
   *
   * @param timeout - Timeout in tenths of a second (0 = no timeout)
   * @returns Promise resolving to ZSCII character code
   */
  readChar(timeout?: number): Promise<number>;

  /**
   * Called when the game quits.
   * Implementations should clean up resources and optionally show a "game over" message.
   */
  quit(): void;

  /**
   * Called when the game restarts.
   * Implementations should reset display state (clear screen, reset windows).
   */
  restart(): void;
}

// ============================================================================
// Window Management (V3+)
// ============================================================================

/**
 * Window management interface for split-screen games.
 *
 * Z-machine V3+ support split windows:
 * - Window 0: Main/lower window (scrolling text)
 * - Window 1: Upper/status window (non-scrolling)
 *
 * @see Z-Machine Spec §8.7 (Windows)
 */
export interface IOAdapterWindowed {
  /**
   * Set the current output window.
   *
   * @param window - Window number (0 = lower, 1 = upper)
   */
  setWindow(window: number): void;

  /**
   * Split the screen into upper and lower windows.
   *
   * @param lines - Number of lines for the upper window (0 = unsplit)
   */
  splitWindow(lines: number): void;

  /**
   * Erase the contents of a window.
   *
   * @param window - Window number, or:
   *   - -1: unsplit and clear the screen
   *   - -2: clear screen without unsplitting
   */
  eraseWindow(window: number): void;
}

// ============================================================================
// Text Styling (V4+)
// ============================================================================

/**
 * Text styling interface.
 *
 * @see Z-Machine Spec §8.7.2 (Text Styles)
 */
export interface IOAdapterStyled {
  /**
   * Set the text style for subsequent output.
   *
   * Style values can be combined (bitwise OR):
   * - 0: Roman (reset all styles)
   * - 1: Reverse video
   * - 2: Bold
   * - 4: Italic
   * - 8: Fixed-pitch
   *
   * @param style - Style flags
   */
  setTextStyle(style: number): void;

  /**
   * Set buffering mode.
   *
   * When buffering is on, output may be collected before display.
   * When off, output should be displayed immediately.
   *
   * @param mode - True for buffered, false for unbuffered
   */
  setBufferMode(mode: boolean): void;

  /**
   * Get the current buffering mode.
   *
   * @returns True if buffering is enabled
   */
  getBufferMode(): boolean;
}

// ============================================================================
// Color Support (V5+)
// ============================================================================

/**
 * Color interface for V5+ games.
 *
 * Color codes:
 * - 0: Current color (no change)
 * - 1: Default color
 * - 2: Black
 * - 3: Red
 * - 4: Green
 * - 5: Yellow
 * - 6: Blue
 * - 7: Magenta
 * - 8: Cyan
 * - 9: White
 * - 10-255: Implementation-defined (V6+ true color)
 *
 * @see Z-Machine Spec §8.3.1 (Colours)
 */
export interface IOAdapterColor {
  /**
   * Set the foreground (text) color.
   *
   * @param color - Color code (see interface documentation)
   */
  setForegroundColor(color: number): void;

  /**
   * Set the background color.
   *
   * @param color - Color code (see interface documentation)
   */
  setBackgroundColor(color: number): void;
}

// ============================================================================
// Sound Effects (V3+)
// ============================================================================

/**
 * Sound effect interface.
 *
 * @see Z-Machine Spec §9 (Sound Effects)
 */
export interface IOAdapterSound {
  /**
   * Play, stop, or control a sound effect.
   *
   * Sound numbers:
   * - 1: High-pitched beep
   * - 2: Low-pitched beep
   * - 3+: Game-specific sounds from BLORB or file
   *
   * Effect codes:
   * - 1: Prepare (load sound)
   * - 2: Play sound
   * - 3: Stop sound
   * - 4: Finish (cleanup)
   *
   * @param number - Sound number
   * @param effect - Effect code
   * @param volume - Volume (1-8) and repeat count (high byte)
   */
  soundEffect(number: number, effect: number, volume: number): void;
}

// ============================================================================
// Save/Restore
// ============================================================================

/**
 * Save and restore game state interface.
 *
 * @see Z-Machine Spec §5.5 (Save and Restore)
 */
export interface IOAdapterSave {
  /**
   * Save game state to persistent storage.
   *
   * Implementations may:
   * - Show a file save dialog
   * - Use browser localStorage/IndexedDB
   * - Write to a file system
   *
   * @param data - The serialized game state (Quetzal format)
   * @returns Promise resolving to true if save succeeded
   */
  save(data: Uint8Array): Promise<boolean>;

  /**
   * Restore game state from persistent storage.
   *
   * Implementations may:
   * - Show a file open dialog
   * - Read from browser storage
   * - Read from a file system
   *
   * @returns Promise resolving to the save data, or null if cancelled/failed
   */
  restore(): Promise<Uint8Array | null>;
}

// ============================================================================
// Cursor Control (V4+/V6+)
// ============================================================================

/**
 * Advanced cursor control interface.
 *
 * @see Z-Machine Spec §8.7.1 (Cursor)
 */
export interface IOAdapterCursor {
  /**
   * Set the cursor position in the current window.
   *
   * Coordinates are 1-based. Line 1 is the top of the window.
   *
   * @param line - Line number (1-based)
   * @param column - Column number (1-based)
   */
  setCursor(line: number, column: number): void;

  /**
   * Get the current cursor position.
   *
   * Required for V6+.
   *
   * @returns Current cursor position (1-based)
   */
  getCursor(): CursorPosition;

  /**
   * Erase from the cursor to the end of the current line.
   */
  eraseLine(): void;
}

// ============================================================================
// Stream Management
// ============================================================================

/**
 * I/O stream management interface.
 *
 * Z-machine output streams:
 * - Stream 1: Screen (main display)
 * - Stream 2: Transcript (game log)
 * - Stream 3: Memory table (for encoding)
 * - Stream 4: Player input script
 *
 * Input streams:
 * - Stream 0: Keyboard
 * - Stream 1: File (playback script)
 *
 * @see Z-Machine Spec §7 (Streams)
 */
export interface IOAdapterStreams {
  /**
   * Enable or disable an output stream.
   *
   * @param stream - Stream number (1-4)
   * @param enable - True to enable, false to disable
   * @param table - For stream 3, the memory address to write to
   */
  setOutputStream(stream: number, enable: boolean, table?: number): void;

  /**
   * Select the active input stream.
   *
   * @param stream - Stream number (0 = keyboard, 1 = file)
   */
  setInputStream(stream: number): void;
}

// ============================================================================
// Status Line (V3)
// ============================================================================

/**
 * Status line interface for V3 games.
 *
 * V3 games use a dedicated status line at the top of the screen,
 * showing location, score, and turns (or time).
 *
 * @see Z-Machine Spec §8.2.2 (Status Line)
 */
export interface IOAdapterStatus {
  /**
   * Update the status line display.
   *
   * @param location - Current location name (from object short name)
   * @param score - Current score (or hours if time-based)
   * @param turns - Number of turns (or minutes if time-based)
   * @param isTime - True if displaying time instead of score/turns
   */
  showStatusLine(location: string, score: number, turns: number, isTime: boolean): void;
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Game verification interface.
 */
export interface IOAdapterVerify {
  /**
   * Called to verify the game file checksum.
   *
   * Most implementations can simply return true, as the Memory class
   * handles actual verification.
   *
   * @returns True if verification passed
   */
  verify(): boolean;
}

// ============================================================================
// Combined Interface
// ============================================================================

/**
 * Complete I/O adapter interface combining all capabilities.
 *
 * The core methods are required; all others are optional.
 * Implementations should provide optional methods based on the
 * Z-machine version and platform capabilities.
 *
 * @example
 * ```typescript
 * class MyAdapter implements IOAdapter {
 *   // Must implement IOAdapterCore methods
 *   initialize(version: ZVersion): void { ... }
 *   print(text: string): void { ... }
 *   // ... other required methods
 *
 *   // Optional: implement windowing for V3+
 *   setWindow(window: number): void { ... }
 *   splitWindow(lines: number): void { ... }
 * }
 * ```
 */
export interface IOAdapter
  extends
    IOAdapterCore,
    Partial<IOAdapterWindowed>,
    Partial<IOAdapterStyled>,
    Partial<IOAdapterColor>,
    Partial<IOAdapterSound>,
    Partial<IOAdapterSave>,
    Partial<IOAdapterCursor>,
    Partial<IOAdapterStreams>,
    Partial<IOAdapterStatus>,
    Partial<IOAdapterVerify> {}
