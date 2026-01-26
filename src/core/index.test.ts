/**
 * Barrel export smoke tests
 * 
 * These tests verify that all index.ts barrel exports are accessible.
 * This improves code coverage for the re-export files.
 */

import { describe, it, expect } from 'vitest';

// CPU module exports
import { StackFrame, Stack } from './cpu';
import type { CallStackSnapshot as _CallStackSnapshot } from './cpu';

// Dictionary module exports
import { Dictionary, Tokenizer } from './dictionary';
import type { DictionaryEntry as _DictionaryEntry, Token as _Token } from './dictionary';

// Execution module exports
import { Executor } from './execution';
import type { OpcodeHandler as _OpcodeHandler, ExecutionState as _ExecutionState } from './execution';

// Instructions module exports
import {
  Decoder,
  get0OPInfo,
  get1OPInfo,
  get2OPInfo,
  getVARInfo,
  getEXTInfo,
  OPCODES_0OP,
  OPCODES_1OP,
  OPCODES_2OP,
  OPCODES_VAR,
  OPCODES_EXT,
} from './instructions';
import type { OpcodeInfo as _OpcodeInfo } from './instructions';

// Memory module exports
import { Memory, Header, HeaderAddress, Flags1V3, Flags2 } from './memory';
import type { HeaderData as _HeaderData } from './memory';

// Objects module exports
import { ObjectTable, Properties } from './objects';
import type { PropertyInfo as _PropertyInfo } from './objects';

// State module exports
import {
  GameState,
  createQuetzalSave,
  parseQuetzalSave,
  verifySaveCompatibility,
  compressMemory,
  decompressMemory,
} from './state';
import type { SaveState as _SaveState, GameIdentification as _GameIdentification } from './state';

// Text module exports
import {
  ZCharDecoder,
  zsciiToUnicode,
  unicodeToZscii,
  isZsciiPrintable,
  isZsciiTerminator,
  ZSCII,
  DEFAULT_UNICODE_TABLE,
  getAlphabetChar,
  getShiftedAlphabet,
  isShiftChar,
  isAbbreviationChar,
  getAbbreviationIndex,
} from './text';
import type { DecodeResult as _DecodeResult } from './text';

// Variables module exports
import { Variables } from './variables';
import type { VariableNumber as _VariableNumber } from './variables';

// IO module exports
import { TestIOAdapter } from '../io';
import type { IOAdapter as _IOAdapter, WindowProps as _WindowProps, ReadLineResult as _ReadLineResult } from '../io';

describe('Barrel exports smoke tests', () => {
  describe('cpu module', () => {
    it('exports StackFrame class', () => {
      expect(StackFrame).toBeDefined();
    });

    it('exports Stack class', () => {
      expect(Stack).toBeDefined();
    });
  });

  describe('dictionary module', () => {
    it('exports Dictionary class', () => {
      expect(Dictionary).toBeDefined();
    });

    it('exports Tokenizer class', () => {
      expect(Tokenizer).toBeDefined();
    });
  });

  describe('execution module', () => {
    it('exports Executor class', () => {
      expect(Executor).toBeDefined();
    });
  });

  describe('instructions module', () => {
    it('exports Decoder class', () => {
      expect(Decoder).toBeDefined();
    });

    it('exports opcode lookup functions', () => {
      expect(get0OPInfo).toBeDefined();
      expect(get1OPInfo).toBeDefined();
      expect(get2OPInfo).toBeDefined();
      expect(getVARInfo).toBeDefined();
      expect(getEXTInfo).toBeDefined();
    });

    it('exports opcode tables', () => {
      expect(OPCODES_0OP).toBeDefined();
      expect(OPCODES_1OP).toBeDefined();
      expect(OPCODES_2OP).toBeDefined();
      expect(OPCODES_VAR).toBeDefined();
      expect(OPCODES_EXT).toBeDefined();
    });
  });

  describe('memory module', () => {
    it('exports Memory class', () => {
      expect(Memory).toBeDefined();
    });

    it('exports Header class', () => {
      expect(Header).toBeDefined();
    });

    it('exports HeaderAddress enum', () => {
      expect(HeaderAddress).toBeDefined();
    });

    it('exports flag enums', () => {
      expect(Flags1V3).toBeDefined();
      expect(Flags2).toBeDefined();
    });
  });

  describe('objects module', () => {
    it('exports ObjectTable class', () => {
      expect(ObjectTable).toBeDefined();
    });

    it('exports Properties class', () => {
      expect(Properties).toBeDefined();
    });
  });

  describe('state module', () => {
    it('exports GameState class', () => {
      expect(GameState).toBeDefined();
    });

    it('exports Quetzal functions', () => {
      expect(createQuetzalSave).toBeDefined();
      expect(parseQuetzalSave).toBeDefined();
      expect(verifySaveCompatibility).toBeDefined();
      expect(compressMemory).toBeDefined();
      expect(decompressMemory).toBeDefined();
    });
  });

  describe('text module', () => {
    it('exports ZCharDecoder class', () => {
      expect(ZCharDecoder).toBeDefined();
    });

    it('exports ZSCII functions', () => {
      expect(zsciiToUnicode).toBeDefined();
      expect(unicodeToZscii).toBeDefined();
      expect(isZsciiPrintable).toBeDefined();
      expect(isZsciiTerminator).toBeDefined();
    });

    it('exports ZSCII constants', () => {
      expect(ZSCII).toBeDefined();
      expect(DEFAULT_UNICODE_TABLE).toBeDefined();
    });

    it('exports alphabet functions', () => {
      expect(getAlphabetChar).toBeDefined();
      expect(getShiftedAlphabet).toBeDefined();
      expect(isShiftChar).toBeDefined();
      expect(isAbbreviationChar).toBeDefined();
      expect(getAbbreviationIndex).toBeDefined();
    });
  });

  describe('variables module', () => {
    it('exports Variables class', () => {
      expect(Variables).toBeDefined();
    });
  });

  describe('io module', () => {
    it('exports TestIOAdapter class', () => {
      expect(TestIOAdapter).toBeDefined();
    });
  });
});
