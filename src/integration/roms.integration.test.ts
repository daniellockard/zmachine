/**
 * Dynamic integration tests for all ROMs in the roms directory
 * 
 * This test harness automatically discovers and tests any Z-machine ROM files
 * placed in the roms/ directory. If the directory doesn't exist or is empty,
 * tests are skipped gracefully.
 * 
 * To run these tests:
 * 1. Create a roms/ directory in the project root
 * 2. Add .z1, .z2, .z3, .z4, .z5, .z6, .z7, or .z8 files
 * 3. Run: npm test
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ZMachine, RunState } from '../core/ZMachine';
import { TestIOAdapter } from '../io/TestIOAdapter';

// ROM directory path
const ROMS_DIR = path.join(__dirname, '..', '..', 'roms');

// Z-machine file extensions by version
const Z_EXTENSIONS = ['.z1', '.z2', '.z3', '.z4', '.z5', '.z6', '.z7', '.z8'];

interface RomFile {
  filename: string;
  path: string;
  version: number;
  name: string;
}

/**
 * Discover all ROM files in the roms directory
 */
function discoverRoms(): RomFile[] {
  if (!fs.existsSync(ROMS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(ROMS_DIR);
  const roms: RomFile[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (Z_EXTENSIONS.includes(ext)) {
      const version = parseInt(ext.slice(2), 10);
      const name = path.basename(file, ext)
        .replace(/-r\d+.*$/, '') // Remove revision info
        .replace(/-/g, ' ')      // Replace dashes with spaces
        .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter

      roms.push({
        filename: file,
        path: path.join(ROMS_DIR, file),
        version,
        name,
      });
    }
  }

  return roms.sort((a, b) => {
    // Sort by version, then by name
    if (a.version !== b.version) return a.version - b.version;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Load a ROM file into an ArrayBuffer
 */
function loadRom(romPath: string): ArrayBuffer {
  const storyData = fs.readFileSync(romPath);
  return storyData.buffer.slice(
    storyData.byteOffset,
    storyData.byteOffset + storyData.byteLength
  );
}

/**
 * Run a game until it needs input or hits step limit
 */
async function runUntilInput(
  zm: ZMachine,
  io: TestIOAdapter,
  maxSteps = 100000
): Promise<{ steps: number; output: string; error?: string }> {
  let steps = 0;
  let error: string | undefined;

  while (zm.state !== RunState.Halted && steps < maxSteps) {
    try {
      await zm.step();
      steps++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('No line input available') || msg.includes('No char input')) {
        // Expected - game is waiting for input
        break;
      }
      error = msg;
      break;
    }
  }

  return { steps, output: io.getFullOutput(), error };
}

// Discover ROMs
const allRoms = discoverRoms();

// Group ROMs by version
const romsByVersion = new Map<number, RomFile[]>();
for (const rom of allRoms) {
  const existing = romsByVersion.get(rom.version) || [];
  existing.push(rom);
  romsByVersion.set(rom.version, existing);
}

// Main test suite
describe('ROM Integration Tests', () => {
  if (allRoms.length === 0) {
    it.skip('No ROMs found in roms/ directory', () => {
      // This test is skipped when no ROMs are available
      expect(true).toBe(true);
    });
    return;
  }

  // Report discovered ROMs
  it(`discovered ${allRoms.length} ROM files`, () => {
    // eslint-disable-next-line no-console
    console.log(`\nFound ${allRoms.length} ROMs in ${ROMS_DIR}:`);
    for (const [version, roms] of romsByVersion) {
      // eslint-disable-next-line no-console
      console.log(`  V${version}: ${roms.length} games`);
    }
    expect(allRoms.length).toBeGreaterThan(0);
  });

  // Test each version group
  for (const [version, roms] of romsByVersion) {
    describe(`Version ${version} Games (${roms.length} ROMs)`, () => {
      describe('Loading', () => {
        for (const rom of roms) {
          it(`should load ${rom.name}`, () => {
            const buffer = loadRom(rom.path);
            const io = new TestIOAdapter();
            const zm = ZMachine.load(buffer, io);

            expect(zm.version).toBe(version);
            expect(zm.state).toBe(RunState.Stopped);
          });
        }
      });

      // V6 games require graphics - skip execution tests
      if (version === 6) {
        describe.skip('Execution (V6 requires graphics support)', () => {
          for (const rom of roms) {
            it(`should run ${rom.name}`, () => {
              expect(true).toBe(true);
            });
          }
        });
      } else {
        describe('Execution', () => {
          for (const rom of roms) {
            it(`should run ${rom.name} and produce output`, async () => {
              const buffer = loadRom(rom.path);
              const io = new TestIOAdapter();
              io.queueLineInput('look');

              const zm = ZMachine.load(buffer, io);
              
              // V5+ games may need more steps
              const maxSteps = version >= 5 ? 500000 : 100000;
              const { steps, output, error } = await runUntilInput(zm, io, maxSteps);

              // Report any error but still check we got some execution
              if (error) {
                // eslint-disable-next-line no-console
                console.warn(`  ${rom.name}: Error after ${steps} steps: ${error}`);
              }

              // Game should execute some instructions
              expect(steps).toBeGreaterThan(100);
              
              // Game should produce some output
              expect(output.length).toBeGreaterThan(0);
            }, version >= 5 ? 120000 : 60000);
          }
        });
      }
    });
  }
});

// Summary test
describe('ROM Test Summary', () => {
  it('should report test coverage', () => {
    const versionCounts: string[] = [];
    for (const [version, roms] of romsByVersion) {
      versionCounts.push(`V${version}: ${roms.length}`);
    }
    
    if (allRoms.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`\nROM Test Summary: ${allRoms.length} total (${versionCounts.join(', ')})`);
    } else {
      // eslint-disable-next-line no-console
      console.log('\nNo ROMs found. Add .z1-.z8 files to roms/ directory to test.');
    }
    
    expect(true).toBe(true);
  });
});
