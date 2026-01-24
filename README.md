# Z-Machine Emulator

A Z-machine emulator written from scratch in TypeScript. Runs classic Infocom text adventure games (.z3, .z5, .z8 files) in the browser.

## Features

- **Zero runtime dependencies** — Core emulator uses only built-in browser APIs
- **TypeScript** — Full type safety throughout
- **Test-driven** — Comprehensive unit tests with Vitest
- **Web-first** — Designed for browser deployment

## Z-Machine Versions

| Version | Status | Games |
|---------|--------|-------|
| V3 | 🎯 Target | Zork I-III, Hitchhiker's Guide, most Infocom classics |
| V5 | Planned | Later Infocom, modern Inform games |
| V8 | Planned | Large Inform games |
| V1-2, V4 | Skipped | Rare/transitional versions |
| V6 | Later | Graphical games (requires graphics support) |

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Watch mode for development
npm run test:watch

# Build
npm run build
```

## Project Structure

```
src/
├── core/                    # Zero-dependency Z-machine core
│   ├── memory/              # Memory, header, address utilities
│   ├── cpu/                 # Stack frames, call stack
│   ├── instructions/        # Decoder, opcode tables
│   ├── text/                # Z-character encoding/decoding
│   ├── objects/             # Object table, properties, attributes
│   └── dictionary/          # Dictionary lookup, tokenization
├── io/                      # I/O abstraction layer
└── web/                     # Browser implementation
```

## Testing with Story Files

Story files (`.z1`–`.z8`) are copyrighted and not included in this repository.

### Obtaining Test Files

- **Commercial**: [GOG.com](https://www.gog.com) sells Infocom collections
- **Free**: [IF Archive](https://ifarchive.org/) has free Inform games and test suites

### Test File Organization

Place story files in a `roms/` folder (gitignored):

```
roms/
├── zork1-r119-s880429.z3    # V3 test
├── trinity-r15-s870628.z4   # V4 test
├── beyondzork-r57-s871221.z5 # V5 test
└── README.md                # Documentation
```

File naming: `gamename-rXX-sYYMMDD.zN`
- `rXX` = Release number
- `sYYMMDD` = Serial number (compile date)
- `zN` = Z-machine version

### Recommended Test Files

| Version | Recommended | Why |
|---------|-------------|-----|
| V3 | zork1-r119-s880429.z3 | Classic, well-documented |
| V3 | minizork-r34-s871124.z3 | Smaller, faster iteration |
| V5 | sherlock-r4-s880324.z5 | Good V5 feature coverage |

## Development

See [PLAN.md](PLAN.md) for the implementation roadmap.

### Key Principles

1. **No runtime dependencies** in `src/core/`
2. **Big-endian awareness** — Use `DataView` with explicit endianness
3. **Test everything** — Each module has corresponding `.test.ts` files
4. **Type safety** — No `any` types unless absolutely necessary

### Running Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Resources

- [Z-Machine Standards Document v1.1](https://www.inform-fiction.org/zmachine/standards/z1point1/)
- [Quetzal Save Format](http://inform-fiction.org/zmachine/standards/quetzal/)
- [IF Archive](https://ifarchive.org/)

## License

MIT
