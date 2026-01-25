/**
 * Z-Machine Emulator
 * 
 * A TypeScript implementation of the Z-machine virtual machine
 * for running Infocom-style text adventure games.
 * 
 * @example
 * ```typescript
 * import { ZMachine, IOAdapter } from 'zmachine';
 * 
 * class MyIOAdapter implements IOAdapter {
 *   // ... implement I/O methods
 * }
 * 
 * const io = new MyIOAdapter();
 * const response = await fetch('zork1.z3');
 * const storyData = await response.arrayBuffer();
 * 
 * const zm = ZMachine.load(storyData, io);
 * await zm.run();
 * ```
 * 
 * @module
 */

// Main VM class
export { ZMachine, RunState } from './core/ZMachine';

// I/O interfaces
export { IOAdapter, WindowProps } from './io/IOAdapter';
export { TestIOAdapter } from './io/TestIOAdapter';

// Core types
export {
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

// Memory access (for debugging/tools)
export { Memory } from './core/memory/Memory';
export { Header } from './core/memory/Header';
export {
  unpackStringAddress,
  unpackRoutineAddress,
  toSigned16,
  toUnsigned16,
} from './core/memory/AddressUtils';

// Text system (for tools)
export { ZCharDecoder } from './core/text/ZCharDecoder';
export { encodeText, encodeToZChars } from './core/text/ZCharEncoder';
export { zsciiToUnicode, unicodeToZscii } from './core/text/ZSCII';

// Objects and properties (for debugging)
export { ObjectTable } from './core/objects/ObjectTable';
export { Properties, PropertyInfo } from './core/objects/Properties';

// Dictionary (for tools)
export { Dictionary, DictionaryEntry } from './core/dictionary/Dictionary';
export { Tokenizer, Token } from './core/dictionary/Tokenizer';

// Web adapter (for browser usage)
export { WebIOAdapter, WebIOConfig } from './web/WebIOAdapter';
export { ZMachineRunner, RunnerState, RunnerConfig } from './web/ZMachineRunner';
