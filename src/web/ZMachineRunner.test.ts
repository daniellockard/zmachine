/**
 * Tests for Z-Machine Runner
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZMachineRunner, RunnerState } from './ZMachineRunner';
import { TestIOAdapter } from '../io/TestIOAdapter';
import { ZMachine, RunState } from '../core/ZMachine';

// Mock ZMachine to avoid needing valid story data
vi.mock('../core/ZMachine', () => {
  const mockRun = vi.fn().mockResolvedValue(0);
  const mockRestart = vi.fn();
  
  return {
    ZMachine: class MockZMachine {
      run = mockRun;
      restart = mockRestart;
      static mockRun = mockRun;
      static mockRestart = mockRestart;
    },
    RunState: {
      Halted: 0,
      Running: 1,
      WaitingForInput: 2,
    },
  };
});

describe('ZMachineRunner', () => {
  let io: TestIOAdapter;
  let storyData: ArrayBuffer;
  let mockRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    io = new TestIOAdapter();
    storyData = new ArrayBuffer(64);
    vi.clearAllMocks();
    
    // Access the static mocks from the mocked class
    const MockZMachine = ZMachine as unknown as { mockRun: ReturnType<typeof vi.fn>; mockRestart: ReturnType<typeof vi.fn> };
    mockRun = MockZMachine.mockRun;
    mockRun.mockResolvedValue(0); // Reset to default (Halted)
  });

  describe('constructor', () => {
    it('should create runner with config', () => {
      const runner = new ZMachineRunner({ storyData, io });
      expect(runner).toBeDefined();
      // The mock ZMachine is instantiated
      expect(runner.getMachine()).toBeDefined();
    });

    it('should start in stopped state', () => {
      const runner = new ZMachineRunner({ storyData, io });
      expect(runner.getState()).toBe('stopped');
    });

    it('should provide access to Z-machine', () => {
      const runner = new ZMachineRunner({ storyData, io });
      expect(runner.getMachine()).toBeDefined();
    });
  });

  describe('state changes', () => {
    it('should call onStateChange callback', async () => {
      const onStateChange = vi.fn();
      const runner = new ZMachineRunner({ storyData, io, onStateChange });
      
      await runner.run();
      
      expect(onStateChange).toHaveBeenCalled();
    });

    it('should transition to running then stopped on successful run', async () => {
      const states: RunnerState[] = [];
      const runner = new ZMachineRunner({
        storyData,
        io,
        onStateChange: (state): void => { states.push(state); },
      });
      
      await runner.run();
      
      expect(states).toContain('running');
      expect(states[states.length - 1]).toBe('stopped');
    });

    it('should transition to waiting-input when machine waits', async () => {
      const states: RunnerState[] = [];
      
      // Mock to return WaitingForInput
      mockRun.mockResolvedValueOnce(RunState.WaitingForInput);
      
      const runner = new ZMachineRunner({
        storyData,
        io,
        onStateChange: (state): void => { states.push(state); },
      });
      
      await runner.run();
      
      expect(states[states.length - 1]).toBe('waiting-input');
    });

    it('should handle unknown run state as stopped', async () => {
      const states: RunnerState[] = [];
      
      // Mock to return an unknown state (e.g., 99)
      mockRun.mockResolvedValueOnce(99);
      
      const runner = new ZMachineRunner({
        storyData,
        io,
        onStateChange: (state): void => { states.push(state); },
      });
      
      await runner.run();
      
      expect(states[states.length - 1]).toBe('stopped');
    });
  });

  describe('run', () => {
    it('should execute the Z-machine', async () => {
      const runner = new ZMachineRunner({ storyData, io });
      await runner.run();
      expect(runner.getState()).toBe('stopped');
    });

    it('should handle errors and call onError', async () => {
      const onError = vi.fn();
      
      // Mock to throw an error
      mockRun.mockRejectedValueOnce(new Error('Test error'));
      
      const runner = new ZMachineRunner({
        storyData,
        io,
        onError,
      });
      
      await runner.run();
      
      expect(runner.getState()).toBe('error');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle non-Error throws', async () => {
      const onError = vi.fn();
      
      mockRun.mockRejectedValueOnce('string error');
      
      const runner = new ZMachineRunner({
        storyData,
        io,
        onError,
      });
      
      await runner.run();
      
      expect(runner.getState()).toBe('error');
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should set state to stopped', () => {
      const runner = new ZMachineRunner({ storyData, io });
      runner.stop();
      expect(runner.getState()).toBe('stopped');
    });

    it('should not call onStateChange if already stopped', () => {
      const onStateChange = vi.fn();
      const runner = new ZMachineRunner({ storyData, io, onStateChange });
      
      // Clear any calls from constructor
      onStateChange.mockClear();
      
      runner.stop(); // Already stopped
      expect(onStateChange).not.toHaveBeenCalled();
    });
  });

  describe('restart', () => {
    it('should call restart on Z-machine', () => {
      const runner = new ZMachineRunner({ storyData, io });
      const machine = runner.getMachine();
      
      runner.restart();
      
      expect(machine.restart).toHaveBeenCalled();
    });
  });
});
