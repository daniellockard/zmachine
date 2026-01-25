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

// Register service worker for PWA/offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Service worker registration failed - offline mode won't work
  });
}

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
    currentIO = io;
    machine = ZMachine.load(data, io);

    // Initialize IO with version
    io.initialize(machine.version);
    
    // Show toolbar and quick commands
    showToolbar();
    showQuickCommands();

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
    // Command history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        historyIndex++;
        inputEl.value = commandHistory[commandHistory.length - 1 - historyIndex];
        // Move cursor to end
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

    if (e.key === 'Enter' && machine) {
      const text = inputEl.value.trim();
      inputEl.value = '';
      historyIndex = -1;

      // Add to history (avoid duplicates)
      if (text && (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== text)) {
        commandHistory.push(text);
        if (commandHistory.length > MAX_HISTORY) {
          commandHistory.shift();
        }
      }

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

// Toolbar elements
const toolbarEl = document.getElementById('toolbar') as HTMLElement;
const btnTranscript = document.getElementById('btn-transcript') as HTMLButtonElement;
const btnDownloadTranscript = document.getElementById('btn-download-transcript') as HTMLButtonElement;
const btnRecord = document.getElementById('btn-record') as HTMLButtonElement;
const btnDownloadRecording = document.getElementById('btn-download-recording') as HTMLButtonElement;
const btnPlayback = document.getElementById('btn-playback') as HTMLButtonElement;
const btnHelp = document.getElementById('btn-help') as HTMLButtonElement;
const helpModal = document.getElementById('help-modal') as HTMLElement;
const btnCloseHelp = document.getElementById('btn-close-help') as HTMLButtonElement;
const quickCommandsEl = document.getElementById('quick-commands') as HTMLElement;

// Current IO adapter (set when game loads)
let currentIO: WebIOAdapter | null = null;

/**
 * Show the toolbar when a game is loaded
 */
function showToolbar(): void {
  toolbarEl.classList.remove('hidden');
}

/**
 * Show quick commands bar (visible on mobile by default)
 */
function showQuickCommands(): void {
  quickCommandsEl.classList.remove('hidden');
}

/**
 * Submit a command programmatically (for quick command buttons)
 */
async function submitCommand(cmd: string): Promise<void> {
  if (!machine || inputEl.disabled) return;
  
  // Set input value and trigger enter
  inputEl.value = cmd;
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  inputEl.dispatchEvent(event);
}

/**
 * Setup quick command buttons
 */
function setupQuickCommands(): void {
  quickCommandsEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' && target.dataset.cmd) {
      submitCommand(target.dataset.cmd);
    }
  });
}

/**
 * Toggle transcript recording
 */
function toggleTranscript(): void {
  if (!currentIO) return;
  
  const isEnabled = currentIO.isTranscriptEnabled();
  currentIO.setOutputStream(2, !isEnabled);
  btnTranscript.classList.toggle('active', !isEnabled);
  btnDownloadTranscript.disabled = isEnabled; // Disable download when transcript is off
}

/**
 * Download the transcript
 */
function downloadTranscript(): void {
  if (!currentIO) return;
  currentIO.downloadTranscript();
}

/**
 * Toggle input recording
 */
function toggleRecording(): void {
  if (!currentIO) return;
  
  if (currentIO.isRecordingActive()) {
    currentIO.stopRecording();
    btnRecord.classList.remove('recording');
    btnRecord.textContent = '🔴 Record';
    btnDownloadRecording.disabled = false;
  } else {
    currentIO.startRecording();
    btnRecord.classList.add('recording');
    btnRecord.textContent = '⏹️ Stop';
    btnDownloadRecording.disabled = true;
  }
}

/**
 * Download the recording
 */
function downloadRecording(): void {
  if (!currentIO) return;
  currentIO.downloadRecording();
}

/**
 * Load and start playback
 */
async function loadPlayback(): Promise<void> {
  if (!currentIO) return;
  await currentIO.loadPlaybackFromFile();
}

/**
 * Show help modal
 */
function showHelp(): void {
  helpModal.classList.remove('hidden');
}

/**
 * Hide help modal
 */
function hideHelp(): void {
  helpModal.classList.add('hidden');
}

/**
 * Setup toolbar event handlers
 */
function setupToolbar(): void {
  btnTranscript.addEventListener('click', toggleTranscript);
  btnDownloadTranscript.addEventListener('click', downloadTranscript);
  btnRecord.addEventListener('click', toggleRecording);
  btnDownloadRecording.addEventListener('click', downloadRecording);
  btnPlayback.addEventListener('click', loadPlayback);
  btnHelp.addEventListener('click', showHelp);
  btnCloseHelp.addEventListener('click', hideHelp);
  
  // Click outside modal to close
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      hideHelp();
    }
  });
}

/**
 * Setup global keyboard shortcuts
 */
function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // F1 - Help
    if (e.key === 'F1') {
      e.preventDefault();
      showHelp();
      return;
    }
    
    // Escape - Close modals
    if (e.key === 'Escape') {
      hideHelp();
      return;
    }
    
    // Ctrl+T - Toggle transcript
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      toggleTranscript();
      return;
    }
    
    // Ctrl+D - Download transcript
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      if (currentIO?.isTranscriptEnabled()) {
        downloadTranscript();
      }
      return;
    }
    
    // Ctrl+R - Toggle recording
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      toggleRecording();
      return;
    }
    
    // Ctrl+P - Load playback
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      loadPlayback();
      return;
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupFileDrop();
  setupToolbar();
  setupQuickCommands();
  setupKeyboardShortcuts();
});

// For debugging
(window as unknown as { zmachine: ZMachine | null }).zmachine = machine;
