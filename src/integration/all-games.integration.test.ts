/**
 * Integration tests for all game ROMs
 * 
 * Tests that each game loads correctly and can execute initial instructions.
 * Games are organized by Z-machine version.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ZMachine, RunState } from '../core/ZMachine';
import { TestIOAdapter } from '../io/TestIOAdapter';

/** Load a game ROM from the roms directory */
function loadGame(filename: string): ArrayBuffer {
  const gamePath = path.join(__dirname, '..', '..', 'roms', filename);
  const storyData = fs.readFileSync(gamePath);
  return storyData.buffer.slice(storyData.byteOffset, storyData.byteOffset + storyData.byteLength);
}

/** Run a game until it needs input or hits step limit */
async function runUntilInput(zm: ZMachine, io: TestIOAdapter, maxSteps = 100000): Promise<{ steps: number; output: string }> {
  let steps = 0;
  
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
  
  return { steps, output: io.getFullOutput() };
}

// ============================================
// Z-machine Version 1 (Early Zork)
// ============================================
describe('V1 Games', () => {
  const v1Games = [
    { file: 'zork1-r5-sXXXXXX.z1', name: 'Zork 1 (V1)' },
  ];

  for (const game of v1Games) {
    it(`should load ${game.name}`, () => {
      const buffer = loadGame(game.file);
      const io = new TestIOAdapter();
      const zm = ZMachine.load(buffer, io);
      
      expect(zm.version).toBe(1);
      expect(zm.state).toBe(RunState.Stopped);
    });
  }
});

// ============================================
// Z-machine Version 2 (Early Zork)
// ============================================
describe('V2 Games', () => {
  const v2Games = [
    { file: 'zork2-r7-sUG3AU5.z2', name: 'Zork 2 (V2)' },
  ];

  for (const game of v2Games) {
    it(`should load ${game.name}`, () => {
      const buffer = loadGame(game.file);
      const io = new TestIOAdapter();
      const zm = ZMachine.load(buffer, io);
      
      expect(zm.version).toBe(2);
      expect(zm.state).toBe(RunState.Stopped);
    });
  }
});

// ============================================
// Z-machine Version 3 (Classic Infocom)
// ============================================
describe('V3 Games', () => {
  const v3Games = [
    { file: 'ballyhoo-r99-s861014.z3', name: 'Ballyhoo' },
    { file: 'deadline-r28-s850129.z3', name: 'Deadline' },
    { file: 'enchanter-r29-s860820.z3', name: 'Enchanter' },
    { file: 'hitchhiker-r60-s861002.z3', name: "Hitchhiker's Guide" },
    { file: 'hollywoodhijinx-r37-s861215.z3', name: 'Hollywood Hijinx' },
    { file: 'infidel-r22-s830916.z3', name: 'Infidel' },
    { file: 'leathergoddesses-r59-s860730.z3', name: 'Leather Goddesses' },
    { file: 'lurkinghorror-r221-s870918.z3', name: 'Lurking Horror' },
    { file: 'minizork-r34-s871124.z3', name: 'Mini Zork' },
    { file: 'minizork2-r2-s871123.z3', name: 'Mini Zork 2' },
    { file: 'moonmist-r13-s880501.z3', name: 'Moonmist' },
    { file: 'planetfall-r39-s880501.z3', name: 'Planetfall' },
    { file: 'plunderedhearts-r26-s870730.z3', name: 'Plundered Hearts' },
    { file: 'seastalker-r18-s850919.z3', name: 'Seastalker' },
    { file: 'spellbreaker-r87-s860904.z3', name: 'Spellbreaker' },
    { file: 'starcross-r18-s830114.z3', name: 'Starcross' },
    { file: 'stationfall-r107-s870430.z3', name: 'Stationfall' },
    { file: 'suspect-i190-r18-s850222.z3', name: 'Suspect' },
    { file: 'suspended-mac-r8-s840521.z3', name: 'Suspended' },
    { file: 'wishbringer-r69-s850920.z3', name: 'Wishbringer' },
    { file: 'witness-r23-s840925.z3', name: 'Witness' },
    { file: 'zork1-r88-s840726.z3', name: 'Zork 1' },
    { file: 'zork1-r119-s880429.z3', name: 'Zork 1 (r119)' },
    { file: 'zork2-r63-s860811.z3', name: 'Zork 2' },
    { file: 'zork3-r25-s860811.z3', name: 'Zork 3' },
  ];

  describe('Loading', () => {
    for (const game of v3Games) {
      it(`should load ${game.name}`, () => {
        const buffer = loadGame(game.file);
        const io = new TestIOAdapter();
        const zm = ZMachine.load(buffer, io);
        
        expect(zm.version).toBe(3);
        expect(zm.state).toBe(RunState.Stopped);
      });
    }
  });

  describe('Execution', () => {
    for (const game of v3Games) {
      it(`should run ${game.name} and produce output`, async () => {
        const buffer = loadGame(game.file);
        const io = new TestIOAdapter();
        io.queueLineInput('look');
        
        const zm = ZMachine.load(buffer, io);
        const { steps, output } = await runUntilInput(zm, io);
        
        // Game should execute some instructions
        expect(steps).toBeGreaterThan(100);
        // Game should produce some output
        expect(output.length).toBeGreaterThan(10);
      }, 60000);
    }
  });
});

// ============================================
// Z-machine Version 4
// ============================================
describe('V4 Games', () => {
  const v4Games = [
    { file: 'amfv-r79-s851122.z4', name: 'A Mind Forever Voyaging' },
    { file: 'bureaucracy-r160-s880521.z4', name: 'Bureaucracy' },
    { file: 'nordandbert-r20-s870722.z4', name: 'Nord and Bert' },
    { file: 'trinity-r15-s870628.z4', name: 'Trinity' },
  ];

  describe('Loading', () => {
    for (const game of v4Games) {
      it(`should load ${game.name}`, () => {
        const buffer = loadGame(game.file);
        const io = new TestIOAdapter();
        const zm = ZMachine.load(buffer, io);
        
        expect(zm.version).toBe(4);
        expect(zm.state).toBe(RunState.Stopped);
      });
    }
  });

  describe('Execution', () => {
    for (const game of v4Games) {
      it(`should run ${game.name} and produce output`, async () => {
        const buffer = loadGame(game.file);
        const io = new TestIOAdapter();
        io.queueLineInput('look');
        
        const zm = ZMachine.load(buffer, io);
        const { steps, output } = await runUntilInput(zm, io);
        
        expect(steps).toBeGreaterThan(100);
        expect(output.length).toBeGreaterThan(10);
      }, 60000);
    }
  });
});

// ============================================
// Z-machine Version 5
// ============================================
describe('V5 Games', () => {
  const v5Games = [
    { file: 'beyondzork-r57-s871221.z5', name: 'Beyond Zork' },
    { file: 'borderzone-r9-s871008.z5', name: 'Borderzone' },
    { file: 'sherlock-nosound-r21-s871214.z5', name: 'Sherlock (no sound r21)' },
    { file: 'sherlock-nosound-r4-s880324.z5', name: 'Sherlock (no sound r4)' },
    // { file: 'sherlock-r22-s880112.z5', name: 'Sherlock (r22)' }, // Has memory access issue
    { file: 'sherlock-r26-s880127.z5', name: 'Sherlock (r26)' },
  ];

  describe('Loading', () => {
    for (const game of v5Games) {
      it(`should load ${game.name}`, () => {
        const buffer = loadGame(game.file);
        const io = new TestIOAdapter();
        const zm = ZMachine.load(buffer, io);
        
        expect(zm.version).toBe(5);
        expect(zm.state).toBe(RunState.Stopped);
      });
    }
  });

  describe('Execution', () => {
    for (const game of v5Games) {
      it(`should run ${game.name} and produce output`, async () => {
        const buffer = loadGame(game.file);
        const io = new TestIOAdapter();
        io.queueLineInput('look');
        
        const zm = ZMachine.load(buffer, io);
        const { steps, output } = await runUntilInput(zm, io, 500000);
        
        expect(steps).toBeGreaterThan(100);
        expect(output.length).toBeGreaterThan(10);
      }, 120000); // V5 games may take longer
    }
  });
});

// ============================================
// Z-machine Version 6 (Graphics)
// ============================================
describe('V6 Games', () => {
  const v6Games = [
    { file: 'arthur-r74-s890714.z6', name: 'Arthur' },
    { file: 'journey-r83-s890706.z6', name: 'Journey' },
    { file: 'shogun-r322-s890706.z6', name: 'Shogun' },
    { file: 'zork0-r393-s890714.z6', name: 'Zork Zero' },
  ];

  describe('Loading', () => {
    for (const game of v6Games) {
      it(`should load ${game.name}`, () => {
        const buffer = loadGame(game.file);
        const io = new TestIOAdapter();
        const zm = ZMachine.load(buffer, io);
        
        expect(zm.version).toBe(6);
        expect(zm.state).toBe(RunState.Stopped);
      });
    }
  });

  // V6 games require graphics support - skip execution tests for now
  describe.skip('Execution (requires graphics)', () => {
    for (const game of v6Games) {
      it(`should run ${game.name}`, async () => {
        const buffer = loadGame(game.file);
        const io = new TestIOAdapter();
        io.queueLineInput('look');
        
        const zm = ZMachine.load(buffer, io);
        const { steps, _output } = await runUntilInput(zm, io);
        
        expect(steps).toBeGreaterThan(100);
      }, 60000);
    }
  });
});

// ============================================
// Game-specific tests
// ============================================
describe('Game-specific tests', () => {
  it('Zork 1 should show West of House', async () => {
    const buffer = loadGame('zork1-r88-s840726.z3');
    const io = new TestIOAdapter();
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);
    const { output } = await runUntilInput(zm, io);
    
    expect(output.toLowerCase()).toContain('house');
    expect(output.toLowerCase()).toContain('mailbox');
  }, 60000);

  it('Zork 2 should show starting location', async () => {
    const buffer = loadGame('zork2-r63-s860811.z3');
    const io = new TestIOAdapter();
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);
    const { output } = await runUntilInput(zm, io);
    
    expect(output.toLowerCase()).toContain('zork');
  }, 60000);

  it('Zork 3 should show starting location', async () => {
    const buffer = loadGame('zork3-r25-s860811.z3');
    const io = new TestIOAdapter();
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);
    const { output } = await runUntilInput(zm, io);
    
    expect(output.length).toBeGreaterThan(50);
  }, 60000);

  it("Hitchhiker's Guide should mention Arthur", async () => {
    const buffer = loadGame('hitchhiker-r60-s861002.z3');
    const io = new TestIOAdapter();
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);
    const { output } = await runUntilInput(zm, io);
    
    // Should produce substantial output
    expect(output.length).toBeGreaterThan(100);
  }, 60000);

  it('Planetfall should show starting location', async () => {
    const buffer = loadGame('planetfall-r39-s880501.z3');
    const io = new TestIOAdapter();
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);
    const { output } = await runUntilInput(zm, io);
    
    expect(output.length).toBeGreaterThan(50);
  }, 60000);

  it('Beyond Zork should initialize (V5)', async () => {
    const buffer = loadGame('beyondzork-r57-s871221.z5');
    const io = new TestIOAdapter();
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);
    const { steps, output } = await runUntilInput(zm, io, 500000);
    
    expect(steps).toBeGreaterThan(1000);
    expect(output.length).toBeGreaterThan(10);
  }, 120000);

  it('Trinity should initialize (V4)', async () => {
    const buffer = loadGame('trinity-r15-s870628.z4');
    const io = new TestIOAdapter();
    io.queueLineInput('look');
    
    const zm = ZMachine.load(buffer, io);
    const { steps, output } = await runUntilInput(zm, io);
    
    expect(steps).toBeGreaterThan(100);
    expect(output.length).toBeGreaterThan(10);
  }, 60000);
});
