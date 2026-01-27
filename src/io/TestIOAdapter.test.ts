/**
 * Tests for TestIOAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestIOAdapter } from './TestIOAdapter';

describe('TestIOAdapter', () => {
  let io: TestIOAdapter;

  beforeEach(() => {
    io = new TestIOAdapter();
  });

  describe('initialization', () => {
    it('should start with empty output', () => {
      expect(io.output).toEqual([]);
      expect(io.upperOutput).toEqual([]);
    });

    it('should initialize with version', () => {
      io.initialize(5);
      expect(io.getCurrentWindow()).toBe(0);
      expect(io.getUpperWindowLines()).toBe(0);
    });

    it('should return current version', () => {
      io.initialize(5);
      expect(io.getVersion()).toBe(5);
    });

    it('should default to version 3', () => {
      expect(io.getVersion()).toBe(3);
    });

    it('should return current text style', () => {
      io.setTextStyle(2); // bold
      expect(io.getTextStyle()).toBe(2);
    });

    it('should default to style 0 (roman)', () => {
      expect(io.getTextStyle()).toBe(0);
    });
  });

  describe('print', () => {
    it('should capture printed text', () => {
      io.print('Hello');
      expect(io.output).toEqual(['Hello']);
    });

    it('should append to last line if no newline', () => {
      io.print('Hello');
      io.print(' World');
      expect(io.output).toEqual(['Hello World']);
    });

    it('should start new line after newline', () => {
      io.print('Hello\n');
      io.print('World');
      expect(io.output).toEqual(['Hello\n', 'World']);
    });

    it('should print to upper window when selected', () => {
      io.setWindow(1);
      io.print('Status');
      expect(io.upperOutput).toEqual(['Status']);
      expect(io.output).toEqual([]);
    });
  });

  describe('printLine', () => {
    it('should add newline to text', () => {
      io.printLine('Hello');
      expect(io.output).toEqual(['Hello\n']);
    });
  });

  describe('newLine', () => {
    it('should add newline character', () => {
      io.print('Hello');
      io.newLine();
      expect(io.output).toEqual(['Hello\n']);
    });
  });

  describe('readLine', () => {
    it('should return queued input', async () => {
      io.queueLineInput('go north');
      const result = await io.readLine(255);
      expect(result.text).toBe('go north');
      expect(result.terminator).toBe(13);
    });

    it('should truncate to maxLength', async () => {
      io.queueLineInput('this is a long command');
      const result = await io.readLine(10);
      expect(result.text).toBe('this is a ');
    });

    it('should throw when no input available', async () => {
      await expect(io.readLine(255)).rejects.toThrow('No line input available');
    });

    it('should return empty on timeout with no input', async () => {
      const result = await io.readLine(255, 100);
      expect(result.text).toBe('');
      expect(result.terminator).toBe(0);
    });
  });

  describe('readChar', () => {
    it('should return queued character', async () => {
      io.queueCharInput(65); // 'A'
      const result = await io.readChar();
      expect(result).toBe(65);
    });

    it('should throw when no input available', async () => {
      await expect(io.readChar()).rejects.toThrow('No character input available');
    });

    it('should return 0 on timeout with no input', async () => {
      const result = await io.readChar(100);
      expect(result).toBe(0);
    });
  });

  describe('window management', () => {
    it('should track current window', () => {
      expect(io.getCurrentWindow()).toBe(0);
      io.setWindow(1);
      expect(io.getCurrentWindow()).toBe(1);
    });

    it('should split window', () => {
      io.splitWindow(3);
      expect(io.getUpperWindowLines()).toBe(3);
    });

    it('should clear upper output when splitting', () => {
      io.setWindow(1);
      io.print('Old status');
      io.splitWindow(2);
      expect(io.upperOutput).toEqual([]);
    });
  });

  describe('eraseWindow', () => {
    it('should erase lower window (0)', () => {
      io.print('Hello');
      io.eraseWindow(0);
      expect(io.output).toEqual([]);
    });

    it('should erase upper window (1)', () => {
      io.setWindow(1);
      io.print('Status');
      io.eraseWindow(1);
      expect(io.upperOutput).toEqual([]);
    });

    it('should erase all and unsplit (-1)', () => {
      io.print('Lower');
      io.setWindow(1);
      io.print('Upper');
      io.splitWindow(2);

      io.eraseWindow(-1);

      expect(io.output).toEqual([]);
      expect(io.upperOutput).toEqual([]);
      expect(io.getUpperWindowLines()).toBe(0);
      expect(io.getCurrentWindow()).toBe(0);
    });

    it('should erase all keep split (-2)', () => {
      io.print('Lower');
      io.setWindow(1);
      io.print('Upper');
      io.splitWindow(2);

      io.eraseWindow(-2);

      expect(io.output).toEqual([]);
      expect(io.upperOutput).toEqual([]);
      expect(io.getUpperWindowLines()).toBe(2); // Still split
    });
  });

  describe('cursor', () => {
    it('should set and get cursor position', () => {
      io.setCursor(5, 10);
      const cursor = io.getCursor!();
      expect(cursor.line).toBe(5);
      expect(cursor.column).toBe(10);
    });

    it('should return copy of cursor position', () => {
      io.setCursor(1, 1);
      const cursor1 = io.getCursor!();
      cursor1.line = 99;
      const cursor2 = io.getCursor!();
      expect(cursor2.line).toBe(1);
    });
  });

  describe('text style and buffer mode', () => {
    it('should set text style', () => {
      io.setTextStyle(2); // Bold
      // No getter for style, but it shouldn't throw
    });

    it('should set and get buffer mode', () => {
      expect(io.getBufferMode()).toBe(true);
      io.setBufferMode(false);
      expect(io.getBufferMode()).toBe(false);
    });
  });

  describe('status line', () => {
    it('should capture status line info', () => {
      io.showStatusLine('West of House', 10, 5, false);
      expect(io.lastStatusLine).toEqual({
        location: 'West of House',
        score: 10,
        turns: 5,
        isTime: false,
      });
    });

    it('should capture time mode status', () => {
      io.showStatusLine('Kitchen', 10, 30, true);
      expect(io.lastStatusLine?.isTime).toBe(true);
    });
  });

  describe('quit and restart', () => {
    it('should track quit', () => {
      expect(io.hasQuit).toBe(false);
      io.quit();
      expect(io.hasQuit).toBe(true);
    });

    it('should track restart and clear output', () => {
      io.print('Hello');
      io.setWindow(1);
      io.print('Status');

      io.restart();

      expect(io.hasRestarted).toBe(true);
      expect(io.output).toEqual([]);
      expect(io.upperOutput).toEqual([]);
      expect(io.getCurrentWindow()).toBe(0);
    });
  });

  describe('helper methods', () => {
    it('should get full output from both windows', () => {
      io.setWindow(1);
      io.print('Upper');
      io.setWindow(0);
      io.print('Lower');

      expect(io.getFullOutput()).toBe('UpperLower');
    });

    it('should get lower output only', () => {
      io.print('Lower');
      io.setWindow(1);
      io.print('Upper');

      expect(io.getLowerOutput()).toBe('Lower');
    });

    it('should get upper output only', () => {
      io.setWindow(1);
      io.print('Upper');
      io.setWindow(0);
      io.print('Lower');

      expect(io.getUpperOutput()).toBe('Upper');
    });

    it('should clear output', () => {
      io.print('Hello');
      io.setWindow(1);
      io.print('Status');

      io.clearOutput();

      expect(io.output).toEqual([]);
      expect(io.upperOutput).toEqual([]);
    });

    it('should reset all state', () => {
      io.print('Hello');
      io.queueLineInput('test');
      io.queueCharInput(65);
      io.quit();
      io.showStatusLine('Test', 1, 1, false);
      io.setWindow(1);
      io.splitWindow(3);
      io.setTextStyle(2);
      io.setBufferMode(false);

      io.reset();

      expect(io.output).toEqual([]);
      expect(io.upperOutput).toEqual([]);
      expect(io.hasQuit).toBe(false);
      expect(io.hasRestarted).toBe(false);
      expect(io.lastStatusLine).toBeUndefined();
      expect(io.getCurrentWindow()).toBe(0);
      expect(io.getUpperWindowLines()).toBe(0);
      expect(io.getBufferMode()).toBe(true);
    });
  });
});
