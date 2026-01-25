/**
 * Integration test - Run V5 games with the Z-machine emulator
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ZMachine, RunState } from '../core/ZMachine';
import { TestIOAdapter } from '../io/TestIOAdapter';

describe('V5 Game Integration', () => {
  function loadBorderzone(): ArrayBuffer {
    const gamePath = path.join(__dirname, '..', '..', 'roms', 'borderzone-r9-s871008.z5');
    const storyData = fs.readFileSync(gamePath);
    return storyData.buffer.slice(storyData.byteOffset, storyData.byteOffset + storyData.byteLength);
  }

  function loadSherlock(variant: string = 'sherlock-r26-s880127.z5'): ArrayBuffer {
    const gamePath = path.join(__dirname, '..', '..', 'roms', variant);
    const storyData = fs.readFileSync(gamePath);
    return storyData.buffer.slice(storyData.byteOffset, storyData.byteOffset + storyData.byteLength);
  }

  it('should load Sherlock (V5)', () => {
    const buffer = loadSherlock();
    const io = new TestIOAdapter();
    const zm = ZMachine.load(buffer, io);

    expect(zm.version).toBe(5);
    expect(zm.state).toBe(RunState.Stopped);
  });

  it('should load Borderzone (V5)', () => {
    const buffer = loadBorderzone();
    const io = new TestIOAdapter();
    const zm = ZMachine.load(buffer, io);

    expect(zm.version).toBe(5);
    expect(zm.state).toBe(RunState.Stopped);
  });

  it('should run Borderzone and produce output', async () => {
    const buffer = loadBorderzone();
    const io = new TestIOAdapter();
    
    // Queue a command
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);

    // Run until we exhaust input or hit max steps
    let steps = 0;
    const maxSteps = 100000; // Reduced - we just need to see some output

    while (zm.state !== RunState.Halted && steps < maxSteps) {
      try {
        await zm.step();
        steps++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('No line input available') || msg.includes('No char input')) {
          break;
        }
        // Re-throw unexpected errors
        throw e;
      }
    }

    const fullOutput = io.getFullOutput();
    
    // Should have some output - V5 games produce text
    expect(fullOutput.length).toBeGreaterThan(0);
    
    // Borderzone should produce reasonable output
    expect(fullOutput.length).toBeGreaterThan(100);
  }, 60000);

  it('should run Sherlock and produce output', async () => {
    // Try the simpler r26 Sherlock
    const buffer = loadSherlock('sherlock-r26-s880127.z5');
    const io = new TestIOAdapter();
    
    // Queue commands
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);

    // Run until we exhaust input or hit max steps
    let steps = 0;
    const maxSteps = 500000;

    while (zm.state !== RunState.Halted && steps < maxSteps) {
      try {
        await zm.step();
        steps++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('No line input available') || msg.includes('No char input')) {
          break;
        }
        throw e;
      }
    }

    const fullOutput = io.getFullOutput();

    // Should have substantial output (game produces status line and room description)
    expect(fullOutput.length).toBeGreaterThan(50);
    
    // Should run for a significant number of steps
    expect(steps).toBeGreaterThan(1000);
  }, 60000);
});
