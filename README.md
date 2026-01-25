# Z-Machine Emulator

A TypeScript implementation of the Z-machine virtual machine for running Infocom-style text adventure games.

[![npm version](https://badge.fury.io/js/@dlockard%2Fzmachine.svg)](https://www.npmjs.com/package/@dlockard/zmachine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🎮 **Runs Zork** - Full V3 support for classic Infocom games
- 🚀 **Zero Dependencies** - Pure TypeScript, no runtime dependencies in core
- 🌐 **Universal** - Works in Node.js and browsers
- 📦 **Tree-shakeable** - Import only what you need
- 🔧 **Extensible** - Implement your own I/O adapter for any platform
- ✅ **Well-tested** - 380+ unit tests

## Installation

```bash
npm install @dlockard/zmachine
```

## Quick Start

### Node.js

```typescript
import { ZMachine, IOAdapter } from '@dlockard/zmachine';
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
import { ZMachine, WebIOAdapter } from '@dlockard/zmachine';

// Set up DOM elements
const output = document.getElementById('output');
const input = document.getElementById('input');

// Create I/O adapter
const io = new WebIOAdapter({
  outputElement: output,
  inputElement: input,
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

Then open http://localhost:8080 and drag-and-drop a .z3 story file.

## I/O Adapter Interface

Implement `IOAdapter` to connect the Z-machine to your platform:

```typescript
interface IOAdapter {
  // Text output
  print(text: string): void;
  newLine(): void;
  
  // Input (async)
  readLine(maxLength: number, timeout?: number): Promise<ReadLineResult>;
  readChar(timeout?: number): Promise<number>;
  
  // Screen
  showStatusLine(location: string, score: number, turns: number, isTime: boolean): void;
  splitWindow(lines: number): void;
  setWindow(window: number): void;
  eraseWindow(window: number): void;
  
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

// Run until halted or waiting for input
await zm.run();

// Access game state
zm.version      // Z-machine version (1-8)
zm.state        // RunState: 'stopped' | 'running' | 'waiting' | 'halted'
zm.memory       // Direct memory access
zm.header       // Header fields

// Utilities
zm.getObjectName(objectNum)   // Get object's short name
zm.printText(address)         // Decode text at address
zm.lookupWord(word)           // Look up word in dictionary
```

### Memory

Low-level memory access for tools and debugging:

```typescript
const value = zm.memory.readWord(address);   // Read 16-bit word
zm.memory.writeByte(address, value);         // Write 8-bit byte
```

### Text Encoding/Decoding

```typescript
import { ZCharDecoder, encodeText, zsciiToUnicode } from '@dlockard/zmachine';

// Decode Z-characters to string
const decoder = new ZCharDecoder(memory, version, abbreviationsAddr);
const { text, bytesRead } = decoder.decode(address);

// Encode string to Z-characters (for dictionary lookup)
const encoded = encodeText('zork', version);
```

## Supported Versions

| Version | Support | Notes |
|---------|---------|-------|
| V3 | ✅ Full | Zork I-III, Planetfall, etc. |
| V4 | 🔶 Partial | Most opcodes implemented |
| V5 | 🔶 Partial | Extended opcodes, undo support |
| V6 | ❌ | Graphics/mouse not supported |
| V7-8 | 🔶 Partial | Same as V5 |

## Building

```bash
npm install
npm run build      # Compile TypeScript
npm test           # Run tests
npm run dev:web    # Start web dev server
```

## Project Structure

```
src/
├── core/           # Zero-dependency core
│   ├── cpu/        # Stack and call frames
│   ├── dictionary/ # Word lookup and tokenization
│   ├── execution/  # Opcode execution engine
│   ├── instructions/ # Opcode definitions and decoder
│   ├── memory/     # Memory and header access
│   ├── objects/    # Object tree and properties
│   ├── text/       # ZSCII and Z-character encoding
│   ├── variables/  # Variable access (locals, globals, stack)
│   └── ZMachine.ts # Main VM class
├── io/             # I/O adapter interfaces
├── web/            # Browser-based player
└── index.ts        # Public API exports
```

## Testing with Story Files

Story files (.z3, .z5, etc.) are copyrighted. Obtain them legally:

- **Commercial**: [GOG.com](https://www.gog.com) sells Infocom collections
- **Free**: [IF Archive](https://ifarchive.org/) has free Inform games

Place story files in a `roms/` folder (gitignored).

## Resources

- [Z-Machine Specification v1.1](https://www.inform-fiction.org/zmachine/standards/z1point1/)
- [Quetzal Save Format](http://inform-fiction.org/zmachine/standards/quetzal/)
- [IF Archive](https://ifarchive.org/)

## License

MIT © Daniel Lockard
