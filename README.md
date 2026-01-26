# Z-Machine Emulator

A TypeScript implementation of the Z-machine virtual machine for running Infocom-style text adventure games.

[![npm version](https://badge.fury.io/js/@dlockard%2Fzmachine.svg)](https://www.npmjs.com/package/@dlockard/zmachine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🎮 **Runs Classic Infocom Games** - Full support for V1-V5 and V8 games including Zork, Planetfall, Hitchhiker's Guide, and more
- 🚀 **Zero Dependencies** - Pure TypeScript, no runtime dependencies in core
- 🌐 **Universal** - Works in Node.js and browsers
- 📦 **Tree-shakeable** - Import only what you need
- 🔧 **Extensible** - Implement your own I/O adapter for any platform
- ✅ **Well-tested** - 898+ unit tests with 99.79% code coverage
- 💾 **Full Save/Restore** - Quetzal-compatible save format with undo support

## Installation

```bash
npm install zmachine
```

## Quick Start

### Node.js

```typescript
import { ZMachine, IOAdapter } from 'zmachine';
import { readFileSync } from 'fs';

// Implement your I/O adapter
class ConsoleIO implements IOAdapter {
  print(text: string) { process.stdout.write(text); }
  newLine() { console.log(); }
  // ... implement other methods
}

// Load and run a story
const storyData = readFileSync('zork1.z3');
const io = new ConsoleIO();
const zm = ZMachine.load(storyData, io);

await zm.run();
```

### Browser

```typescript
import { ZMachine } from 'zmachine';
import { WebIOAdapter } from 'zmachine/web';

// Set up DOM elements
const output = document.getElementById('output');
const input = document.getElementById('input');
const status = document.getElementById('status');

// Create I/O adapter
const io = new WebIOAdapter({
  outputElement: output,
  inputElement: input,
  statusElement: status,
});

// Load story file
const response = await fetch('zork1.z3');
const storyData = await response.arrayBuffer();

// Create and run machine
const zm = ZMachine.load(storyData, io);
io.initialize(zm.version);
await zm.run();
```

## Web Demo

Run the included web UI for playing games in your browser:

```bash
npm run dev:web
```

Then open http://localhost:5173 and drag-and-drop a story file.

## Supported Versions

| Version | Support | Notes |
|---------|---------|-------|
| V1 | ✅ Full | Early Zork prototypes |
| V2 | ✅ Full | Early Infocom games |
| V3 | ✅ Full | Zork I-III, Planetfall, Hitchhiker's, Enchanter, etc. |
| V4 | ✅ Full | A Mind Forever Voyaging, Trinity, Bureaucracy |
| V5 | ✅ Full | Beyond Zork, Sherlock, most Inform games |
| V6 | ❌ Not Supported | Requires graphics/mouse (Shogun, Zork Zero, Arthur) |
| V7 | ✅ Full | Large V5 variant |
| V8 | ✅ Full | Large V5 variant, most modern Inform games |

## Supported Features

### ✅ Fully Implemented

| Category | Features |
|----------|----------|
| **Text Output** | print, print_ret, new_line, print_char, print_num, print_addr, print_paddr, print_obj, print_unicode |
| **Text Input** | read (sread/aread), read_char with timeout support, tokenization |
| **Arithmetic** | add, sub, mul, div, mod, random, log_shift, art_shift |
| **Logic** | and, or, not, test, test_attr |
| **Comparison** | je, jl, jg, jz, jin |
| **Control Flow** | call, call_1n/2n/vn/vs, ret, ret_popped, rtrue, rfalse, jump, piracy |
| **Variables** | load, store, inc, dec, inc_chk, dec_chk, pull, push, loadw, loadb, storew, storeb |
| **Objects** | get_parent, get_child, get_sibling, get_prop, get_prop_addr, get_prop_len, get_next_prop, put_prop, insert_obj, remove_obj, set_attr, clear_attr, test_attr, print_obj |
| **Screen** | split_window, set_window, erase_window, erase_line, set_cursor, get_cursor, set_text_style, set_colour, set_font, buffer_mode |
| **Sound** | sound_effect (beeps only, sounds 1 & 2) |
| **Streams** | output_stream (screen, transcript, memory table), input_stream |
| **Save/Restore** | save, restore (Quetzal format), save_undo, restore_undo |
| **Tables** | copy_table, scan_table, print_table |
| **Misc** | verify, quit, restart, show_status, nop, check_arg_count, catch, throw, tokenise, encode_text, check_unicode |

### ❌ Not Implemented (V6 Graphics)

These features are exclusive to V6 games and require a graphics layer:

- **Picture opcodes**: draw_picture, picture_data, erase_picture, set_margins, picture_table
- **Mouse support**: mouse_window, read_mouse
- **Graphics windows**: move_window, window_size, window_style, scroll_window, set_true_colour (extended)
- **Font metrics**: get_wind_prop, put_wind_prop, make_menu

## I/O Adapter Interface

Implement `IOAdapter` to connect the Z-machine to your platform:

```typescript
interface IOAdapter {
  // Lifecycle
  initialize?(version: number): void;
  
  // Text output
  print(text: string): void;
  printLine?(text: string): void;
  newLine(): void;
  
  // Input (async)
  readLine(maxLength: number, timeout?: number): Promise<ReadLineResult>;
  readChar(timeout?: number): Promise<number>;
  
  // Screen management
  showStatusLine(location: string, score: number, turns: number, isTime: boolean): void;
  splitWindow(lines: number): void;
  setWindow(window: number): void;
  eraseWindow(window: number): void;
  eraseLine?(): void;
  setCursor?(line: number, column: number): void;
  getCursor?(): { line: number; column: number };
  setTextStyle?(style: number): void;
  setForegroundColor?(color: number): void;
  setBackgroundColor?(color: number): void;
  
  // Sound
  soundEffect?(number: number, effect: number, volume: number): void;
  
  // Streams
  setOutputStream?(stream: number, enabled: boolean, table?: number): void;
  
  // Save/restore
  save(data: Uint8Array): Promise<boolean>;
  restore(): Promise<Uint8Array | null>;
  
  // Game control
  quit(): void;
  restart(): void;
}
```

## API Reference

### ZMachine

The main class for running Z-machine games.

```typescript
// Load a story file
const zm = ZMachine.load(storyData: ArrayBuffer, io: IOAdapter);

// Or use constructor directly
const zm = new ZMachine(storyData, io);

// Run until halted or waiting for input
const state = await zm.run();  // Returns RunState

// Access game state
zm.version      // Z-machine version (1-8)
zm.state        // RunState: Stopped, Running, WaitingForInput, Halted
zm.memory       // Direct memory access
zm.header       // Header fields

// Utilities
zm.getObjectName(objectNum)   // Get object's short name
zm.printText(address)         // Decode text at address
zm.lookupWord(word)           // Look up word in dictionary
zm.restart()                  // Restart the game
```

### Memory

Low-level memory access for tools and debugging:

```typescript
const value = zm.memory.readWord(address);   // Read 16-bit word (big-endian)
const byte = zm.memory.readByte(address);    // Read 8-bit byte
zm.memory.writeWord(address, value);         // Write 16-bit word
zm.memory.writeByte(address, value);         // Write 8-bit byte
```

### Text Encoding/Decoding

```typescript
import { ZCharDecoder, ZCharEncoder, ZSCII } from 'zmachine';

// Decode Z-characters to string
const decoder = new ZCharDecoder(memory, version, abbreviationsAddr);
const { text, bytesRead } = decoder.decode(address);

// Encode string to Z-characters (for dictionary lookup)
const encoder = new ZCharEncoder(version);
const encoded = encoder.encode('zork');

// ZSCII character conversion
const unicode = ZSCII.toUnicode(zsciiCode);
const zscii = ZSCII.fromUnicode(unicodeChar);
```

### GameState (Save/Restore)

```typescript
import { GameState, Quetzal } from 'zmachine';

// Create save state
const state = GameState.capture(zmachine);
const quetzalData = Quetzal.write(state, originalStoryData);

// Restore from Quetzal file
const state = Quetzal.read(quetzalData, originalStoryData);
GameState.restore(zmachine, state);
```

## WebIOAdapter Features

The built-in `WebIOAdapter` includes:

- **Text styling**: Bold, italic, fixed-width, reverse video
- **Colors**: All 8 standard Z-machine colors
- **Status line**: Score/moves or time display
- **Sound**: Beep effects via Web Audio API
- **Save/Restore**: File download/upload with localStorage backup
- **Transcript**: Downloadable game transcript
- **Recording**: Record and playback input sessions

```typescript
const io = new WebIOAdapter({
  outputElement: document.getElementById('output'),
  inputElement: document.getElementById('input'),
  statusElement: document.getElementById('status'),
  onQuit: () => console.log('Game ended'),
  onRestart: () => location.reload(),
});

// Enable transcript
io.setOutputStream(2, true);
io.downloadTranscript();

// Record inputs
io.startRecording();
// ... play game ...
io.stopRecording();
io.downloadRecording();

// Playback recorded inputs
io.loadPlayback(['north', 'take lamp', 'light lamp']);
```

## Building

```bash
npm install
npm run build          # Compile TypeScript
npm test               # Run core tests (817 tests)
npm run test:web       # Run web tests (81 tests)
npm run test:all       # Run all tests (898 tests)
npm run test:coverage  # Run with coverage report
npm run lint           # ESLint check
npm run dev:web        # Start web dev server
```

## Project Structure

```
src/
├── core/              # Zero-dependency core
│   ├── cpu/           # Stack and call frames
│   ├── dictionary/    # Word lookup and tokenization
│   ├── execution/     # Opcode execution engine
│   ├── instructions/  # Opcode definitions and decoder
│   ├── memory/        # Memory and header access
│   ├── objects/       # Object tree and properties
│   ├── state/         # Save/restore and Quetzal format
│   ├── text/          # ZSCII and Z-character encoding
│   ├── variables/     # Variable access (locals, globals, stack)
│   └── ZMachine.ts    # Main VM class
├── io/                # I/O adapter interfaces
├── types/             # TypeScript type definitions
├── web/               # Browser-based player
│   ├── WebIOAdapter.ts  # DOM-based I/O implementation
│   └── main.ts        # Web UI entry point
└── index.ts           # Public API exports
```

## Testing with Story Files

Story files (.z3, .z5, .z8, etc.) are copyrighted. Obtain them legally:

- **Commercial**: [GOG.com](https://www.gog.com) sells Infocom collections
- **Free**: [IF Archive](https://ifarchive.org/) has free Inform games
- **Create your own**: Use [Inform 7](http://inform7.com/) to write games

Place story files in a `roms/` folder (gitignored) for integration testing.

## Resources

- [Z-Machine Specification v1.1](https://www.inform-fiction.org/zmachine/standards/z1point1/) - The definitive Z-machine reference
- [Quetzal Save Format](http://inform-fiction.org/zmachine/standards/quetzal/) - Standard save file format
- [IF Archive](https://ifarchive.org/) - Interactive fiction repository
- [Inform 7](http://inform7.com/) - Write your own Z-machine games
- [ZILF](https://foss.heptapod.net/zilf/zilf) - Write games in ZIL (original Infocom language)

## License

MIT © Daniel Lockard
