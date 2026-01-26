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
  VariableError,
  DictionaryError,
  formatAddress,
  formatByte,
  formatWord,
} from './ZMachineError';
