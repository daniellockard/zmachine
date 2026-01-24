# Z-Machine Emulator - Copilot Instructions

## Project Overview

This is a Z-machine emulator written from scratch in TypeScript. The Z-machine is the virtual machine that runs Infocom text adventure games (.z3, .z5, .z8 files).

## Key Principles

1. **No runtime dependencies** - The core emulator (`src/core/`) must have zero npm dependencies. Use only built-in browser/Node APIs like `ArrayBuffer`, `DataView`, `TextEncoder`.

2. **Test-driven development** - Every module should have corresponding `.test.ts` files. Use Vitest for testing.

3. **Type safety** - Use strict TypeScript. No `any` types unless absolutely necessary.

4. **Big-endian awareness** - The Z-machine uses big-endian byte order. Always use `DataView` with `false` for the little-endian parameter.

## Code Style

- Use explicit return types on all functions
- Use descriptive variable names (e.g., `packedAddress` not `pa`)
- Document opcodes with their hex codes and Z-machine spec section references
- Keep functions small and focused
- Prefer composition over inheritance

## Architecture

### Core (`src/core/`)
- Zero dependencies
- Pure computation, no I/O side effects
- All I/O goes through the `IOAdapter` interface

### I/O (`src/io/`)
- Abstract interfaces for input/output
- Platform-agnostic

### Web (`src/web/`)
- Browser-specific implementations
- DOM manipulation, keyboard events, IndexedDB

## Z-Machine Specifics

### Memory Layout
- Dynamic memory: 0x00 to static memory mark (read/write)
- Static memory: After dynamic, up to 64KB (read-only)
- High memory: Contains routines and strings

### Address Types
- Byte address: Direct offset into memory
- Word address: Multiply by 2
- Packed address: Multiply by 2 (V3), 4 (V5), or 8 (V8)

### Numbers
- All values are 16-bit
- Use `& 0xFFFF` for unsigned operations
- Use `<< 16 >> 16` for signed conversion

### Instruction Format
```
[opcode] [operand types] [operands...] [store?] [branch?] [text?]
```

Four forms: Long, Short, Extended, Variable

## Testing

Run tests with: `npm test`
Watch mode: `npm run test:watch`

Use meaningful test data - when possible, use values from actual Z-machine games or the spec.

## Common Patterns

### Reading a word from memory (big-endian)
```typescript
const word = this.view.getUint16(address, false);
```

### Signed 16-bit conversion
```typescript
const signed = (unsigned << 16) >> 16;
// or
const signed = unsigned > 0x7FFF ? unsigned - 0x10000 : unsigned;
```

### Packed address conversion (V3)
```typescript
const byteAddress = packedAddress * 2;
```

## Commit Messages

Use conventional commits:
- `feat:` new features
- `fix:` bug fixes
- `test:` adding tests
- `refactor:` code restructuring
- `docs:` documentation

## Resources

- [Z-Machine Spec](https://www.inform-fiction.org/zmachine/standards/z1point1/)
- See `PLAN.md` for implementation roadmap
