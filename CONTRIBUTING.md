# Contributing to Z-Machine Emulator

Thank you for your interest in contributing to the Z-machine emulator! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/zmachine.git`
3. Install dependencies: `npm install`
4. Run tests to ensure everything works: `npm test`

## Development Workflow

### Running Tests

```bash
# Run all core tests
npm test

# Run tests in watch mode
npm run test:watch

# Run web-specific tests (requires jsdom)
npm run test:web

# Run all tests with coverage
npm run test:all:coverage
```

### Building

```bash
# TypeScript compilation
npm run build

# Vite web build
npm run build:web

# Vite library build (minified UMD/ESM)
npm run build:lib
```

### Development Server

```bash
# Start the web dev server on port 8080
npm run dev:web
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Format with Prettier
npm run format

# Check formatting without modifying
npm run format:check
```

## Code Guidelines

### Zero Dependencies in Core

The `src/core/` directory must have **zero npm dependencies**. Use only built-in browser/Node APIs like `ArrayBuffer`, `DataView`, `TextEncoder`.

### TypeScript

- Use strict TypeScript - no `any` types unless absolutely necessary
- Provide explicit return types on all functions
- Use descriptive variable names (e.g., `packedAddress` not `pa`)

### Testing

- Every module should have corresponding `.test.ts` files
- Use Vitest for testing
- Aim for high coverage (currently at 99.79%)

### Z-Machine Specifics

- Document opcodes with their hex codes and Z-machine spec section references
- Always use big-endian byte order: `DataView.getUint16(address, false)`
- Use `& 0xFFFF` for unsigned 16-bit operations

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new features
- `fix:` bug fixes
- `test:` adding tests
- `refactor:` code restructuring
- `docs:` documentation
- `chore:` maintenance tasks

Examples:
```
feat: implement op_save_undo instruction
fix: correct packed address calculation for V6
test: add coverage for object property edge cases
docs: update README with V6 support status
```

## Project Structure

```
src/
├── core/           # Zero-dependency emulator core
│   ├── cpu/        # Stack frames, call stack
│   ├── dictionary/ # Word lookup and tokenization
│   ├── execution/  # Instruction decoder and executor
│   ├── instructions/ # Opcode definitions
│   ├── memory/     # Memory model, header parsing
│   ├── objects/    # Object table, properties, attributes
│   ├── state/      # Save/restore (Quetzal format)
│   ├── text/       # ZSCII encoding/decoding
│   └── variables/  # Locals, globals, stack
├── io/             # I/O abstraction layer
├── types/          # Shared TypeScript types
├── web/            # Browser-specific implementation
└── integration/    # Integration tests with real ROMs
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes with appropriate tests
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Commit with a descriptive message following conventional commits
6. Push and create a pull request

### PR Checklist

- [ ] Tests added/updated for changes
- [ ] All tests passing
- [ ] Linting passes
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional commits

## Resources

- [Z-Machine Specification](https://www.inform-fiction.org/zmachine/standards/z1point1/)
- [Quetzal Save Format](https://www.inform-fiction.org/zmachine/standards/quetzal/)
- [PLAN.md](./PLAN.md) - Implementation roadmap and design decisions

## Questions?

Feel free to open an issue for questions, bug reports, or feature requests.
