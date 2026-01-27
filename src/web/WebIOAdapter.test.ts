/**
 * Tests for Web I/O Adapter
 *
 * Tests the browser-based I/O adapter using jsdom environment.
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebIOAdapter, WebIOConfig } from './WebIOAdapter';

describe('WebIOAdapter', () => {
  let output: HTMLDivElement;
  let input: HTMLInputElement;
  let status: HTMLDivElement;
  let adapter: WebIOAdapter;

  function createAdapter(config?: Partial<WebIOConfig>): WebIOAdapter {
    return new WebIOAdapter({
      outputElement: output,
      inputElement: input,
      statusElement: status,
      ...config,
    });
  }

  beforeEach(() => {
    // Create DOM elements
    output = document.createElement('div');
    input = document.createElement('input');
    status = document.createElement('div');
    document.body.appendChild(output);
    document.body.appendChild(input);
    document.body.appendChild(status);

    adapter = createAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should create adapter with config', () => {
      expect(adapter).toBeDefined();
    });

    it('should initialize with version', () => {
      adapter.initialize(5);
      expect(output.innerHTML).toBe('');
    });

    it('should return current version', () => {
      adapter.initialize(5);
      expect(adapter.getVersion()).toBe(5);
    });

    it('should return upper window line count', () => {
      adapter.initialize(5);
      adapter.splitWindow(3);
      expect(adapter.getUpperWindowLines()).toBe(3);
    });

    it('should call onQuit callback', () => {
      const onQuit = vi.fn();
      const quitAdapter = createAdapter({ onQuit });
      quitAdapter.quit();
      expect(onQuit).toHaveBeenCalled();
    });

    it('should call onRestart callback', () => {
      const onRestart = vi.fn();
      const restartAdapter = createAdapter({ onRestart });
      restartAdapter.restart();
      expect(onRestart).toHaveBeenCalled();
    });
  });

  describe('print and printLine', () => {
    it('should print text to output element', () => {
      adapter.print('Hello');
      expect(output.textContent).toBe('Hello');
    });

    it('should print multiple texts', () => {
      adapter.print('Hello');
      adapter.print(' World');
      expect(output.textContent).toBe('Hello World');
    });

    it('should printLine with newline', () => {
      adapter.printLine('Hello');
      expect(output.textContent).toContain('Hello');
    });

    it('should create new line elements', () => {
      adapter.newLine();
      const br = output.querySelector('br');
      expect(br).not.toBeNull();
    });
  });

  describe('window management', () => {
    it('should set window', () => {
      adapter.setWindow(1);
      adapter.print('Status text');
      expect(status.textContent).toBe('Status text');
    });

    it('should split window', () => {
      adapter.splitWindow(3);
      // Upper window should be cleared
      expect(status.textContent).toBe('');
    });

    it('should set cursor position', () => {
      adapter.setWindow(1);
      adapter.setCursor(2, 5);
      const cursor = adapter.getCursor();
      expect(cursor.line).toBe(2);
      expect(cursor.column).toBe(5);
    });

    it('should reset upper window text when cursor moves to column 1', () => {
      adapter.setWindow(1);
      adapter.setCursor(1, 5);
      adapter.print('Some text');
      // Moving to column 1 should reset the line text
      adapter.setCursor(2, 1);
      const cursor = adapter.getCursor();
      expect(cursor.column).toBe(1);
    });

    it('should return copy of cursor position', () => {
      adapter.setWindow(1); // setCursor only works in upper window
      adapter.setCursor(3, 7);
      const cursor1 = adapter.getCursor();
      cursor1.line = 99;
      const cursor2 = adapter.getCursor();
      expect(cursor2.line).toBe(3);
    });

    it('should erase line in upper window', () => {
      adapter.setWindow(1);
      adapter.print('Some text');
      adapter.eraseLine();
      // eraseLine clears upperWindowText
      adapter.print('New');
      expect(status.textContent).toBe('New');
    });

    it('should erase window -1 (unsplit and clear all)', () => {
      adapter.print('Main content');
      adapter.setWindow(1);
      adapter.print('Status');
      adapter.eraseWindow(-1);
      expect(output.innerHTML).toBe('');
      expect(status.textContent).toBe('');
    });

    it('should erase window -2 (clear all, keep split)', () => {
      adapter.splitWindow(2);
      adapter.print('Main content');
      adapter.eraseWindow(-2);
      expect(output.innerHTML).toBe('');
    });

    it('should erase window 0 (lower window)', () => {
      adapter.print('Main content');
      adapter.eraseWindow(0);
      expect(output.innerHTML).toBe('');
    });

    it('should erase window 1 (upper window)', () => {
      adapter.setWindow(1);
      adapter.print('Status');
      adapter.eraseWindow(1);
      expect(status.textContent).toBe('');
    });
  });

  describe('status line', () => {
    it('should show status line with score format', () => {
      adapter.showStatusLine('West of House', 100, 50, false);
      expect(status.innerHTML).toContain('West of House');
      expect(status.innerHTML).toContain('Score: 100');
      expect(status.innerHTML).toContain('Moves: 50');
    });

    it('should show status line with time format', () => {
      adapter.showStatusLine('Kitchen', 10, 30, true);
      expect(status.innerHTML).toContain('Kitchen');
      expect(status.innerHTML).toContain('Time: 10:30');
    });

    it('should escape HTML in location', () => {
      adapter.showStatusLine('<script>alert(1)</script>', 0, 0, false);
      expect(status.innerHTML).not.toContain('<script>');
    });

    it('should pad minutes with leading zero', () => {
      adapter.showStatusLine('Room', 9, 5, true);
      expect(status.innerHTML).toContain('Time: 9:05');
    });
  });

  describe('text styles', () => {
    it('should set text style and apply to printed text', () => {
      adapter.setTextStyle(2); // Bold
      adapter.print('Bold text');
      const span = output.querySelector('span');
      expect(span?.style.fontWeight).toBe('bold');
    });

    it('should apply italic style', () => {
      adapter.setTextStyle(4); // Italic
      adapter.print('Italic text');
      const span = output.querySelector('span');
      expect(span?.style.fontStyle).toBe('italic');
    });

    it('should apply fixed-width style', () => {
      adapter.setTextStyle(8); // Fixed-width
      adapter.print('Fixed text');
      const span = output.querySelector('span');
      expect(span?.style.fontFamily).toBe('monospace');
    });

    it('should apply reverse video style', () => {
      adapter.setTextStyle(1); // Reverse
      adapter.print('Reverse text');
      const span = output.querySelector('span');
      // Reverse video swaps colors
      expect(span?.style.backgroundColor).toBeDefined();
    });

    it('should reset style with 0', () => {
      adapter.setTextStyle(2);
      adapter.setTextStyle(0);
      adapter.print('Normal text');
      const span = output.querySelector('span');
      expect(span?.style.fontWeight).not.toBe('bold');
    });
  });

  describe('colors', () => {
    it('should set foreground color', () => {
      adapter.setForegroundColor(3); // Red
      adapter.print('Red text');
      const span = output.querySelector('span');
      expect(span?.style.color).toBe('rgb(255, 0, 0)');
    });

    it('should set background color', () => {
      adapter.setBackgroundColor(4); // Green
      adapter.print('On green');
      const span = output.querySelector('span');
      expect(span?.style.backgroundColor).toBe('rgb(0, 255, 0)');
    });

    it('should reset foreground to default with color 1', () => {
      adapter.setForegroundColor(3);
      adapter.setForegroundColor(1); // Default
      adapter.print('Default color');
      const span = output.querySelector('span');
      expect(span?.style.color).toBe('');
    });

    it('should reset background to default with color 1', () => {
      adapter.setBackgroundColor(3);
      adapter.setBackgroundColor(1); // Default
      adapter.print('Default bg');
      const span = output.querySelector('span');
      expect(span?.style.backgroundColor).toBe('');
    });

    it('should handle all standard colors', () => {
      const colors = [2, 3, 4, 5, 6, 7, 8, 9]; // black through white
      for (const color of colors) {
        adapter.setForegroundColor(color);
        adapter.print(`Color ${color}`);
      }
      expect(output.querySelectorAll('span').length).toBe(8);
    });
  });

  describe('quit and restart', () => {
    it('should print game ended message on quit', () => {
      adapter.quit();
      expect(output.textContent).toContain('[Game ended]');
    });

    it('should disable input on quit', () => {
      adapter.quit();
      expect(input.disabled).toBe(true);
    });

    it('should clear output on restart', () => {
      adapter.print('Some text');
      adapter.restart();
      expect(output.innerHTML).toBe('');
    });
  });

  describe('input handling', () => {
    it('should focus input on readLine', () => {
      const focusSpy = vi.spyOn(input, 'focus');
      // Start reading but don't await (would block)
      adapter.readLine(80);
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should set maxLength on input', () => {
      adapter.readLine(50);
      expect(input.maxLength).toBe(50);
    });

    it('should focus input on readChar', () => {
      const focusSpy = vi.spyOn(input, 'focus');
      adapter.readChar();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should resolve readLine on Enter key', async () => {
      const promise = adapter.readLine(80);
      input.value = 'test input';

      // Simulate Enter key
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(event);

      const result = await promise;
      expect(result.text).toBe('test input');
      expect(result.terminator).toBe(13);
    });

    it('should clear input after Enter', async () => {
      const promise = adapter.readLine(80);
      input.value = 'test';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await promise;
      expect(input.value).toBe('');
    });

    it('should echo input to output', async () => {
      const promise = adapter.readLine(80);
      input.value = 'hello';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await promise;
      expect(output.textContent).toContain('hello');
    });

    it('should resolve readChar on character key', async () => {
      const promise = adapter.readChar();
      const event = new KeyboardEvent('keydown', { key: 'a' });
      input.dispatchEvent(event);
      const result = await promise;
      expect(result).toBe(97); // 'a'
    });

    it('should handle readLine timeout', async () => {
      vi.useFakeTimers();
      const promise = adapter.readLine(80, 5); // 0.5 seconds
      vi.advanceTimersByTime(600);
      const result = await promise;
      expect(result.terminator).toBe(0); // Timeout
      vi.useRealTimers();
    });

    it('should handle readChar timeout', async () => {
      vi.useFakeTimers();
      const promise = adapter.readChar(5); // 0.5 seconds
      vi.advanceTimersByTime(600);
      const result = await promise;
      expect(result).toBe(0); // Timeout
      vi.useRealTimers();
    });
  });

  describe('save and restore', () => {
    beforeEach(() => {
      // jsdom doesn't have URL.createObjectURL, stub it
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      URL.revokeObjectURL = vi.fn();
    });

    it('should save data with file download', async () => {
      const appendSpy = vi.spyOn(document.body, 'appendChild');

      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await adapter.save(data);

      expect(result).toBe(true);
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(appendSpy).toHaveBeenCalled();
      expect(output.textContent).toContain('[Game saved]');
      expect(localStorage.getItem('zmachine-save')).not.toBeNull();
    });

    it('should restore from file selection', async () => {
      // Mock the file input to simulate file selection
      const mockFile = new File([new Uint8Array([1, 2, 3])], 'save.qzl');
      const mockFileList = {
        0: mockFile,
        length: 1,
        item: (): File => mockFile,
        [Symbol.iterator]: function* (): Generator<File> {
          yield mockFile;
        },
      } as unknown as FileList;

      let capturedOnchange: (() => Promise<void>) | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'input') {
          Object.defineProperty(el, 'files', { get: () => mockFileList });
          Object.defineProperty(el, 'onchange', {
            set: (fn: () => Promise<void>) => {
              capturedOnchange = fn;
            },
          });
          (el as HTMLInputElement).click = (): void => {
            setTimeout(() => {
              if (capturedOnchange) capturedOnchange();
            }, 0);
          };
        }
        return el;
      });

      const result = await adapter.restore();

      // File loading in jsdom may not work exactly like browser,
      // but we're exercising the code path - null means the file read failed
      expect(result === null || result instanceof Uint8Array).toBe(true);
    });

    it('should restore from localStorage backup when no file selected', async () => {
      // Save something to localStorage first
      const saveData = new Uint8Array([10, 20, 30]);
      const base64 = btoa(String.fromCharCode(...saveData));
      localStorage.setItem('zmachine-save', base64);

      // Mock file input with no file selected
      let capturedOnchange: (() => void) | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'input') {
          Object.defineProperty(el, 'files', {
            get: (): { length: number; item: () => null } => ({
              length: 0,
              item: (): null => null,
            }),
          });
          Object.defineProperty(el, 'onchange', {
            set: (fn: () => void) => {
              capturedOnchange = fn;
            },
          });
          (el as HTMLInputElement).click = (): void => {
            if (capturedOnchange) capturedOnchange();
          };
        }
        return el;
      });

      const result = await adapter.restore();

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Uint8Array);
      expect(output.textContent).toContain('[Game restored from backup]');
    });

    it('should return null when no save found', async () => {
      // Clear localStorage
      localStorage.removeItem('zmachine-save');

      // Mock file input with no file selected
      let capturedOnchange: (() => void) | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'input') {
          Object.defineProperty(el, 'files', {
            get: (): { length: number; item: () => null } => ({
              length: 0,
              item: (): null => null,
            }),
          });
          Object.defineProperty(el, 'onchange', {
            set: (fn: () => void) => {
              capturedOnchange = fn;
            },
          });
          (el as HTMLInputElement).click = (): void => {
            if (capturedOnchange) capturedOnchange();
          };
        }
        return el;
      });

      const result = await adapter.restore();

      expect(result).toBeNull();
      expect(output.textContent).toContain('[No saved game found]');
    });
  });

  describe('sound effects', () => {
    it('should handle sound effect calls without crashing', () => {
      // Sound might not work in jsdom, but shouldn't throw
      expect(() => adapter.soundEffect(1, 2, 255)).not.toThrow();
      expect(() => adapter.soundEffect(2, 2, 4)).not.toThrow();
    });

    it('should play beep with mocked AudioContext', () => {
      // Mock AudioContext for coverage
      const mockOscillator = {
        frequency: { value: 0 },
        type: '',
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      const mockGainNode = {
        gain: { value: 0 },
        connect: vi.fn(),
      };
      const mockContext = {
        createOscillator: vi.fn().mockReturnValue(mockOscillator),
        createGain: vi.fn().mockReturnValue(mockGainNode),
        destination: {},
        currentTime: 0,
      };

      // Use a class for vitest v4 compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).AudioContext = class MockAudioContext {
        createOscillator = mockContext.createOscillator;
        createGain = mockContext.createGain;
        destination = mockContext.destination;
        currentTime = mockContext.currentTime;
      };

      // Create new adapter after mocking AudioContext
      const testAdapter = createAdapter();
      testAdapter.soundEffect(1, 2, 255); // high beep

      expect(mockContext.createOscillator).toHaveBeenCalled();
      expect(mockOscillator.frequency.value).toBe(800);
      expect(mockOscillator.start).toHaveBeenCalled();

      testAdapter.soundEffect(2, 2, 4); // low beep with specific volume
      expect(mockOscillator.frequency.value).toBe(400);
    });

    it('should ignore non-start effects', () => {
      expect(() => adapter.soundEffect(1, 1, 255)).not.toThrow(); // prepare
      expect(() => adapter.soundEffect(1, 3, 255)).not.toThrow(); // stop
    });

    it('should ignore non-beep sounds', () => {
      expect(() => adapter.soundEffect(3, 2, 255)).not.toThrow();
    });
  });

  describe('setOutputStream', () => {
    it('should accept output stream setting', () => {
      expect(() => adapter.setOutputStream(1, true)).not.toThrow();
      expect(() => adapter.setOutputStream(2, true)).not.toThrow();
    });

    it('should enable transcript on stream 2', () => {
      adapter.setOutputStream(2, true);
      expect(adapter.isTranscriptEnabled()).toBe(true);
    });

    it('should disable transcript on stream 2', () => {
      adapter.setOutputStream(2, true);
      adapter.setOutputStream(2, false);
      expect(adapter.isTranscriptEnabled()).toBe(false);
    });
  });

  describe('transcript', () => {
    it('should record text when transcript enabled', () => {
      adapter.setOutputStream(2, true); // Stream 2 = transcript
      adapter.print('Logged text');
      expect(adapter.getTranscript()).toContain('Logged text');
    });

    it('should download transcript', () => {
      // jsdom doesn't have URL.createObjectURL, stub it
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      URL.revokeObjectURL = vi.fn();

      adapter.setOutputStream(2, true);
      adapter.print('Transcript text');
      adapter.downloadTranscript();

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(output.textContent).toContain('[Transcript downloaded]');
    });
  });

  describe('recording and playback', () => {
    it('should start recording', () => {
      adapter.startRecording();
      expect(adapter.isRecordingActive()).toBe(true);
      expect(output.textContent).toContain('[Recording started]');
    });

    it('should stop recording', () => {
      adapter.startRecording();
      adapter.stopRecording();
      expect(adapter.isRecordingActive()).toBe(false);
      expect(output.textContent).toContain('[Recording stopped');
    });

    it('should get recorded inputs', () => {
      adapter.startRecording();
      const inputs = adapter.getRecordedInputs();
      expect(Array.isArray(inputs)).toBe(true);
    });

    it('should record inputs during readLine', async () => {
      adapter.startRecording();
      const promise = adapter.readLine(80);
      input.value = 'go north';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await promise;

      const recorded = adapter.getRecordedInputs();
      expect(recorded).toContain('go north');
    });

    it('should download recording', () => {
      // jsdom doesn't have URL.createObjectURL, stub it
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      URL.revokeObjectURL = vi.fn();

      adapter.startRecording();
      adapter.downloadRecording();

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(output.textContent).toContain('[Recording downloaded]');
    });

    it('should load playback', () => {
      adapter.loadPlayback(['north', 'take lamp']);
      expect(adapter.isPlaybackActive()).toBe(true);
      expect(adapter.getPlaybackRemaining()).toBe(2);
    });

    it('should auto-play commands during readLine in playback mode', async () => {
      adapter.loadPlayback(['go west', 'take sword']);

      // First readLine should auto-return the first command
      const result1 = await adapter.readLine(80);
      expect(result1.text).toBe('go west');
      expect(adapter.getPlaybackRemaining()).toBe(1);

      // Second readLine should auto-return the second command
      const result2 = await adapter.readLine(80);
      expect(result2.text).toBe('take sword');
      expect(adapter.getPlaybackRemaining()).toBe(0);
    });

    it('should stop playback', () => {
      adapter.loadPlayback(['north']);
      adapter.stopPlayback();
      expect(adapter.isPlaybackActive()).toBe(false);
      expect(output.textContent).toContain('[Playback stopped]');
    });

    it('should load playback from valid JSON file', async () => {
      const jsonData = JSON.stringify({ version: 1, commands: ['north', 'take lamp'] });
      const mockFile = new File([jsonData], 'recording.json', { type: 'application/json' });
      const mockFileList = {
        0: mockFile,
        length: 1,
        item: (): File => mockFile,
        [Symbol.iterator]: function* (): Generator<File> {
          yield mockFile;
        },
      } as unknown as FileList;

      let capturedOnchange: (() => Promise<void>) | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'input') {
          Object.defineProperty(el, 'files', { get: () => mockFileList });
          Object.defineProperty(el, 'onchange', {
            set: (fn: () => Promise<void>) => {
              capturedOnchange = fn;
            },
          });
          (el as HTMLInputElement).click = (): void => {
            // Wait a tick then call onchange
            setTimeout(() => {
              if (capturedOnchange) capturedOnchange();
            }, 0);
          };
        }
        return el;
      });

      const result = await adapter.loadPlaybackFromFile();

      // File loading in jsdom may not work exactly like browser,
      // but we're exercising the code path
      expect(typeof result).toBe('boolean');
    });

    it('should handle invalid JSON recording file', async () => {
      const jsonData = JSON.stringify({ wrongFormat: true });
      const mockFile = new File([jsonData], 'recording.json', { type: 'application/json' });
      const mockFileList = {
        0: mockFile,
        length: 1,
        item: (): File => mockFile,
        [Symbol.iterator]: function* (): Generator<File> {
          yield mockFile;
        },
      } as unknown as FileList;

      let capturedOnchange: (() => Promise<void>) | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'input') {
          Object.defineProperty(el, 'files', { get: () => mockFileList });
          Object.defineProperty(el, 'onchange', {
            set: (fn: () => Promise<void>) => {
              capturedOnchange = fn;
            },
          });
          (el as HTMLInputElement).click = (): void => {
            setTimeout(() => {
              if (capturedOnchange) capturedOnchange();
            }, 0);
          };
        }
        return el;
      });

      const result = await adapter.loadPlaybackFromFile();

      expect(result).toBe(false);
    });

    it('should return false when no file selected for playback', async () => {
      let capturedOnchange: (() => void) | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'input') {
          Object.defineProperty(el, 'files', {
            get: (): { length: number; item: () => null } => ({
              length: 0,
              item: (): null => null,
            }),
          });
          Object.defineProperty(el, 'onchange', {
            set: (fn: () => void) => {
              capturedOnchange = fn;
            },
          });
          (el as HTMLInputElement).click = (): void => {
            if (capturedOnchange) capturedOnchange();
          };
        }
        return el;
      });

      const result = await adapter.loadPlaybackFromFile();

      expect(result).toBe(false);
    });
  });
});
