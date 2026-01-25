/**
 * Integration test - Run Zork 1 with the Z-machine emulator
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ZMachine, RunState } from '../core/ZMachine';
import { TestIOAdapter } from '../io/TestIOAdapter';

describe('Zork 1 Integration', () => {
  function loadZork(): ArrayBuffer {
    const zorkPath = path.join(__dirname, '..', '..', 'roms', 'zork1-r88-s840726.z3');
    const storyData = fs.readFileSync(zorkPath);
    return storyData.buffer.slice(storyData.byteOffset, storyData.byteOffset + storyData.byteLength);
  }

  it('should load Zork 1', () => {
    const buffer = loadZork();
    const io = new TestIOAdapter();
    const zm = ZMachine.load(buffer, io);

    expect(zm.version).toBe(3);
    expect(zm.state).toBe(RunState.Stopped);
  });

  it('should run Zork 1 opening and respond to look', async () => {
    const buffer = loadZork();
    const io = new TestIOAdapter();
    
    // Queue multiple commands
    io.queueLineInput('open mailbox');
    io.queueLineInput('take leaflet');
    io.queueLineInput('inventory');
    
    const zm = ZMachine.load(buffer, io);

    // Run until we exhaust input
    let steps = 0;
    const maxSteps = 500000;

    while (zm.state !== RunState.Halted && steps < maxSteps) {
      try {
        await zm.step();
        steps++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('No line input available')) {
          // Expected - ran out of inputs
          break;
        }
        throw e;
      }
    }

    const output = io.getFullOutput();

    // The opening should mention ZORK
    expect(output.toLowerCase()).toContain('zork');
    // Should see mailbox interaction
    expect(output.toLowerCase()).toContain('opening the small mailbox');
    // Should have taken the leaflet
    expect(output.toLowerCase()).toContain('taken');
    // Inventory should show leaflet
    expect(output.toLowerCase()).toContain('you are carrying');
  }, 60000); // 60 second timeout

  it('should display West of House', async () => {
    const buffer = loadZork();
    const io = new TestIOAdapter();
    
    // Queue look command
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);

    let steps = 0;
    const maxSteps = 50000;

    while (zm.state !== RunState.Halted && steps < maxSteps) {
      await zm.step();
      steps++;

      if (zm.state === RunState.WaitingForInput) {
        break;
      }
    }

    const output = io.getFullOutput();
    
    // Should mention West of House (starting location)
    expect(output.toLowerCase()).toContain('house');
  }, 30000);
});
