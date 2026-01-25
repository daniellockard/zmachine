# Z-Machine Emulator Implementation Plan

A TypeScript Z-machine interpreter targeting V3 games first (Zork I-III), with a clean I/O abstraction for web UI. The core emulator is dependency-free; dev tooling uses npm.

## Architecture Overview

```
src/
├── core/                      # Zero-dependency Z-machine core
│   ├── memory/
│   │   ├── Memory.ts          # Memory map implementation
│   │   ├── Header.ts          # Header parsing ($00-$40)
│   │   └── AddressUtils.ts    # Byte/word/packed address conversion
│   │
│   ├── cpu/
│   │   ├── CPU.ts             # Main execution loop
│   │   ├── Stack.ts           # Call stack and evaluation stack
│   │   ├── Variables.ts       # Global/local variable access
│   │   └── StackFrame.ts      # Routine call frame structure
│   │
│   ├── instructions/
│   │   ├── Decoder.ts         # Instruction fetch and decode
│   │   ├── Opcodes.ts         # Opcode definitions table
│   │   ├── handlers/
│   │   │   ├── Arithmetic.ts  # add, sub, mul, div, mod, etc.
│   │   │   ├── Branch.ts      # je, jl, jg, jz, jump, etc.
│   │   │   ├── Call.ts        # call_*, ret, rtrue, rfalse
│   │   │   ├── Object.ts      # get_parent, insert_obj, test_attr, etc.
│   │   │   ├── Memory.ts      # loadw, loadb, storew, storeb
│   │   │   ├── IO.ts          # print, read, read_char, etc.
│   │   │   ├── Table.ts       # copy_table, scan_table
│   │   │   └── Misc.ts        # random, restart, quit, etc.
│   │   └── BranchUtils.ts     # Branch offset calculation
│   │
│   ├── text/
│   │   ├── ZCharDecoder.ts    # Z-character to ZSCII conversion
│   │   ├── ZCharEncoder.ts    # ZSCII to Z-character (for dictionary)
│   │   ├── Alphabet.ts        # Alphabet tables A0/A1/A2
│   │   ├── Abbreviations.ts   # Abbreviation table handling
│   │   └── ZSCII.ts           # ZSCII ↔ Unicode mapping
│   │
│   ├── objects/
│   │   ├── ObjectTable.ts     # Object tree navigation
│   │   ├── Properties.ts      # Property access
│   │   └── Attributes.ts      # Attribute get/set/clear
│   │
│   ├── dictionary/
│   │   ├── Dictionary.ts      # Dictionary lookup
│   │   └── Tokenizer.ts       # Input tokenization
│   │
│   ├── state/
│   │   ├── GameState.ts       # Save/restore/undo state
│   │   └── Quetzal.ts         # Quetzal save format
│   │
│   └── ZMachine.ts            # Main VM class, ties everything together
│
├── io/                        # I/O abstraction layer
│   ├── IOAdapter.ts           # Interface for platform-specific I/O
│   ├── OutputStream.ts        # Output stream management (1-4)
│   ├── InputStream.ts         # Input stream management (0-1)
│   └── Screen.ts              # Screen model abstraction
│
├── web/                       # Browser-specific implementation
│   ├── WebScreen.ts           # DOM-based screen renderer
│   ├── WebInput.ts            # Keyboard input handling
│   ├── WebStorage.ts          # IndexedDB save/load
│   └── App.ts                 # Main web application
│
├── types/
│   ├── ZMachineTypes.ts       # Core type definitions
│   └── Instruction.ts         # Instruction type definitions
│
└── index.ts                   # Public API exports
```

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Project setup (TypeScript, Vitest, ESLint)
- [x] Git repository initialized
- [ ] Memory module with byte/word access
- [ ] Header parsing
- [ ] Address utilities

### Phase 2: Instruction Engine
- [ ] Instruction decoder (4 forms)
- [ ] Opcode lookup tables
- [ ] Stack and call frames
- [ ] Variable access (globals/locals)

### Phase 3: Core Opcodes (~40 for V3)
- [ ] Arithmetic: add, sub, mul, div, mod
- [ ] Logic: and, or, not, test
- [ ] Comparison: je, jl, jg, jz
- [ ] Control: jump, call, ret, rtrue, rfalse
- [ ] Variables: store, load, inc, dec, push, pull
- [ ] Memory: loadw, loadb, storew, storeb

### Phase 4: Text System
- [ ] Z-character decoding
- [ ] Alphabet tables
- [ ] Abbreviation expansion
- [ ] ZSCII to Unicode

### Phase 5: Objects & Dictionary
- [ ] Object table navigation
- [ ] Property/attribute access
- [ ] Dictionary lookup
- [ ] Input tokenization

### Phase 6: I/O & Web UI
- [ ] I/O adapter interface
- [ ] Print opcodes
- [ ] Read opcode (async input)
- [ ] Web terminal UI

### Phase 7: Game State
- [x] Save/restore with Quetzal format
- [x] Quetzal format (IFhd, UMem, Stks chunks)
- [x] Undo support (save_undo/restore_undo)

## Z-Machine Version Support

| Version | Priority | Status | Notes |
|---------|----------|--------|-------|
| V3 | 1st | ✅ Complete | Zork I-III, Hitchhiker's Guide |
| V5 | 2nd | ✅ Working | Sherlock, most modern games |
| V8 | 3rd | Untested | Large address space |
| V1, V2 | Skip | N/A | Obsolete |
| V4 | Skip | N/A | Transitional |
| V6 | Last | N/A | Requires graphics |

## Key Technical Decisions

1. **Big-endian handling**: Use `DataView` with explicit endianness
2. **Async input**: Generator/yield pattern for `read` opcode
3. **Testing**: Unit tests per module, Czech test files for integration
4. **No runtime dependencies**: Core emulator is pure TypeScript

## Resources

- [Z-Machine Specification v1.1](https://www.inform-fiction.org/zmachine/standards/z1point1/)
- [Quetzal Save Format](http://inform-fiction.org/zmachine/standards/quetzal/)
- [IF Archive (test files)](https://ifarchive.org/)
