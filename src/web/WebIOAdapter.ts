/**
 * Web I/O Adapter
 *
 * Browser-based I/O adapter that connects the Z-machine to a web interface.
 * Uses DOM elements for output and captures keyboard input.
 *
 * @module
 */

import { IOAdapter, ReadLineResult } from '../io/IOAdapter';
import { TextStyle, ZColor, ZVersion, ZWindow } from '../types/ZMachineTypes';

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
  /** Optional callback when game quits */
  onQuit?: () => void;
  /** Optional callback when game restarts */
  onRestart?: () => void;
  /** Optional callback when game is waiting for input */
  onWaitingForInput?: () => void;
  /** Optional callback before processing input - receives the command text */
  onBeforeInput?: (text: string) => void;
}

/**
 * Web-based I/O adapter for browser gameplay
 */
export class WebIOAdapter implements IOAdapter {
  private output: HTMLElement;
  private input: HTMLInputElement;
  private status?: HTMLElement;
  private onQuit?: () => void;
  private onRestart?: () => void;
  private onWaitingForInput?: () => void;
  private onBeforeInput?: (text: string) => void;

  private lineResolve?: (result: ReadLineResult) => void;
  private charResolve?: (char: number) => void;
  private currentVersion: ZVersion = 3;

  /** Current active window (0 = lower/main, 1 = upper/status) */
  private currentWindow: number = 0;

  /** Number of lines in upper window */
  private upperWindowLineCount: number = 0;

  /** Get current version */
  getVersion(): ZVersion {
    return this.currentVersion;
  }

  /** Get upper window line count */
  getUpperWindowLines(): number {
    return this.upperWindowLineCount;
  }

  /** Buffer for upper window text (V4+ games write directly) */
  private upperWindowText: string = '';

  /** Current text style (bitmask: 1=reverse, 2=bold, 4=italic, 8=fixed) */
  private textStyle: number = 0;

  /** Cursor position in upper window (1-based) */
  private upperCursor: { line: number; column: number } = { line: 1, column: 1 };

  /** Transcript buffer for recording game session */
  private transcript: string[] = [];

  /** Whether transcript is currently enabled */
  private transcriptEnabled: boolean = false;

  /** Recorded inputs for playback */
  private recordedInputs: string[] = [];

  /** Whether recording is enabled */
  private isRecording: boolean = false;

  /** Playback queue for replaying recorded inputs */
  private playbackQueue: string[] = [];

  /** Whether playback mode is active */
  private isPlayingBack: boolean = false;

  constructor(config: WebIOConfig) {
    this.output = config.outputElement;
    this.input = config.inputElement;
    this.status = config.statusElement;
    this.onQuit = config.onQuit;
    this.onRestart = config.onRestart;
    this.onWaitingForInput = config.onWaitingForInput;
    this.onBeforeInput = config.onBeforeInput;

    this.setupInputHandler();
  }

  private setupInputHandler(): void {
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.lineResolve) {
        const text = this.input.value;
        this.input.value = '';
        // eslint-disable-next-line no-console
        console.log(`[WebIO] Enter pressed, resolving with: "${text}"`);

        // Notify before processing (for map tracking)
        if (this.onBeforeInput) {
          this.onBeforeInput(text);
        }

        // Record input if recording
        if (this.isRecording) {
          this.recordedInputs.push(text);
        }

        // Echo input to output
        this.print(text + '\n');

        const resolver = this.lineResolve;
        this.lineResolve = undefined;
        resolver({ text, terminator: 13 });
        // eslint-disable-next-line no-console
        console.log(`[WebIO] Resolver returned`);
      } else if (this.charResolve) {
        // Single character input
        const charCode = e.key.length === 1 ? e.key.charCodeAt(0) : 0;
        if (charCode > 0) {
          e.preventDefault();
          this.charResolve(charCode);
          this.charResolve = undefined;
        }
      }
    });
  }

  initialize(version: ZVersion): void {
    this.currentVersion = version;
    this.output.innerHTML = '';
    this.transcript = [];
    this.recordedInputs = [];
  }

  print(text: string): void {
    // Capture transcript if enabled
    if (this.transcriptEnabled) {
      this.transcript.push(text);
    }

    // Route output based on current window
    if (this.currentWindow === ZWindow.UPPER && this.status) {
      // Upper window (status line area) - buffer text for display
      this.upperWindowText += text;
      // Update status element with the buffered text
      // Strip newlines and show as single line
      this.status.textContent = this.upperWindowText.replace(/\n/g, ' ').trim();
    } else {
      // Lower window (main output)
      // Use document fragment for batched DOM operations
      const fragment = document.createDocumentFragment();

      // Split text on newlines to handle them separately
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 0) {
          const span = document.createElement('span');
          span.textContent = lines[i];
          this.applyTextStyle(span);
          fragment.appendChild(span);
        }
        // Add line break for all newlines except trailing one
        if (i < lines.length - 1) {
          fragment.appendChild(document.createElement('br'));
        }
      }

      // Single DOM append for all elements
      this.output.appendChild(fragment);

      // Auto-scroll to bottom (single reflow)
      this.output.scrollTop = this.output.scrollHeight;
    }
  }

  /**
   * Apply current text style and colors to an element
   * Style bits: 1=reverse, 2=bold, 4=italic, 8=fixed-width
   */
  private applyTextStyle(element: HTMLElement): void {
    // Apply colors (unless reverse video is set, which swaps them)
    if (!(this.textStyle & TextStyle.REVERSE_VIDEO)) {
      if (this.foregroundColor) {
        element.style.color = this.foregroundColor;
      }
      if (this.backgroundColor) {
        element.style.backgroundColor = this.backgroundColor;
      }
    }

    if (this.textStyle & TextStyle.REVERSE_VIDEO) {
      // Reverse video - swap foreground and background
      const fg = this.foregroundColor || 'var(--text-color, #00ff00)';
      const bg = this.backgroundColor || 'var(--bg-color, #0a0a0a)';
      element.style.backgroundColor = fg;
      element.style.color = bg;
    }
    if (this.textStyle & TextStyle.BOLD) {
      // Bold
      element.style.fontWeight = 'bold';
    }
    if (this.textStyle & TextStyle.ITALIC) {
      // Italic
      element.style.fontStyle = 'italic';
    }
    if (this.textStyle & TextStyle.FIXED_PITCH) {
      // Fixed-width (already monospace, but ensure it)
      element.style.fontFamily = 'monospace';
    }
  }

  printLine(text: string): void {
    this.print(text + '\n');
  }

  newLine(): void {
    this.output.appendChild(document.createElement('br'));
    this.output.scrollTop = this.output.scrollHeight;
  }

  /** Pending readLine promise for serialization */
  private pendingReadLine: Promise<ReadLineResult> | null = null;

  async readLine(maxLength: number, timeout?: number): Promise<ReadLineResult> {
    // GUARD: If we already have a pending readLine, wait for it first
    if (this.pendingReadLine) {
      await this.pendingReadLine;
    }

    // Create the actual readLine promise
    this.pendingReadLine = this.doReadLine(maxLength, timeout);
    try {
      return await this.pendingReadLine;
    } finally {
      this.pendingReadLine = null;
    }
  }

  private async doReadLine(maxLength: number, timeout?: number): Promise<ReadLineResult> {
    // Check for playback mode - automatically provide next input
    if (this.isPlayingBack && this.playbackQueue.length > 0) {
      const text = this.playbackQueue.shift()!;
      this.print('>' + text + '\n');
      // Small delay to make playback visible
      await new Promise((r) => setTimeout(r, 100));
      return { text, terminator: 13 };
    }

    // Notify that we're waiting for input (used by map tracker)
    if (this.onWaitingForInput) {
      this.onWaitingForInput();
    }

    // Show prompt
    this.print('>');

    // Focus input and wait for Enter
    this.input.focus();
    this.input.maxLength = maxLength;

    return new Promise((resolve) => {
      this.lineResolve = resolve;

      // Timeout support: timeout is in tenths of a second
      if (timeout && timeout > 0) {
        const timeoutMs = timeout * 100;
        setTimeout(() => {
          if (this.lineResolve === resolve) {
            // Return current text with 0 terminator (timeout)
            const text = this.input.value;
            this.input.value = '';
            this.lineResolve = undefined;
            resolve({ text, terminator: 0 });
          }
        }, timeoutMs);
      }
    });
  }

  async readChar(timeout?: number): Promise<number> {
    this.input.focus();

    return new Promise((resolve) => {
      this.charResolve = resolve;

      // Timeout support: timeout is in tenths of a second
      if (timeout && timeout > 0) {
        const timeoutMs = timeout * 100;
        setTimeout(() => {
          if (this.charResolve === resolve) {
            // Return 0 for timeout
            this.charResolve = undefined;
            resolve(0);
          }
        }, timeoutMs);
      }
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

    this.status.innerHTML = `
      <span class="location">${this.escapeHtml(location)}</span>
      <span class="score">${rightSide}</span>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setWindow(window: number): void {
    // When switching windows, clear upper window buffer if switching TO upper window
    if (window === ZWindow.UPPER && this.currentWindow !== ZWindow.UPPER) {
      this.upperWindowText = '';
    }
    this.currentWindow = window;
  }

  splitWindow(lines: number): void {
    this.upperWindowLineCount = lines;
    // Clear upper window when resizing
    if (lines > 0) {
      this.upperWindowText = '';
      this.upperCursor = { line: 1, column: 1 };
      if (this.status) {
        this.status.textContent = '';
      }
    }
  }

  setCursor(line: number, column: number): void {
    // Cursor positioning only applies to upper window
    if (this.currentWindow === ZWindow.UPPER) {
      this.upperCursor = { line, column };
      // When cursor moves to column 1, reset the line text
      if (column === 1) {
        this.upperWindowText = '';
      }
    }
  }

  getCursor(): { line: number; column: number } {
    return { ...this.upperCursor };
  }

  eraseLine(): void {
    // Erase from cursor to end of line in upper window
    if (this.currentWindow === ZWindow.UPPER && this.status) {
      // For simple implementation, just clear the pending text
      // A full implementation would need to track line content
      this.upperWindowText = '';
    }
  }

  setTextStyle(style: number): void {
    // Style 0 (ROMAN) resets to roman, otherwise styles are cumulative (bitmask)
    if (style === TextStyle.ROMAN) {
      this.textStyle = TextStyle.ROMAN;
    } else {
      this.textStyle = style;
    }
  }

  /**
   * Z-machine color palette mapping ZColor constants to CSS hex colors.
   * Colors 0 (CURRENT) and 1 (DEFAULT) are handled specially.
   */
  private static readonly COLORS: Record<number, string> = {
    [ZColor.BLACK]: '#000000',
    [ZColor.RED]: '#ff0000',
    [ZColor.GREEN]: '#00ff00',
    [ZColor.YELLOW]: '#ffff00',
    [ZColor.BLUE]: '#0000ff',
    [ZColor.MAGENTA]: '#ff00ff',
    [ZColor.CYAN]: '#00ffff',
    [ZColor.WHITE]: '#ffffff',
    [ZColor.LIGHT_GREY]: '#c0c0c0',
    [ZColor.MEDIUM_GREY]: '#808080',
    [ZColor.DARK_GREY]: '#404040',
  };

  /** Current foreground color (CSS) */
  private foregroundColor: string = '';

  /** Current background color (CSS) */
  private backgroundColor: string = '';

  setForegroundColor(color: number): void {
    if (color === ZColor.DEFAULT) {
      // Reset to default
      this.foregroundColor = '';
    } else if (color in WebIOAdapter.COLORS) {
      this.foregroundColor = WebIOAdapter.COLORS[color];
    }
  }

  setBackgroundColor(color: number): void {
    if (color === ZColor.DEFAULT) {
      // Reset to default
      this.backgroundColor = '';
    } else if (color in WebIOAdapter.COLORS) {
      this.backgroundColor = WebIOAdapter.COLORS[color];
    }
  }

  /** Audio context for sound effects (lazy initialized) */
  private audioContext?: AudioContext;

  /**
   * Play a sound effect
   * @param number - Sound number (1 = high beep, 2 = low beep, 3+ = sampled sounds)
   * @param effect - Effect type (1 = prepare, 2 = start, 3 = stop, 4 = finish)
   * @param volume - Volume (1-8, or 255 for default)
   */
  soundEffect(number: number, effect: number, volume: number): void {
    // Only handle basic beeps (1 = high, 2 = low)
    // Effect 2 = start/play
    if (effect !== 2) return;
    if (number !== 1 && number !== 2) return;

    try {
      // Lazy init audio context (must be after user interaction)
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const ctx = this.audioContext;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Frequency: high beep = 800Hz, low beep = 400Hz
      oscillator.frequency.value = number === 1 ? 800 : 400;
      oscillator.type = 'square';

      // Volume: convert 1-8 scale to 0-1
      const vol = volume === 255 ? 0.3 : Math.min(volume / 8, 1) * 0.5;
      gainNode.gain.value = vol;

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Short beep duration
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio not available, ignore
    }
  }

  eraseWindow(window: number): void {
    if (window === -1) {
      // Unsplit and clear all
      this.output.innerHTML = '';
      this.upperWindowText = '';
      if (this.status) this.status.textContent = '';
      this.upperWindowLineCount = 0;
      this.currentWindow = 0;
    } else if (window === -2) {
      // Clear all, keep split
      this.output.innerHTML = '';
      this.upperWindowText = '';
      if (this.status) this.status.textContent = '';
    } else if (window === 0) {
      this.output.innerHTML = '';
    } else if (window === 1) {
      this.upperWindowText = '';
      if (this.status) this.status.textContent = '';
    }
  }

  quit(): void {
    this.print('\n[Game ended]\n');
    this.input.disabled = true;
    this.onQuit?.();
  }

  restart(): void {
    // Just clear the output - the Z-machine handles restarting internally
    // via the restart opcode which resets memory and PC
    // DO NOT call onRestart here - that's for external restart requests only
    this.output.innerHTML = '';
  }

  // Save/restore through browser file download/upload
  async save(data: Uint8Array): Promise<boolean> {
    try {
      // Create a Blob from the save data (use slice to ensure plain ArrayBuffer)
      const buffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `zmachine-save-${Date.now()}.qzl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also store in localStorage as backup
      const base64 = btoa(String.fromCharCode(...data));
      localStorage.setItem('zmachine-save', base64);

      this.print('[Game saved]\n');
      return true;
    } catch {
      this.print('[Save failed]\n');
      return false;
    }
  }

  async restore(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      // Create file input for upload
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.qzl,.sav';

      fileInput.onchange = async (): Promise<void> => {
        const file = fileInput.files?.[0];
        if (file) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            this.print('[Game restored]\n');
            resolve(data);
          } catch {
            this.print('[Restore failed]\n');
            resolve(null);
          }
        } else {
          // User cancelled - try localStorage backup
          const base64 = localStorage.getItem('zmachine-save');
          if (base64) {
            try {
              const binary = atob(base64);
              const data = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                data[i] = binary.charCodeAt(i);
              }
              this.print('[Game restored from backup]\n');
              resolve(data);
            } catch {
              this.print('[No saved game found]\n');
              resolve(null);
            }
          } else {
            this.print('[No saved game found]\n');
            resolve(null);
          }
        }
      };

      // Trigger file selection
      fileInput.click();
    });
  }

  /**
   * Set output stream state
   * @param stream - Stream number (1=screen, 2=transcript, 3=memory, 4=script)
   * @param enabled - Whether to enable or disable the stream
   */
  setOutputStream(stream: number, enabled: boolean): void {
    if (stream === 2) {
      // Transcript stream
      this.transcriptEnabled = enabled;
      if (enabled && this.transcript.length === 0) {
        this.transcript.push(`--- Transcript started: ${new Date().toLocaleString()} ---\n\n`);
      }
    }
  }

  /**
   * Check if transcript is enabled
   */
  isTranscriptEnabled(): boolean {
    return this.transcriptEnabled;
  }

  /**
   * Download the transcript as a text file
   */
  downloadTranscript(): void {
    const text = this.transcript.join('');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `zmachine-transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.print('[Transcript downloaded]\n');
  }

  /**
   * Get transcript content as string
   */
  getTranscript(): string {
    return this.transcript.join('');
  }

  // ============================================
  // Input Recording & Playback
  // ============================================

  /**
   * Start recording user inputs
   */
  startRecording(): void {
    this.isRecording = true;
    this.recordedInputs = [];
    this.print('[Recording started]\n');
  }

  /**
   * Stop recording user inputs
   */
  stopRecording(): void {
    this.isRecording = false;
    this.print(`[Recording stopped - ${this.recordedInputs.length} commands captured]\n`);
  }

  /**
   * Check if recording is active
   */
  isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get the recorded inputs
   */
  getRecordedInputs(): string[] {
    return [...this.recordedInputs];
  }

  /**
   * Download recorded inputs as a JSON file
   */
  downloadRecording(): void {
    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      commands: this.recordedInputs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `zmachine-recording-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.print('[Recording downloaded]\n');
  }

  /**
   * Load a recording for playback
   * @param commands - Array of command strings to play back
   */
  loadPlayback(commands: string[]): void {
    this.playbackQueue = [...commands];
    this.isPlayingBack = true;
    this.print(`[Playback loaded - ${commands.length} commands queued]\n`);
  }

  /**
   * Load playback from a file
   * @returns Promise that resolves when file is loaded
   */
  async loadPlaybackFromFile(): Promise<boolean> {
    return new Promise((resolve) => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';

      fileInput.onchange = async (): Promise<void> => {
        const file = fileInput.files?.[0];
        if (file) {
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.commands && Array.isArray(data.commands)) {
              this.loadPlayback(data.commands);
              resolve(true);
            } else {
              this.print('[Invalid recording file]\n');
              resolve(false);
            }
          } catch {
            this.print('[Failed to load recording]\n');
            resolve(false);
          }
        } else {
          resolve(false);
        }
      };

      fileInput.click();
    });
  }

  /**
   * Stop playback mode
   */
  stopPlayback(): void {
    this.isPlayingBack = false;
    this.playbackQueue = [];
    this.print('[Playback stopped]\n');
  }

  /**
   * Check if playback is active
   */
  isPlaybackActive(): boolean {
    return this.isPlayingBack && this.playbackQueue.length > 0;
  }

  /**
   * Get remaining commands in playback queue
   */
  getPlaybackRemaining(): number {
    return this.playbackQueue.length;
  }
}
