<div align="center">

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ███████╗      ███╗   ███╗ █████╗  ██████╗██╗  ██╗██╗███╗   ██╗███████╗  ║
║   ╚══███╔╝      ████╗ ████║██╔══██╗██╔════╝██║  ██║██║████╗  ██║██╔════╝  ║
║     ███╔╝ █████╗██╔████╔██║███████║██║     ███████║██║██╔██╗ ██║█████╗    ║
║    ███╔╝  ╚════╝██║╚██╔╝██║██╔══██║██║     ██╔══██║██║██║╚██╗██║██╔══╝    ║
║   ███████╗      ██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║██║██║ ╚████║███████╗  ║
║   ╚══════╝      ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝  ║
║                                                                           ║
║          ⚡ A Modern TypeScript Z-Machine Emulator ⚡                    ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Run classic Infocom text adventures in Node.js or the browser

<br/>

[![npm version](https://img.shields.io/npm/v/zmachine?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/zmachine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success?style=for-the-badge&logo=checkmarx&logoColor=white)](package.json)

[![Tests](https://img.shields.io/badge/Tests-898+-success?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Coverage](https://img.shields.io/badge/Coverage-99.79%25-brightgreen?style=flat-square&logo=codecov&logoColor=white)](coverage/index.html)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Browser](https://img.shields.io/badge/Browser-Ready-blue?style=flat-square&logo=googlechrome&logoColor=white)](#browser)

---

**[📖 Documentation](#api-reference)** · **[🚀 Quick Start](#quick-start)** · **[🎮 Live Demo](https://daniellockard.github.io/zmachine/)** · **[📦 npm](https://www.npmjs.com/package/zmachine)**

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [🎮 Web Demo](#-web-demo)
- [📊 Supported Versions](#-supported-versions)
- [🔧 I/O Adapter Interface](#-io-adapter-interface)
- [📖 API Reference](#-api-reference)
- [🏗️ Building](#️-building)
- [🧪 Testing](#-testing)
- [📚 Resources](#-resources)
- [📄 License](#-license)

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎮 Classic Gaming
Run legendary Infocom titles: **Zork**, **Planetfall**, **Hitchhiker's Guide**, **Enchanter**, and 100+ more games from the golden age of interactive fiction.

### 🚀 Zero Dependencies
Pure TypeScript with **no runtime dependencies** in the core engine. Just clean, modern JavaScript.

### 🌐 Universal Platform
Works seamlessly in **Node.js** and all **modern browsers**. One codebase, everywhere.

</td>
<td width="50%">

### 📦 Tree-Shakeable
Import only what you need. The core engine is modular and optimized for minimal bundle size.

### 🔧 Extensible Architecture
Implement your own `IOAdapter` to connect the Z-machine to any platform—terminals, GUIs, bots, or embedded systems.

### ✅ Battle-Tested
**898+ unit tests** with **99.79% code coverage**. Quetzal-compatible save format with full undo support.

</td>
</tr>
</table>

---

## 📦 Installation

```bash
npm install zmachine
```

<details>
<summary>📋 <b>Also available via yarn, pnpm, or bun</b></summary>

```bash
yarn add zmachine
pnpm add zmachine
bun add zmachine
```

</details>

---

## 🚀 Quick Start

### 💻 Node.js

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

### 🌐 Browser

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

---

## 🎮 Web Demo

<div align="center">

### 🌐 [**Try it live!** → daniellockard.github.io/zmachine](https://daniellockard.github.io/zmachine/)

> 🕹️ Play classic text adventures directly in your browser — no installation required!

</div>

Or run locally:

```bash
npm run dev:web
```

Then open **http://localhost:8080** and drag-and-drop a story file to start playing!

<details>
<summary>🖼️ <b>Screenshot Preview</b></summary>

<br/>

The web demo features a retro terminal aesthetic with:
- 📟 Classic green-on-black CRT styling
- ⌨️ Full keyboard input support
- 💾 Save/restore game state
- 📜 Transcript recording
- 🎨 Z-machine text styling (bold, italic, colors)

</details>

---

## 📊 Supported Versions

<div align="center">

| Version | Status | Era | Notable Games |
|:-------:|:------:|:---:|:-------------|
| **V1** | ✅ Full | 1980 | Early Zork prototypes |
| **V2** | ✅ Full | 1981 | Early Infocom games |
| **V3** | ✅ Full | 1982-1987 | Zork I-III, Planetfall, Hitchhiker's, Enchanter trilogy |
| **V4** | ✅ Full | 1985-1988 | A Mind Forever Voyaging, Trinity, Bureaucracy |
| **V5** | ✅ Full | 1987+ | Beyond Zork, Sherlock, most Inform games |
| **V6** | ⚠️ Partial | 1988+ | Graphics games (Shogun, Zork Zero, Arthur) |
| **V7** | ✅ Full | — | Large V5 variant |
| **V8** | ✅ Full | — | Large V5 variant, modern Inform games |

</div>

> **Note:** V6 games require graphics/mouse support which is not implemented. Text-only features work.

<details>
<summary>📜 <b>Full Feature Support Matrix</b></summary>

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

</details>

---

## 🔧 I/O Adapter Interface

Implement the `IOAdapter` interface to connect the Z-machine to your platform:

<details>
<summary>📋 <b>View Full Interface Definition</b></summary>

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

</details>

---

## 📖 API Reference

### 🖥️ ZMachine

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

<details>
<summary>💾 <b>Memory Access</b></summary>

Low-level memory access for tools and debugging:

```typescript
const value = zm.memory.readWord(address);   // Read 16-bit word (big-endian)
const byte = zm.memory.readByte(address);    // Read 8-bit byte
zm.memory.writeWord(address, value);         // Write 16-bit word
zm.memory.writeByte(address, value);         // Write 8-bit byte
```

</details>

<details>
<summary>📝 <b>Text Encoding/Decoding</b></summary>

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

</details>

<details>
<summary>💽 <b>GameState (Save/Restore)</b></summary>

```typescript
import { GameState, Quetzal } from 'zmachine';

// Create save state
const state = GameState.capture(zmachine);
const quetzalData = Quetzal.write(state, originalStoryData);

// Restore from Quetzal file
const state = Quetzal.read(quetzalData, originalStoryData);
GameState.restore(zmachine, state);
```

</details>

<details>
<summary>🌐 <b>WebIOAdapter Features</b></summary>

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

</details>

---

## 🏗️ Building

```bash
npm install
npm run build          # Compile TypeScript
npm run build:web      # Build web player
npm run build:lib      # Build npm library
npm run dev:web        # Start web dev server
```

---

## 🧪 Testing

<div align="center">

| Command | Description | Tests |
|---------|-------------|-------|
| `npm test` | Core tests | 817 |
| `npm run test:web` | Web tests | 81 |
| `npm run test:all` | All tests | 898+ |
| `npm run test:coverage` | With coverage | 99.79% |

</div>

```bash
npm test               # Run core tests
npm run test:watch     # Watch mode
npm run test:coverage  # Generate coverage report
npm run lint           # ESLint check
```

---

## 📁 Project Structure

```
src/
├── core/              # 🎯 Zero-dependency core
│   ├── cpu/           #    Stack and call frames
│   ├── dictionary/    #    Word lookup and tokenization
│   ├── execution/     #    Opcode execution engine (102 handlers)
│   ├── instructions/  #    Opcode definitions and decoder
│   ├── memory/        #    Memory and header access
│   ├── objects/       #    Object tree and properties
│   ├── state/         #    Save/restore and Quetzal format
│   ├── text/          #    ZSCII and Z-character encoding
│   ├── variables/     #    Variable access (locals, globals, stack)
│   └── ZMachine.ts    #    Main VM class
├── io/                # 🔌 I/O adapter interfaces
├── types/             # 📝 TypeScript type definitions
├── web/               # 🌐 Browser-based player
│   ├── WebIOAdapter.ts
│   └── main.ts
└── index.ts           # 📦 Public API exports
```

---

## 🎲 Finding Story Files

Story files (`.z3`, `.z5`, `.z8`, etc.) are copyrighted. Here's where to get them legally:

| Source | Type | Description |
|--------|------|-------------|
| 🛒 [GOG.com](https://www.gog.com) | Commercial | Infocom collections for sale |
| 📚 [IF Archive](https://ifarchive.org/) | Free | Thousands of free Inform games |
| ✍️ [Inform 7](http://inform7.com/) | Create | Write your own Z-machine games |
| 🔧 [ZILF](https://foss.heptapod.net/zilf/zilf) | Create | Write games in ZIL (original Infocom language) |

> **Tip:** Place story files in a `roms/` folder (gitignored) for integration testing.

---

## 📚 Resources

<table>
<tr>
<td>

**📖 Specifications**
- [Z-Machine Specification v1.1](https://www.inform-fiction.org/zmachine/standards/z1point1/) — The definitive reference
- [Quetzal Save Format](http://inform-fiction.org/zmachine/standards/quetzal/) — Standard save format

</td>
<td>

**🎮 Interactive Fiction**
- [IF Archive](https://ifarchive.org/) — Massive IF repository
- [IFDB](https://ifdb.org/) — Interactive Fiction Database
- [r/interactivefiction](https://reddit.com/r/interactivefiction) — Reddit community

</td>
</tr>
</table>

---

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/dlockard/zmachine.git
cd zmachine
npm install
npm test
```

---

## 📄 License

<div align="center">

MIT © [Daniel Lockard](https://github.com/dlockard)

---

<sub>

Made with ☕ and a love for classic interactive fiction.

**[⬆ Back to top](#)**

</sub>

</div>
