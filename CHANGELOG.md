# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-01-26

### Added
- Custom error class hierarchy (`ZMachineError`, `MemoryError`, `OpcodeError`, `DecodeError`, `StackError`, `ObjectError`, `SaveError`, `IOError`)
- Error formatting helpers (`formatAddress`, `formatByte`, `formatWord`)
- Split `IOAdapter` into focused sub-interfaces for better modularity:
  - `IOAdapterCore` - Required methods all adapters must implement
  - `IOAdapterWindowed` - Window management (V3+)
  - `IOAdapterStyled` - Text styling (V4+)
  - `IOAdapterColor` - Color support (V5+)
  - `IOAdapterSound` - Sound effects (V3+)
  - `IOAdapterSave` - Save/restore functionality
  - `IOAdapterCursor` - Advanced cursor control (V4+/V6+)
  - `IOAdapterStreams` - I/O stream management
  - `IOAdapterStatus` - Status line display (V3)
  - `IOAdapterVerify` - Game verification
- `CursorPosition` type for cursor coordinates
- `ExecutorOptions` interface with `debug` flag for optional performance tracking
- Comprehensive JSDoc documentation for all public exports in main index.ts

### Changed
- Debug tracking in Executor is now opt-in via `{ debug: true }` option (improves performance)
- Replaced magic header offset numbers with `HeaderAddress` constants in `Memory.ts` and `ZMachine.ts`
- Improved JSDoc documentation throughout I/O interfaces
- Expanded main module documentation with Quick Start examples

### Fixed
- Memory module now imports and uses `HeaderAddress.STATIC_MEMORY_BASE` instead of raw `0x0E`

## [0.2.0] - 2026-01-26

### Added
- Prettier configuration for consistent code formatting
- CONTRIBUTING.md guidelines for contributors
- ESLint flat config migration (eslint.config.js)
- Pre-commit hooks with husky and lint-staged
- CHANGELOG.md for version history tracking
- `TrueColor` constants for set_true_colour opcode magic values

### Changed
- Enabled stricter TypeScript compiler options (`noUnusedLocals`, `noUnusedParameters`)
- Exposed debug state via `getOpcodeStats()` (includes recent PCs and last executed PC)
- Added getters for IO adapter state (`getVersion()`, `getTextStyle()`, `getUpperWindowLines()`)
- Updated ESLint to v9 with typescript-eslint flat config
- Fixed README npm badge to match package name

### Removed
- Legacy `.eslintrc.json` (replaced by `eslint.config.js`)
- Removed unused @typescript-eslint/eslint-plugin and @typescript-eslint/parser (replaced by typescript-eslint)

## [0.1.1] - 2026-01-26

### Fixed
- Corrected GitHub username in package.json repository URLs

## [0.1.0] - 2026-01-26

### Added
- Initial release of Z-machine emulator
- Full Z-machine v1-v5 support, partial v6-v8 support
- Zero runtime dependencies in core emulator
- WebIOAdapter for browser-based games
- TestIOAdapter for automated testing
- Quetzal save/restore format support
- 898+ tests with 99.79% code coverage

### Features
- Complete instruction set implementation for v1-v5
- ZSCII text encoding/decoding with abbreviations
- Object table manipulation
- Dictionary parsing and tokenization
- Variable handling (locals, globals, stack)
- Screen model with window support
- Input handling (read, read_char)
- Output streams (1-4)
- Sound effects (basic support)

[Unreleased]: https://github.com/daniellockard/zmachine/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/daniellockard/zmachine/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/daniellockard/zmachine/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/daniellockard/zmachine/releases/tag/v0.1.0
