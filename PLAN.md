# Z-Machine Emulator Implementation Plan

A TypeScript Z-machine interpreter supporting V1-V5 games, with a clean I/O abstraction for web UI. The core emulator is dependency-free; dev tooling uses npm.

**Current Status:** ✅ 483 tests passing, 102 opcode handlers implemented, all V1-V5 games supported

## Architecture Overview

```
src/
├── core/                      # Zero-dependency Z-machine core
│   ├── memory/
│   │   ├── Memory.ts          # Memory map implementation
│   │   ├── Header.ts          # Header parsing ($00-$40)
│   │   └── AddressUtils.ts    # Byte/word/packed address conversion
│   │
│   ├── stack/
│   │   ├── Stack.ts           # Call stack and evaluation stack
│   │   └── StackFrame.ts      # Routine call frame structure
│   │
│   ├── execution/
│   │   ├── Executor.ts        # Opcode execution (102 handlers)
│   │   └── Variables.ts       # Global/local variable access
│   │
│   ├── instructions/
│   │   ├── Decoder.ts         # Instruction fetch and decode
│   │   ├── Opcodes.ts         # Opcode definitions table
│   │   └── InstructionTypes.ts
│   │
│   ├── text/
│   │   ├── ZCharDecoder.ts    # Z-character to ZSCII conversion
│   │   ├── ZCharEncoder.ts    # ZSCII to Z-character (for dictionary)
│   │   ├── Alphabet.ts        # Alphabet tables A0/A1/A2
│   │   └── Abbreviations.ts   # Abbreviation table handling
│   │
│   ├── objects/
│   │   ├── ObjectTable.ts     # Object tree navigation (V1-V3 and V4+)
│   │   └── Attributes.ts      # Attribute get/set/clear
│   │
│   ├── dictionary/
│   │   ├── Dictionary.ts      # Dictionary lookup
│   │   └── Tokenizer.ts       # Input tokenization
│   │
│   ├── state/
│   │   ├── Quetzal.ts         # Quetzal save format
│   │   └── SaveRestore.ts     # Save/restore/undo state
│   │
│   └── ZMachine.ts            # Main VM class
│
├── io/
│   └── IOAdapter.ts           # Interface for platform-specific I/O
│
├── web/                       # Browser-specific implementation
│   ├── index.html             # Main HTML page
│   ├── main.ts                # Entry point
│   ├── WebIOAdapter.ts        # DOM-based I/O adapter
│   ├── ZMachineRunner.ts      # Game runner
│   └── public/
│       └── styles.css         # Retro terminal styling
│
├── types/
│   └── ZMachineTypes.ts       # Core type definitions
│
└── index.ts                   # Public API exports
```

## Implementation Status

### Core Engine ✅ Complete
- [x] Memory module with byte/word access
- [x] Header parsing (V1-V8 support)
- [x] Address utilities (byte/word/packed)
- [x] Instruction decoder (4 forms: 0OP, 1OP, 2OP, VAR, EXT)
- [x] Opcode lookup tables (102 opcodes)
- [x] Stack and call frames
- [x] Variable access (globals/locals/stack)

### Opcodes ✅ 102 Handlers
- [x] Arithmetic: add, sub, mul, div, mod, log_shift, art_shift
- [x] Logic: and, or, not, test
- [x] Comparison: je, jl, jg, jz, jin, test_attr
- [x] Control: jump, call_*, ret, rtrue, rfalse, throw, catch
- [x] Variables: store, load, inc, dec, push, pull, inc_chk, dec_chk
- [x] Memory: loadw, loadb, storew, storeb, copy_table, scan_table
- [x] Objects: get_parent, get_child, get_sibling, insert_obj, remove_obj, etc.
- [x] Properties: get_prop, put_prop, get_prop_addr, get_prop_len, get_next_prop
- [x] Text: print, print_char, print_num, print_addr, print_paddr, print_obj, etc.
- [x] Input: sread/aread (V1-V5), read_char, tokenise
- [x] Screen: split_window, set_window, erase_window, set_cursor, get_cursor
- [x] Style: set_text_style, set_colour, set_font, buffer_mode
- [x] Streams: output_stream, input_stream
- [x] Sound: sound_effect
- [x] Misc: random, restart, quit, verify, piracy, check_arg_count

### Text System ✅ Complete
- [x] Z-character decoding (shift lock, abbreviations)
- [x] Alphabet tables (A0/A1/A2, custom alphabets V5+)
- [x] Abbreviation expansion
- [x] ZSCII to Unicode (including extra characters table)
- [x] Text encoding for dictionary lookup

### Objects & Dictionary ✅ Complete
- [x] V1-V3 object table (255 objects, 32 attributes)
- [x] V4+ object table (65535 objects, 48 attributes)
- [x] Property access (short and long properties)
- [x] Dictionary lookup
- [x] Input tokenization

### I/O & Web UI ✅ Complete
- [x] I/O adapter interface
- [x] All print opcodes
- [x] Read opcodes (async input)
- [x] Web terminal UI with retro CRT aesthetic
- [x] Drag-and-drop file loading
- [x] Command history (up/down arrows)
- [x] Status line display

### Game State ✅ Complete
- [x] Save/restore with Quetzal format
- [x] Quetzal chunks: IFhd, UMem, Stks
- [x] Undo support (save_undo/restore_undo)
- [x] Browser localStorage backup

## Z-Machine Version Support

| Version | Status | Notes |
|---------|--------|-------|
| V1 | ✅ Working | Historic, rare |
| V2 | ✅ Working | Historic, rare |
| V3 | ✅ Complete | Zork I-III, Hitchhiker's Guide |
| V4 | ✅ Working | Transitional |
| V5 | ✅ Complete | Sherlock, most modern games |
| V7 | ✅ Working | Large games |
| V8 | ✅ Working | Large address space |
| V6 | ❌ Skipped | Requires graphics (4 games) |

## Future Enhancements

### Tier 1 - Quality of Life
- [ ] Timed input support (readLine/readChar timeouts)
- [ ] Transcript download feature
- [ ] Help menu with keyboard shortcuts

### Tier 2 - Advanced Features
- [ ] Sound effects playback
- [ ] Input recording/playback
- [ ] Mobile-friendly touch interface

### Tier 3 - V6 Support (Low Priority)
- [ ] Picture display opcodes
- [ ] Mouse input
- [ ] Multiple windows

## Key Technical Decisions

1. **Big-endian handling**: Use `DataView` with explicit endianness
2. **Async input**: Promise-based pattern for `read` opcodes
3. **Testing**: Unit tests per module, integration tests with real game files
4. **No runtime dependencies**: Core emulator is pure TypeScript
5. **Version-aware decoding**: Opcodes adapt to Z-machine version

## Resources

- [Z-Machine Specification v1.1](https://www.inform-fiction.org/zmachine/standards/z1point1/)
- [Quetzal Save Format](http://inform-fiction.org/zmachine/standards/quetzal/)
- [IF Archive (test files)](https://ifarchive.org/)
