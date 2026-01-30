/**
 * Integration test that simulates the web UI's async input flow
 * to reproduce the "open eyes" bug in Hitchhiker's Guide
 */

/* eslint-disable no-console */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ZMachine } from '../core/ZMachine';
import { IOAdapter, ReadLineResult } from '../io/IOAdapter';
import { ZVersion } from '../types/ZMachineTypes';

/**
 * Async IO Adapter that simulates web UI behavior
 * - readLine returns a Promise that waits for provideInput()
 * - This mimics the browser's async event-driven input
 */
class AsyncIOAdapter implements IOAdapter {
  private output: string[] = [];
  private lineResolver: ((result: ReadLineResult) => void) | null = null;
  private inputQueue: string[] = [];
  private readLineCallCount = 0;

  constructor(inputs: string[]) {
    this.inputQueue = [...inputs];
  }

  initialize(_version: ZVersion): void {
    this.output = [];
  }

  print(text: string): void {
    this.output.push(text);
    // Log to console so we can see what's happening
    process.stdout.write(text);
  }

  printLine(text: string): void {
    this.print(text + '\n');
  }

  newLine(): void {
    this.print('\n');
  }

  async readLine(maxLength: number, _timeout?: number): Promise<ReadLineResult> {
    this.readLineCallCount++;
    console.log(`\n[AsyncIO] readLine #${this.readLineCallCount} called (maxLength=${maxLength})`);

    // If we have queued input, provide it after a microtask delay
    // This simulates the async nature of browser events
    if (this.inputQueue.length > 0) {
      const text = this.inputQueue.shift()!;
      console.log(`[AsyncIO] Providing queued input: "${text}"`);

      // Simulate async event delivery like in browser
      await new Promise((resolve) => setTimeout(resolve, 10));

      console.log(`[AsyncIO] Returning input: "${text}"`);
      return { text, terminator: 13 };
    }

    // No more input - this would hang in a real scenario
    console.log(`[AsyncIO] No more input available, would hang here`);
    throw new Error('No line input available');
  }

  async readChar(_timeout?: number): Promise<number> {
    return 13; // Enter key
  }

  showStatusLine(
    _location: string,
    _scoreOrHours: number,
    _turnsOrMinutes: number,
    _isTime: boolean
  ): void {}

  splitWindow(_lines: number): void {}
  setWindow(_window: number): void {}
  eraseWindow(_window: number): void {}
  eraseLine(): void {}
  setCursor(_line: number, _column: number): void {}
  setBufferMode(_mode: boolean): void {}
  setTextStyle(_style: number): void {}
  setColor(_foreground: number, _background: number): void {}
  quit(): void {
    console.log('\n[AsyncIO] QUIT called');
  }
  restart(): void {
    console.log('\n[AsyncIO] RESTART called');
  }
  async save(_data: Uint8Array): Promise<boolean> {
    return false;
  }
  async restore(): Promise<Uint8Array | null> {
    return null;
  }
  soundEffect(_number: number, _effect: number, _volume: number): void {}
  setFont(_font: number): number {
    return 0;
  }

  getOutput(): string {
    return this.output.join('');
  }

  getReadLineCallCount(): number {
    return this.readLineCallCount;
  }
}

describe('Hitchhiker Web UI Simulation', () => {
  const romPath = path.join(__dirname, '../../roms/hitchhiker-r60-s861002.z3');
  let storyData: ArrayBuffer;

  beforeEach(() => {
    if (!fs.existsSync(romPath)) {
      console.log('Hitchhiker ROM not found, skipping test');
      return;
    }
    const buffer = fs.readFileSync(romPath);
    storyData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });

  it('should handle "open eyes" command without looping', async () => {
    if (!storyData) {
      console.log('Skipping - no ROM');
      return;
    }

    // Provide the "open eyes" command
    // Game starts in pitch black bedroom - "open eyes" is the first command
    const io = new AsyncIOAdapter(['open eyes', 'look']);
    const zm = ZMachine.load(storyData, io);
    io.initialize(zm.version);

    console.log('\n=== Starting game ===\n');

    try {
      // Run the game - it should execute until it needs input or halts
      await zm.run();
    } catch (error) {
      // Expected - we run out of input
      console.log(`\n=== Game stopped: ${error} ===\n`);
    }

    const output = io.getOutput();
    console.log('\n=== Final Output ===');
    console.log(output);
    console.log('=== End Output ===\n');

    console.log(`readLine was called ${io.getReadLineCallCount()} times`);

    // The game should have printed "They are." after "open eyes"
    expect(output).toContain('They are.');

    // readLine should have been called a reasonable number of times
    // (1 for initial prompt, 1 after "open eyes", maybe 1 more for "look")
    expect(io.getReadLineCallCount()).toBeLessThan(10);
  });

  it('should handle death scenario (bulldozer) correctly', async () => {
    if (!storyData) {
      console.log('Skipping - no ROM');
      return;
    }

    // Just open eyes and wait - this triggers the death sequence
    // after a few turns if you don't do anything else
    // After death: Enter for score, then QUIT at the restart menu
    const io = new AsyncIOAdapter([
      'open eyes',
      'wait',
      'wait',
      'wait',
      'wait',
      'wait',
      'wait',
      'wait',
      '', // Enter to acknowledge score
      'quit', // At RESTART/RESTORE/QUIT menu
    ]);
    const zm = ZMachine.load(storyData, io);
    io.initialize(zm.version);

    console.log('\n=== Starting death scenario test ===\n');

    try {
      await zm.run();
    } catch (error) {
      console.log(`\n=== Game stopped: ${error} ===\n`);
    }

    const output = io.getOutput();
    console.log('\n=== Final Output ===');
    console.log(output);
    console.log('=== End Output ===\n');

    console.log(`readLine was called ${io.getReadLineCallCount()} times`);

    // Check that we didn't get into an infinite loop
    expect(io.getReadLineCallCount()).toBeLessThan(20);
  });
});
