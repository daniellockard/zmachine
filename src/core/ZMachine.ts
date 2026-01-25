/**
 * Z-Machine
 * 
 * The main class that ties together all Z-machine components.
 * This is the primary interface for running Z-machine games.
 * 
 * Usage:
 * ```typescript
 * const io = new WebIOAdapter(/* ... *\/);
 * const zm = await ZMachine.load(storyData, io);
 * await zm.run();
 * ```
 * 
 * Reference: Z-Machine Specification
 * 
 * @module
 */

import { ByteAddress, ZVersion } from '../types/ZMachineTypes';
import { Memory } from './memory/Memory';
import { Header } from './memory/Header';
import { Stack } from './cpu/Stack';
import { Variables } from './variables/Variables';
import { Decoder } from './instructions/Decoder';
import { Executor } from './execution/Executor';
import { ObjectTable } from './objects/ObjectTable';
import { Properties } from './objects/Properties';
import { Dictionary } from './dictionary/Dictionary';
import { Tokenizer } from './dictionary/Tokenizer';
import { ZCharDecoder } from './text/ZCharDecoder';
import { IOAdapter } from '../io/IOAdapter';

/**
 * Z-Machine run state
 */
export enum RunState {
  /** Not started yet */
  Stopped = 'stopped',
  /** Running normally */
  Running = 'running',
  /** Waiting for user input */
  WaitingForInput = 'waiting',
  /** Game has ended (quit or restart) */
  Halted = 'halted',
}

/**
 * The Z-Machine virtual machine
 */
export class ZMachine {
  readonly memory: Memory;
  readonly header: Header;
  readonly stack: Stack;
  readonly variables: Variables;
  readonly decoder: Decoder;
  readonly executor: Executor;
  readonly objectTable: ObjectTable;
  readonly properties: Properties;
  readonly dictionary: Dictionary;
  readonly tokenizer: Tokenizer;
  readonly textDecoder: ZCharDecoder;
  readonly io: IOAdapter;

  readonly version: ZVersion;

  private _pc: ByteAddress;
  private _state: RunState = RunState.Stopped;

  /** Original story data for restart */
  private readonly originalStory: ArrayBuffer;

  /**
   * Create a new Z-Machine instance
   * 
   * @param storyData The story file data
   * @param io The I/O adapter for input/output
   */
  constructor(storyData: ArrayBuffer, io: IOAdapter) {
    // Keep original for restart
    this.originalStory = storyData.slice(0);

    this.memory = new Memory(storyData);
    this.header = new Header(this.memory);
    this.version = this.header.version as ZVersion;
    this.io = io;

    // Validate version
    if (this.version < 1 || this.version > 8) {
      throw new Error(`Unsupported Z-machine version: ${this.version}`);
    }

    // Initialize components
    this.stack = new Stack();
    this.stack.initialize(0); // No locals at top level

    this.variables = new Variables(
      this.memory,
      this.stack,
      this.header.globalsAddress
    );

    this.textDecoder = new ZCharDecoder(
      this.memory,
      this.version,
      this.header.abbreviationsAddress
    );

    this.decoder = new Decoder(this.memory, this.version);
    this.decoder.setTextDecoder((addr) => this.textDecoder.decode(addr));

    this.executor = new Executor(
      this.memory,
      this.header,
      this.stack,
      this.variables,
      this.version,
      io,
      this.textDecoder
    );

    this.objectTable = new ObjectTable(
      this.memory,
      this.version,
      this.header.objectTableAddress
    );

    this.properties = new Properties(
      this.memory,
      this.version,
      this.objectTable
    );

    this.dictionary = new Dictionary(
      this.memory,
      this.version,
      this.header.dictionaryAddress
    );

    this.tokenizer = new Tokenizer(
      this.memory,
      this.version,
      this.dictionary
    );

    // Initialize PC
    this._pc = this.header.initialPC;
  }

  /**
   * Load a Z-machine story file
   * 
   * @param storyData The story file data (ArrayBuffer or Uint8Array)
   * @param io The I/O adapter
   * @returns A new ZMachine instance
   */
  static load(storyData: ArrayBuffer | Uint8Array, io: IOAdapter): ZMachine {
    let buffer: ArrayBuffer;
    if (storyData instanceof Uint8Array) {
      // Copy to a new ArrayBuffer to handle SharedArrayBuffer case
      buffer = new ArrayBuffer(storyData.byteLength);
      new Uint8Array(buffer).set(storyData);
    } else {
      buffer = storyData;
    }

    return new ZMachine(buffer, io);
  }

  /**
   * Current program counter
   */
  get pc(): ByteAddress {
    return this._pc;
  }

  /**
   * Current run state
   */
  get state(): RunState {
    return this._state;
  }

  /**
   * Run the Z-machine until it halts or needs input
   * 
   * @returns The run state when execution pauses
   */
  async run(): Promise<RunState> {
    this._state = RunState.Running;

    while (this._state === RunState.Running) {
      await this.step();
    }

    return this._state;
  }

  /**
   * Execute a single instruction
   */
  async step(): Promise<void> {
    if (this._state === RunState.Halted) {
      return;
    }

    // Decode instruction at current PC
    const instruction = this.decoder.decode(this._pc);

    // Execute instruction
    const result = await this.executor.execute(instruction);

    // Handle result
    if (result.halted) {
      this._state = RunState.Halted;
      return;
    }

    if (result.waitingForInput) {
      this._state = RunState.WaitingForInput;
      return;
    }

    // Update PC
    if (result.jumpTo !== undefined) {
      this._pc = result.jumpTo;
    } else if (result.nextPC !== undefined) {
      this._pc = result.nextPC;
    } else {
      // Should not happen - advance by instruction length as fallback
      this._pc = instruction.address + instruction.length;
    }
  }

  /**
   * Provide input when waiting for it
   * 
   * Note: This is an alternative push-based API for input.
   * The primary path is through IOAdapter.readLine() which is
   * called by the read opcodes and awaited asynchronously.
   * 
   * @param _input The input text (currently unused - reserved for future use)
   */
  async provideInput(_input: string): Promise<void> {
    if (this._state !== RunState.WaitingForInput) {
      throw new Error('Not waiting for input');
    }

    // The actual input handling happens through IOAdapter.readLine()
    // which the read opcode awaits. This method is reserved for
    // potential push-based input scenarios.
    
    this._state = RunState.Running;
  }

  /**
   * Restart the game
   */
  restart(): void {
    // Re-copy dynamic memory from original
    const dynamicEnd = this.header.staticMemoryBase;
    for (let i = 0; i < dynamicEnd; i++) {
      const original = new DataView(this.originalStory);
      this.memory.writeByte(i, original.getUint8(i));
    }

    // Reset stack
    this.stack.clear();
    this.stack.initialize(0);

    // Reset PC
    this._pc = this.header.initialPC;
    this._state = RunState.Stopped;
  }

  /**
   * Get an object's short name
   */
  getObjectName(objectNum: number): string {
    const nameInfo = this.objectTable.getShortNameAddress(objectNum);
    if (nameInfo.lengthBytes === 0) {
      return '';
    }
    const result = this.textDecoder.decode(nameInfo.address);
    return result.text;
  }

  /**
   * Print text at an address
   */
  printText(address: ByteAddress): string {
    const result = this.textDecoder.decode(address);
    return result.text;
  }

  /**
   * Look up a word in the dictionary
   */
  lookupWord(word: string): ByteAddress {
    const tokens = this.tokenizer.tokenize(word);
    if (tokens.length === 0) {
      return 0;
    }
    return tokens[0].dictionaryAddress;
  }
}
