/**
 * Z-Machine Web Application
 *
 * Minimal entry point for the browser-based Z-machine emulator.
 *
 * @module
 */

import { ZMachine } from '../core/ZMachine';
import { WebIOAdapter } from './WebIOAdapter';

// DOM Elements
const outputEl = document.getElementById('output') as HTMLElement;
const inputEl = document.getElementById('input') as HTMLInputElement;
const statusEl = document.getElementById('status-line') as HTMLElement;
const loaderEl = document.getElementById('loader') as HTMLElement;
const fileDropEl = document.getElementById('file-drop') as HTMLElement;
const fileInputEl = document.getElementById('file-input') as HTMLInputElement;

// State
let machine: ZMachine | null = null;

// Command history
const commandHistory: string[] = [];
let historyIndex = -1;
const MAX_HISTORY = 100;

/**
 * Create an IO adapter that bridges the Z-machine to the DOM
 */
function createIOAdapter(): WebIOAdapter {
  return new WebIOAdapter({
    outputElement: outputEl,
    inputElement: inputEl,
    statusElement: statusEl,
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
    await machine.run();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
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
 * Set up keyboard input handler for command history
 */
function setupInputHandler(): void {
  inputEl.addEventListener('keydown', (e) => {
    // Command history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        historyIndex++;
        inputEl.value = commandHistory[commandHistory.length - 1 - historyIndex];
        setTimeout(() => inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length), 0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        inputEl.value = commandHistory[commandHistory.length - 1 - historyIndex];
      } else if (historyIndex === 0) {
        historyIndex = -1;
        inputEl.value = '';
      }
      return;
    }

    // Track command history on Enter
    if (e.key === 'Enter') {
      const text = inputEl.value.trim();
      historyIndex = -1;
      if (
        text.length > 0 &&
        (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== text)
      ) {
        commandHistory.push(text);
        if (commandHistory.length > MAX_HISTORY) {
          commandHistory.shift();
        }
      }
    }
  });
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
  setupInputHandler();
});
