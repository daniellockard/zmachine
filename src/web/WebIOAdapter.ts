/**
 * Web I/O Adapter - Minimal Implementation
 *
 * Browser-based I/O adapter that connects the Z-machine to a web interface.
 *
 * @module
 */

import { IOAdapter, ReadLineResult } from '../io/IOAdapter';
import { ZVersion } from '../types/ZMachineTypes';

/**
 * Configuration for the WebIOAdapter
 */
export interface WebIOConfig {
  /** Element to display game output */
  outputElement: HTMLElement;
  /** Input element for user text */
  inputElement: HTMLInputElement;
  /** Optional element for status line */
  statusElement?: HTMLElement;
}

/**
 * Minimal web-based I/O adapter for browser gameplay
 */
export class WebIOAdapter implements IOAdapter {
  private output: HTMLElement;
  private input: HTMLInputElement;
  private status?: HTMLElement;

  // The resolver for the current readLine promise
  private lineResolver: ((result: ReadLineResult) => void) | null = null;

  constructor(config: WebIOConfig) {
    this.output = config.outputElement;
    this.input = config.inputElement;
    this.status = config.statusElement;

    // Set up the Enter key handler
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.lineResolver) {
        const text = this.input.value;
        this.input.value = '';

        // Echo input to output
        this.print(text + '\n');

        // Resolve the pending readLine promise
        const resolver = this.lineResolver;
        this.lineResolver = null;
        resolver({ text, terminator: 13 });
      }
    });
  }

  initialize(_version: ZVersion): void {
    this.output.innerHTML = '';
  }

  print(text: string): void {
    // Simple text append
    const span = document.createElement('span');
    span.textContent = text;
    this.output.appendChild(span);
    this.output.scrollTop = this.output.scrollHeight;
  }

  printLine(text: string): void {
    this.print(text + '\n');
  }

  newLine(): void {
    this.output.appendChild(document.createElement('br'));
    this.output.scrollTop = this.output.scrollHeight;
  }

  async readLine(maxLength: number, _timeout?: number): Promise<ReadLineResult> {
    // Show prompt
    this.print('>');

    // Focus input
    this.input.focus();
    this.input.maxLength = maxLength;

    // Return a promise that resolves when Enter is pressed
    return new Promise((resolve) => {
      this.lineResolver = resolve;
    });
  }

  async readChar(_timeout?: number): Promise<number> {
    // Simple implementation - wait for any key
    return new Promise((resolve) => {
      const handler = (e: KeyboardEvent): void => {
        const charCode = e.key.length === 1 ? e.key.charCodeAt(0) : 13;
        this.input.removeEventListener('keydown', handler);
        resolve(charCode);
      };
      this.input.addEventListener('keydown', handler);
      this.input.focus();
    });
  }

  showStatusLine(
    location: string,
    scoreOrHours: number,
    turnsOrMinutes: number,
    isTime: boolean
  ): void {
    if (!this.status) return;
    const rightSide = isTime
      ? `Time: ${scoreOrHours}:${turnsOrMinutes.toString().padStart(2, '0')}`
      : `Score: ${scoreOrHours}  Moves: ${turnsOrMinutes}`;
    this.status.textContent = `${location}    ${rightSide}`;
  }

  // Window management - minimal stubs
  splitWindow(_lines: number): void {}
  setWindow(_window: number): void {}
  eraseWindow(_window: number): void {
    if (_window === -1 || _window === 0) {
      this.output.innerHTML = '';
    }
  }
  eraseLine(): void {}
  setCursor(_line: number, _column: number): void {}
  setBufferMode(_mode: boolean): void {}
  setTextStyle(_style: number): void {}
  setColor(_foreground: number, _background: number): void {}

  quit(): void {
    this.print('\n[Game ended]\n');
    this.input.disabled = true;
  }

  restart(): void {
    this.output.innerHTML = '';
  }

  async save(_data: Uint8Array): Promise<boolean> {
    // Simple localStorage save
    try {
      const base64 = btoa(String.fromCharCode(..._data));
      localStorage.setItem('zmachine-save', base64);
      this.print('[Game saved]\n');
      return true;
    } catch {
      this.print('[Save failed]\n');
      return false;
    }
  }

  async restore(): Promise<Uint8Array | null> {
    try {
      const base64 = localStorage.getItem('zmachine-save');
      if (base64) {
        const binary = atob(base64);
        const data = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          data[i] = binary.charCodeAt(i);
        }
        this.print('[Game restored]\n');
        return data;
      }
    } catch {
      // ignore
    }
    this.print('[No saved game found]\n');
    return null;
  }

  soundEffect(_number: number, _effect: number, _volume: number): void {}
  setFont(_font: number): number {
    return 0;
  }
}
