/**
 * I/O Module
 *
 * Provides abstract I/O interfaces and implementations for Z-machine input/output.
 *
 * @module io
 */

// Core and supporting types
export type {
  IOAdapter,
  IOAdapterCore,
  IOAdapterWindowed,
  IOAdapterStyled,
  IOAdapterColor,
  IOAdapterSound,
  IOAdapterSave,
  IOAdapterCursor,
  IOAdapterStreams,
  IOAdapterStatus,
  IOAdapterVerify,
  WindowProps,
  ReadLineResult,
  CursorPosition,
} from './IOAdapter';

// Test implementation
export { TestIOAdapter } from './TestIOAdapter';
