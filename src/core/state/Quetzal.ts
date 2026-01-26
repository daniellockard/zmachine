/**
 * Quetzal Save File Format
 * 
 * Quetzal is the standard portable save file format for Z-machine interpreters.
 * It's an IFF (Interchange File Format) based format containing:
 * - IFhd chunk: Game identification (release, serial, checksum, PC)
 * - CMem chunk: Compressed dynamic memory (XOR with original, run-length encoded)
 * - UMem chunk: Uncompressed dynamic memory (alternative to CMem)
 * - Stks chunk: Stack frames and evaluation stacks
 * 
 * Reference: http://inform-fiction.org/zmachine/standards/quetzal/
 * 
 * @module
 */

import { ByteAddress, Word } from '../../types/ZMachineTypes';
import { Memory } from '../memory/Memory';
import { CallStackSnapshot } from '../cpu/Stack';

/**
 * Game identification from save file
 */
export interface GameIdentification {
  release: number;
  serial: string;
  checksum: number;
  pc: ByteAddress;
}

/**
 * Complete save state for serialization
 */
export interface SaveState {
  /** Game identification */
  gameId: GameIdentification;
  /** Dynamic memory (may be compressed if isCompressed is true) */
  dynamicMemory: Uint8Array;
  /** Whether dynamicMemory is CMem (compressed) or UMem (uncompressed) */
  isCompressed: boolean;
  /** Call stack state */
  callStack: CallStackSnapshot;
}

/**
 * IFF chunk structure
 */
interface IFFChunk {
  type: string;
  data: Uint8Array;
}

/**
 * Write a 4-byte big-endian integer
 */
function writeUint32BE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >> 24) & 0xFF;
  arr[offset + 1] = (value >> 16) & 0xFF;
  arr[offset + 2] = (value >> 8) & 0xFF;
  arr[offset + 3] = value & 0xFF;
}

/**
 * Write a 2-byte big-endian integer
 */
function writeUint16BE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >> 8) & 0xFF;
  arr[offset + 1] = value & 0xFF;
}

/**
 * Read a 4-byte big-endian integer
 */
function readUint32BE(arr: Uint8Array, offset: number): number {
  return (arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3];
}

/**
 * Read a 2-byte big-endian integer
 */
function readUint16BE(arr: Uint8Array, offset: number): number {
  return (arr[offset] << 8) | arr[offset + 1];
}

/**
 * Convert a 4-character string to bytes
 */
function stringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert bytes to a 4-character string
 */
function bytesToString(arr: Uint8Array, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(arr[offset + i]);
  }
  return str;
}

/**
 * Compress dynamic memory using XOR with original + run-length encoding
 * 
 * The CMem format XORs current memory with original, then run-length encodes
 * zero bytes as: 0x00 followed by count-1 (so 0x00 0x00 means 1 zero byte).
 */
export function compressMemory(current: Uint8Array, original: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;
  
  while (i < current.length) {
    const xored = current[i] ^ original[i];
    
    if (xored === 0) {
      // Count consecutive zero bytes
      let zeroCount = 1;
      while (i + zeroCount < current.length && 
             zeroCount < 256 &&
             (current[i + zeroCount] ^ original[i + zeroCount]) === 0) {
        zeroCount++;
      }
      // Write as 0x00 followed by (count - 1)
      result.push(0);
      result.push(zeroCount - 1);
      i += zeroCount;
    } else {
      result.push(xored);
      i++;
    }
  }
  
  return new Uint8Array(result);
}

/**
 * Decompress CMem data back to dynamic memory
 */
export function decompressMemory(compressed: Uint8Array, original: Uint8Array): Uint8Array {
  const result = new Uint8Array(original.length);
  let srcIndex = 0;
  let dstIndex = 0;
  
  while (srcIndex < compressed.length && dstIndex < original.length) {
    const byte = compressed[srcIndex++];
    
    if (byte === 0) {
      // Run of zero XOR bytes (unchanged from original)
      const count = (compressed[srcIndex++] || 0) + 1;
      for (let i = 0; i < count && dstIndex < original.length; i++) {
        result[dstIndex] = original[dstIndex];
        dstIndex++;
      }
    } else {
      // Single XOR byte
      result[dstIndex] = byte ^ original[dstIndex];
      dstIndex++;
    }
  }
  
  // Fill rest with original (if compressed data ends early)
  while (dstIndex < original.length) {
    result[dstIndex] = original[dstIndex];
    dstIndex++;
  }
  
  return result;
}

/**
 * Create IFhd chunk (game identification)
 * 
 * Format (13 bytes):
 * - 2 bytes: release number
 * - 6 bytes: serial number (ASCII)
 * - 2 bytes: checksum
 * - 3 bytes: initial PC (24-bit)
 */
function createIFhdChunk(gameId: GameIdentification): Uint8Array {
  const data = new Uint8Array(13);
  writeUint16BE(data, 0, gameId.release);
  
  // Serial number (6 ASCII chars) - always exactly 6 bytes from story file
  for (let i = 0; i < 6; i++) {
    data[2 + i] = gameId.serial.charCodeAt(i);
  }
  
  writeUint16BE(data, 8, gameId.checksum);
  
  // PC as 24-bit value
  data[10] = (gameId.pc >> 16) & 0xFF;
  data[11] = (gameId.pc >> 8) & 0xFF;
  data[12] = gameId.pc & 0xFF;
  
  return data;
}

/**
 * Parse IFhd chunk
 */
function parseIFhdChunk(data: Uint8Array): GameIdentification {
  if (data.length < 13) {
    throw new Error('IFhd chunk too short');
  }
  
  const release = readUint16BE(data, 0);
  const serial = bytesToString(data, 2, 6);
  const checksum = readUint16BE(data, 8);
  const pc = (data[10] << 16) | (data[11] << 8) | data[12];
  
  return { release, serial, checksum, pc };
}

/**
 * Create Stks chunk (stack frames)
 * 
 * Format per frame:
 * - 3 bytes: return PC (24-bit)
 * - 1 byte: flags (bit 4 = discard result)
 * - 1 byte: result variable (if not discarding)
 * - 1 byte: arguments supplied (bitmask for V4+ style)
 * - 2 bytes: evaluation stack size
 * - 2n bytes: local variables (n determined by flags)
 * - 2m bytes: evaluation stack values
 */
function createStksChunk(stack: CallStackSnapshot): Uint8Array {
  const parts: Uint8Array[] = [];
  
  for (const frame of stack.frames) {
    // Calculate frame size
    const localsSize = frame.locals.length * 2;
    const stackSize = frame.evalStack.length * 2;
    const frameSize = 8 + localsSize + stackSize;
    
    const frameData = new Uint8Array(frameSize);
    let offset = 0;
    
    // Return PC (24-bit)
    frameData[offset++] = (frame.returnPC >> 16) & 0xFF;
    frameData[offset++] = (frame.returnPC >> 8) & 0xFF;
    frameData[offset++] = frame.returnPC & 0xFF;
    
    // Flags: local count in lower 4 bits, bit 4 = discard result
    let flags = frame.locals.length & 0x0F;
    if (frame.storeVariable === undefined) {
      flags |= 0x10; // Bit 4: discard result
    }
    frameData[offset++] = flags;
    
    // Store variable (or 0 if discarding)
    frameData[offset++] = frame.storeVariable ?? 0;
    
    // Arguments bitmask (bit 0 = arg 1 supplied, etc.)
    let argMask = 0;
    for (let i = 0; i < frame.argumentCount && i < 7; i++) {
      argMask |= (1 << i);
    }
    frameData[offset++] = argMask;
    
    // Evaluation stack size (number of words)
    writeUint16BE(frameData, offset, frame.evalStack.length);
    offset += 2;
    
    // Local variables
    for (const local of frame.locals) {
      writeUint16BE(frameData, offset, local);
      offset += 2;
    }
    
    // Evaluation stack
    for (const value of frame.evalStack) {
      writeUint16BE(frameData, offset, value);
      offset += 2;
    }
    
    parts.push(frameData);
  }
  
  // Combine all frames
  const totalSize = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  
  return result;
}

/**
 * Parse Stks chunk
 */
function parseStksChunk(data: Uint8Array): CallStackSnapshot {
  const frames: CallStackSnapshot['frames'] = [];
  let offset = 0;
  
  while (offset < data.length) {
    // Return PC (24-bit)
    const returnPC = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
    offset += 3;
    
    // Flags
    const flags = data[offset++];
    const localCount = flags & 0x0F;
    const discardResult = (flags & 0x10) !== 0;
    
    // Store variable
    const storeVarByte = data[offset++];
    const storeVariable = discardResult ? undefined : storeVarByte;
    
    // Arguments mask
    const argMask = data[offset++];
    let argumentCount = 0;
    for (let i = 0; i < 7; i++) {
      if (argMask & (1 << i)) {
        argumentCount = i + 1;
      }
    }
    
    // Evaluation stack size
    const evalStackSize = readUint16BE(data, offset);
    offset += 2;
    
    // Local variables
    const locals: Word[] = [];
    for (let i = 0; i < localCount; i++) {
      locals.push(readUint16BE(data, offset));
      offset += 2;
    }
    
    // Evaluation stack
    const evalStack: Word[] = [];
    for (let i = 0; i < evalStackSize; i++) {
      evalStack.push(readUint16BE(data, offset));
      offset += 2;
    }
    
    frames.push({
      returnPC,
      storeVariable,
      argumentCount,
      locals,
      evalStack,
    });
  }
  
  return { frames };
}

/**
 * Create a complete Quetzal save file
 * 
 * @param memory - Z-machine memory
 * @param stack - Call stack snapshot
 * @param pc - Program counter to resume at
 * @param originalMemory - Optional original story file memory for CMem compression
 */
export function createQuetzalSave(
  memory: Memory,
  stack: CallStackSnapshot,
  pc: ByteAddress,
  originalMemory?: Uint8Array
): Uint8Array {
  // Get game identification from header
  const view = memory.getView();
  const release = view.getUint16(0x02, false);
  const serial = bytesToString(new Uint8Array(memory.getBuffer(), 0x12, 6), 0, 6);
  const checksum = view.getUint16(0x1C, false);
  
  const gameId: GameIdentification = { release, serial, checksum, pc };
  
  // Create chunks
  const ifhdData = createIFhdChunk(gameId);
  
  const staticBase = memory.staticBase;
  let memChunk: IFFChunk;
  
  if (originalMemory && originalMemory.length >= staticBase) {
    // Use CMem (compressed) - XOR with original then run-length encode
    const currentMem = new Uint8Array(memory.getBuffer(), 0, staticBase);
    const cmemData = compressMemory(currentMem, originalMemory);
    memChunk = { type: 'CMem', data: cmemData };
  } else {
    // Use UMem (uncompressed) - simpler and more compatible
    const umemData = new Uint8Array(staticBase);
    for (let i = 0; i < staticBase; i++) {
      umemData[i] = memory.readByte(i);
    }
    memChunk = { type: 'UMem', data: umemData };
  }
  
  const stksData = createStksChunk(stack);
  
  // Build IFF structure
  // FORM type + length + IFZS type + chunks
  const chunks: IFFChunk[] = [
    { type: 'IFhd', data: ifhdData },
    memChunk,
    { type: 'Stks', data: stksData },
  ];
  
  // Calculate total size
  let chunksSize = 4; // 'IFZS' type
  for (const chunk of chunks) {
    chunksSize += 8 + chunk.data.length; // type (4) + length (4) + data
    if (chunk.data.length % 2 === 1) {
      chunksSize++; // Padding byte
    }
  }
  
  const totalSize = 8 + chunksSize; // 'FORM' (4) + size (4) + content
  const result = new Uint8Array(totalSize);
  let offset = 0;
  
  // Write FORM header
  result.set(stringToBytes('FORM'), offset);
  offset += 4;
  writeUint32BE(result, offset, chunksSize);
  offset += 4;
  
  // Write IFZS type
  result.set(stringToBytes('IFZS'), offset);
  offset += 4;
  
  // Write chunks
  for (const chunk of chunks) {
    result.set(stringToBytes(chunk.type), offset);
    offset += 4;
    writeUint32BE(result, offset, chunk.data.length);
    offset += 4;
    result.set(chunk.data, offset);
    offset += chunk.data.length;
    
    // Padding byte if odd length
    if (chunk.data.length % 2 === 1) {
      result[offset++] = 0;
    }
  }
  
  return result;
}

/**
 * Parse a Quetzal save file
 */
export function parseQuetzalSave(data: Uint8Array): SaveState {
  if (data.length < 12) {
    throw new Error('Save file too short');
  }
  
  // Check FORM header
  const formType = bytesToString(data, 0, 4);
  if (formType !== 'FORM') {
    throw new Error('Not an IFF file');
  }
  
  const formSize = readUint32BE(data, 4);
  if (formSize + 8 > data.length) {
    throw new Error('IFF file truncated');
  }
  
  // Check IFZS type
  const ifzsType = bytesToString(data, 8, 4);
  if (ifzsType !== 'IFZS') {
    throw new Error('Not a Quetzal save file');
  }
  
  // Parse chunks
  let gameId: GameIdentification | null = null;
  let dynamicMemory: Uint8Array | null = null;
  let callStack: CallStackSnapshot | null = null;
  let isCompressed = false;
  
  let offset = 12;
  while (offset < data.length) {
    const chunkType = bytesToString(data, offset, 4);
    offset += 4;
    const chunkSize = readUint32BE(data, offset);
    offset += 4;
    
    const chunkData = data.slice(offset, offset + chunkSize);
    offset += chunkSize;
    
    // Skip padding byte if odd size
    if (chunkSize % 2 === 1) {
      offset++;
    }
    
    switch (chunkType) {
      case 'IFhd':
        gameId = parseIFhdChunk(chunkData);
        break;
      case 'CMem':
        dynamicMemory = chunkData;
        isCompressed = true;
        break;
      case 'UMem':
        dynamicMemory = chunkData;
        isCompressed = false;
        break;
      case 'Stks':
        callStack = parseStksChunk(chunkData);
        break;
      // Ignore other chunks (annotations, etc.)
    }
  }
  
  if (!gameId) {
    throw new Error('Missing IFhd chunk');
  }
  if (!dynamicMemory) {
    throw new Error('Missing memory chunk (CMem or UMem)');
  }
  if (!callStack) {
    throw new Error('Missing Stks chunk');
  }
  
  return {
    gameId,
    dynamicMemory,
    isCompressed,
    callStack,
  };
}

/**
 * Verify that a save file matches the current game
 */
export function verifySaveCompatibility(
  save: SaveState,
  memory: Memory
): boolean {
  const view = memory.getView();
  const release = view.getUint16(0x02, false);
  const serial = bytesToString(new Uint8Array(memory.getBuffer(), 0x12, 6), 0, 6);
  const checksum = view.getUint16(0x1C, false);
  
  return (
    save.gameId.release === release &&
    save.gameId.serial === serial &&
    save.gameId.checksum === checksum
  );
}
