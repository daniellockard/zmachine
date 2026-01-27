import { describe, it, expect } from 'vitest';
import {
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

describe('ZMachineError', () => {
  describe('base error class', () => {
    it('should create a basic error', () => {
      const error = new ZMachineError('test error');
      expect(error.message).toBe('test error');
      expect(error.name).toBe('ZMachineError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ZMachineError);
    });
  });

  describe('MemoryError', () => {
    it('should format address in message', () => {
      const error = new MemoryError('Read failed', 0x1234);
      expect(error.message).toBe('Read failed at address 0x1234');
      expect(error.name).toBe('MemoryError');
      expect(error.address).toBe(0x1234);
      expect(error).toBeInstanceOf(ZMachineError);
    });

    it('should pad short addresses', () => {
      const error = new MemoryError('Access error', 0x12);
      expect(error.message).toBe('Access error at address 0x0012');
    });
  });

  describe('OpcodeError', () => {
    it('should format opcode and address in message', () => {
      const error = new OpcodeError('Unsupported', 'test_op', 0xabcd);
      expect(error.message).toBe('Unsupported (opcode: test_op at 0xABCD)');
      expect(error.name).toBe('OpcodeError');
      expect(error.opcode).toBe('test_op');
      expect(error.address).toBe(0xabcd);
      expect(error).toBeInstanceOf(ZMachineError);
    });
  });

  describe('DecodeError', () => {
    it('should format address and byte in message', () => {
      const error = new DecodeError('Invalid instruction', 0x1000, 0xbe);
      expect(error.message).toBe('Invalid instruction at 0x1000 (byte: 0xBE)');
      expect(error.name).toBe('DecodeError');
      expect(error.address).toBe(0x1000);
      expect(error.opcodeByte).toBe(0xbe);
      expect(error).toBeInstanceOf(ZMachineError);
    });

    it('should pad short addresses', () => {
      const error = new DecodeError('Decode failed', 0x5, 0x1);
      expect(error.message).toBe('Decode failed at 0x0005 (byte: 0x01)');
    });
  });

  describe('StackError', () => {
    it('should create stack error', () => {
      const error = new StackError('Stack underflow');
      expect(error.message).toBe('Stack underflow');
      expect(error.name).toBe('StackError');
      expect(error).toBeInstanceOf(ZMachineError);
    });
  });

  describe('ObjectError', () => {
    it('should format object number in message', () => {
      const error = new ObjectError('Invalid object', 42);
      expect(error.message).toBe('Invalid object (object: 42)');
      expect(error.name).toBe('ObjectError');
      expect(error.objectNumber).toBe(42);
      expect(error).toBeInstanceOf(ZMachineError);
    });
  });

  describe('SaveError', () => {
    it('should create save error', () => {
      const error = new SaveError('Save failed');
      expect(error.message).toBe('Save failed');
      expect(error.name).toBe('SaveError');
      expect(error).toBeInstanceOf(ZMachineError);
    });
  });

  describe('IOError', () => {
    it('should create IO error', () => {
      const error = new IOError('Input timeout');
      expect(error.message).toBe('Input timeout');
      expect(error.name).toBe('IOError');
      expect(error).toBeInstanceOf(ZMachineError);
    });
  });

  describe('VariableError', () => {
    it('should format variable number in message', () => {
      const error = new VariableError('Invalid variable number', 256);
      expect(error.message).toBe('Invalid variable number (variable: 256)');
      expect(error.name).toBe('VariableError');
      expect(error.variableNumber).toBe(256);
      expect(error).toBeInstanceOf(ZMachineError);
    });

    it('should handle negative variable numbers', () => {
      const error = new VariableError('Invalid variable number', -1);
      expect(error.message).toBe('Invalid variable number (variable: -1)');
      expect(error.variableNumber).toBe(-1);
    });
  });

  describe('DictionaryError', () => {
    it('should create dictionary error', () => {
      const error = new DictionaryError('Word not found');
      expect(error.message).toBe('Word not found');
      expect(error.name).toBe('DictionaryError');
      expect(error).toBeInstanceOf(ZMachineError);
    });
  });
});

describe('formatting helpers', () => {
  describe('formatAddress', () => {
    it('should format addresses with padding', () => {
      expect(formatAddress(0x0)).toBe('0x0000');
      expect(formatAddress(0x12)).toBe('0x0012');
      expect(formatAddress(0x1234)).toBe('0x1234');
      expect(formatAddress(0xabcd)).toBe('0xABCD');
    });
  });

  describe('formatByte', () => {
    it('should format bytes with padding', () => {
      expect(formatByte(0x0)).toBe('0x00');
      expect(formatByte(0x5)).toBe('0x05');
      expect(formatByte(0xff)).toBe('0xFF');
    });

    it('should mask to byte', () => {
      expect(formatByte(0x1234)).toBe('0x34');
    });
  });

  describe('formatWord', () => {
    it('should format words with padding', () => {
      expect(formatWord(0x0)).toBe('0x0000');
      expect(formatWord(0x12)).toBe('0x0012');
      expect(formatWord(0xabcd)).toBe('0xABCD');
    });

    it('should mask to word', () => {
      expect(formatWord(0x12345678)).toBe('0x5678');
    });
  });
});
