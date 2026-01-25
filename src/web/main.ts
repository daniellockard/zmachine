/**
 * Z-Machine Web Application
 * 
 * Main entry point for the browser-based Z-machine emulator.
 * 
 * @module
 */

import { ZMachine } from '../core/ZMachine';
import { WebIOAdapter } from './WebIOAdapter';
import type { ReadLineResult } from '../io/IOAdapter';

// DOM Elements
const outputEl = document.getElementById('output') as HTMLElement;
const inputEl = document.getElementById('input') as HTMLInputElement;
const statusEl = document.getElementById('status-line') as HTMLElement;
const loaderEl = document.getElementById('loader') as HTMLElement;
const fileDropEl = document.getElementById('file-drop') as HTMLElement;
const fileInputEl = document.getElementById('file-input') as HTMLInputElement;

// State
let machine: ZMachine | null = null;
let pendingInputResolve: ((result: ReadLineResult) => void) | null = null;

/**
 * Create an IO adapter that bridges the Z-machine to the DOM
 */
function createIOAdapter(): WebIOAdapter {
  return new WebIOAdapter({
    outputElement: outputEl,
    inputElement: inputEl,
    statusElement: statusEl,
    onQuit: (): void => {
      inputEl.disabled = true;
      inputEl.placeholder = 'Game ended';
    },
    onRestart: (): void => {
      if (machine) {
        startGame(machine);
      }
    },
  });
}

/**
 * Load and start a Z-machine story
 */
async function loadStory(data: ArrayBuffer): Promise<void> {
  try {
    // Hide loader, show game
    loaderEl.classList.add('hidden');
    inputEl.disabled = false;
    inputEl.placeholder = 'Type a command...';
    inputEl.focus();

    // Create IO adapter and machine
    const io = createIOAdapter();
    machine = ZMachine.load(data, io);

    // Initialize IO with version
    io.initialize(machine.version);

    // Start the game
    await startGame(machine);
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Start/restart game execution
 */
async function startGame(zm: ZMachine): Promise<void> {
  // Clear output
  outputEl.innerHTML = '';

  // Set up input handling
  setupInputHandler();

  // Run the machine
  try {
    await zm.run();
  } catch (error) {
    // Check if it's the expected "waiting for input" error
    if (error instanceof Error && error.message.includes('No line input available')) {
      // This is normal - the game is waiting for input
      // Input will be provided via the input handler
    } else {
      throw error;
    }
  }
}

/**
 * Set up keyboard input handler
 */
function setupInputHandler(): void {
  inputEl.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && machine) {
      const text = inputEl.value.trim();
      inputEl.value = '';

      // Echo input
      const echo = document.createElement('span');
      echo.textContent = '>' + text + '\n';
      echo.style.color = '#00cc00';
      outputEl.appendChild(echo);
      outputEl.scrollTop = outputEl.scrollHeight;

      // Provide input and continue execution
      try {
        if (pendingInputResolve) {
          pendingInputResolve({ text, terminator: 13 });
          pendingInputResolve = null;
        }

        // Continue running
        await machine.run();
      } catch (error) {
        if (error instanceof Error && !error.message.includes('No line input available')) {
          showError(error.message);
        }
      }
    }
  });
}

/**
 * Show an error message
 */
function showError(message: string): void {
  const errorEl = document.createElement('div');
  errorEl.className = 'error';
  errorEl.textContent = `Error: ${message}`;
  outputEl.appendChild(errorEl);
}

/**
 * Handle file drop
 */
function setupFileDrop(): void {
  fileDropEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropEl.classList.add('drag-over');
  });

  fileDropEl.addEventListener('dragleave', () => {
    fileDropEl.classList.remove('drag-over');
  });

  fileDropEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    fileDropEl.classList.remove('drag-over');

    const file = e.dataTransfer?.files[0];
    if (file) {
      const data = await file.arrayBuffer();
      await loadStory(data);
    }
  });

  fileInputEl.addEventListener('change', async () => {
    const file = fileInputEl.files?.[0];
    if (file) {
      const data = await file.arrayBuffer();
      await loadStory(data);
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupFileDrop();
});

// For debugging
(window as unknown as { zmachine: ZMachine | null }).zmachine = machine;
