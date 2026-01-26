/**
 * Error Classes
 *
 * Custom error hierarchy for Z-machine emulator.
 *
 * @module
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
} from './ZMachineError';
