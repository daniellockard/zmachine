/**
 * Z-Machine Emulator
 *
 * A TypeScript implementation of the Z-machine virtual machine
 * for running Infocom-style text adventure games (.z1 through .z8 files).
 *
 * ## Quick Start
 *
 * @example
 * ```typescript
 * import { ZMachine, IOAdapter } from 'zmachine';
 *
 * // Implement your I/O adapter (or use WebIOAdapter for browser)
 * class MyIOAdapter implements IOAdapter {
 *   // ... implement required I/O methods
 * }
 *
 * // Load and run a game
 * const io = new MyIOAdapter();
 * const response = await fetch('zork1.z3');
 * const storyData = await response.arrayBuffer();
 *
 * const zm = ZMachine.load(storyData, io);
 * await zm.run();
 * ```
 *
 * ## Browser Usage
 *
 * @example
 * ```typescript
 * import { ZMachine, WebIOAdapter } from 'zmachine';
 *
 * const container = document.getElementById('game-container')!;
 * const io = new WebIOAdapter({ container });
 *
 * const zm = ZMachine.load(storyData, io);
 * await zm.run();
 * ```
 *
 * ## Key Components
 *
 * - {@link ZMachine} - The main virtual machine class
 * - {@link IOAdapter} - Abstract I/O interface (implement this or use {@link WebIOAdapter})
 * - {@link Memory} - Direct memory access for debugging/tools
 * - {@link ZCharDecoder} - Text decoding utilities
 *
 * @module zmachine
 * @see https://github.com/user/zmachine for documentation
 * @see https://www.inform-fiction.org/zmachine/standards/z1point1/ for Z-Machine spec
 */

// ============================================================================
// Main VM Class
// ============================================================================

/**
 * The core Z-machine virtual machine.
 * @see {@link ZMachine.load} to create an instance from game data
 */
export { ZMachine, RunState } from './core/ZMachine';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error classes for Z-machine operations.
 *
 * All Z-machine errors extend {@link ZMachineError} for easy catching.
 */
export {
  ZMachineError,
  MemoryError,
  OpcodeError,
  DecodeError,
  StackError,
  ObjectError,
  SaveError,
  IOError,
  formatAddress,
  formatByte,
  formatWord,
} from './core/errors';

// ============================================================================
// I/O Interfaces
// ============================================================================

/**
 * I/O adapter interfaces for platform-specific input/output.
 *
 * - {@link IOAdapterCore} - Required methods all adapters must implement
 * - {@link IOAdapterWindowed} - Window management (V3+)
 * - {@link IOAdapterStyled} - Text styling (V4+)
 * - {@link IOAdapterColor} - Color support (V5+)
 * - {@link IOAdapterSave} - Save/restore functionality
 *
 * The combined {@link IOAdapter} type includes all interfaces.
 */
export type {
  IOAdapter,
  IOAdapterCore,
  IOAdapterWindowed,
  IOAdapterStyled,
  IOAdapterColor,
  IOAdapterSound,
  IOAdapterSave,
  IOAdapterCursor,
  IOAdapterStreams,
  IOAdapterStatus,
  IOAdapterVerify,
  WindowProps,
  ReadLineResult,
  CursorPosition,
} from './io/IOAdapter';

/**
 * Test I/O adapter for unit testing games.
 * @see {@link TestIOAdapter} for programmatic game interaction
 */
export { TestIOAdapter } from './io/TestIOAdapter';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Core Z-machine type definitions.
 *
 * Address types:
 * - {@link ByteAddress} - Direct byte offset (0x0000-0xFFFF)
 * - {@link WordAddress} - Word address (multiply by 2)
 * - {@link PackedAddress} - Packed address (multiply by 2, 4, or 8 based on version)
 *
 * Value types:
 * - {@link Word} - Unsigned 16-bit value
 * - {@link SignedWord} - Signed 16-bit value (-32768 to 32767)
 * - {@link Byte} - Unsigned 8-bit value
 */
export type {
  ZVersion,
  ByteAddress,
  WordAddress,
  PackedAddress,
  Word,
  SignedWord,
  Byte,
  VariableNumber,
  ObjectNumber,
  PropertyNumber,
  AttributeNumber,
  OperandType,
  InstructionForm,
  OperandCount,
  Operand,
  DecodedInstruction,
  ExecutionResult,
} from './types/ZMachineTypes';

// ============================================================================
// Memory Access
// ============================================================================

/**
 * Memory access classes for debugging and tooling.
 *
 * @see {@link Memory} for reading/writing game memory
 * @see {@link Header} for game file header information
 */
export { Memory } from './core/memory/Memory';
export { Header } from './core/memory/Header';

/**
 * Address conversion utilities.
 *
 * @see {@link unpackStringAddress} for converting packed string addresses
 * @see {@link unpackRoutineAddress} for converting packed routine addresses
 * @see {@link toSigned16} for unsigned to signed conversion
 */
export {
  unpackStringAddress,
  unpackRoutineAddress,
  toSigned16,
  toUnsigned16,
} from './core/memory/AddressUtils';

// ============================================================================
// Text System
// ============================================================================

/**
 * Text encoding/decoding utilities.
 *
 * @see {@link ZCharDecoder} for decoding Z-character strings
 * @see {@link encodeText} for encoding text to Z-character format
 * @see {@link zsciiToUnicode} for ZSCII to Unicode conversion
 */
export { ZCharDecoder } from './core/text/ZCharDecoder';
export { encodeText, encodeToZChars } from './core/text/ZCharEncoder';
export { zsciiToUnicode, unicodeToZscii } from './core/text/ZSCII';

// ============================================================================
// Object System
// ============================================================================

/**
 * Object tree and property access for debugging.
 *
 * @see {@link ObjectTable} for traversing the object tree
 * @see {@link Properties} for reading object properties
 */
export { ObjectTable } from './core/objects/ObjectTable';
export { Properties } from './core/objects/Properties';
export type { PropertyInfo } from './core/objects/Properties';

// ============================================================================
// Dictionary
// ============================================================================

/**
 * Dictionary and tokenization utilities.
 *
 * @see {@link Dictionary} for looking up words in the game dictionary
 * @see {@link Tokenizer} for parsing player input
 */
export { Dictionary } from './core/dictionary/Dictionary';
export type { DictionaryEntry } from './core/dictionary/Dictionary';
export { Tokenizer } from './core/dictionary/Tokenizer';
export type { Token } from './core/dictionary/Tokenizer';

// ============================================================================
// Web Adapter
// ============================================================================

/**
 * Browser-based I/O adapter for web applications.
 *
 * @see {@link WebIOAdapter} for DOM-based game rendering
 * @see {@link WebIOConfig} for configuration options
 */
export { WebIOAdapter } from './web/WebIOAdapter';
export type { WebIOConfig } from './web/WebIOAdapter';
