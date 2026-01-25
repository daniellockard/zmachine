/**
 * Z-Machine Runner
 * 
 * High-level runner that manages the Z-machine execution loop.
 * Handles async I/O operations and provides a clean interface for the web UI.
 * 
 * @module
 */

import { ZMachine, RunState } from '../core/ZMachine';
import { IOAdapter } from '../io/IOAdapter';

export type RunnerState = 'stopped' | 'running' | 'waiting-input' | 'error';

export interface RunnerConfig {
  storyData: ArrayBuffer;
  io: IOAdapter;
  onStateChange?: (state: RunnerState) => void;
  onError?: (error: Error) => void;
}

/**
 * Manages Z-machine execution with async I/O
 */
export class ZMachineRunner {
  private machine: ZMachine;
  private _state: RunnerState = 'stopped';
  private onStateChange?: (state: RunnerState) => void;
  private onError?: (error: Error) => void;

  constructor(config: RunnerConfig) {
    this.onStateChange = config.onStateChange;
    this.onError = config.onError;

    // Create Z-machine with the story data
    this.machine = new ZMachine(config.storyData, config.io);
  }

  /**
   * Get the current runner state
   */
  getState(): RunnerState {
    return this._state;
  }

  /**
   * Get the Z-machine instance
   */
  getMachine(): ZMachine {
    return this.machine;
  }

  /**
   * Start running the Z-machine
   */
  async run(): Promise<void> {
    this.setState('running');

    try {
      // Run the machine - this handles its own async loop
      const state = await this.machine.run();

      // Map Z-machine state to runner state
      switch (state) {
        case RunState.Halted:
          this.setState('stopped');
          break;
        case RunState.WaitingForInput:
          this.setState('waiting-input');
          break;
        default:
          this.setState('stopped');
      }
    } catch (error) {
      this.setState('error');
      if (error instanceof Error) {
        this.onError?.(error);
      } else {
        this.onError?.(new Error(String(error)));
      }
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.setState('stopped');
  }

  /**
   * Restart the game
   */
  restart(): void {
    this.machine.restart();
  }

  private setState(state: RunnerState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }
}
