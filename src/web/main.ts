/**
 * Z-Machine Web Application
 *
 * Main entry point for the browser-based Z-machine emulator.
 *
 * @module
 */

import { ZMachine } from '../core/ZMachine';
import { WebIOAdapter } from './WebIOAdapter';
import { MapTracker } from './MapTracker';
import { MapRenderer } from './MapRenderer';

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
let inputHandlerSetup = false;

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
    onBeforeInput: (text: string): void => {
      // Track location before command for map
      mapTracker?.beforeCommand(text);
    },
    onWaitingForInput: (): void => {
      // Update map when game is waiting for input
      // This fires after the game processes a command and before waiting for next input
      mapTracker?.afterCommand();
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

    // Initialize map tracking
    initializeMap();

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

  // Set up input handling (only once)
  if (!inputHandlerSetup) {
    setupInputHandler();
    inputHandlerSetup = true;
  }

  // Run the machine - this will call onWaitingForInput when ready for input
  try {
    await zm.run();
  } catch (error) {
    // Check if it's the expected "waiting for input" error
    if (error instanceof Error && error.message.includes('No line input available')) {
      // This is normal - the game is waiting for input
      // onWaitingForInput callback handles initial room capture
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

    // Handle Enter for command history (WebIOAdapter handles actual input processing)
    if (e.key === 'Enter') {
      const text = inputEl.value.trim();
      historyIndex = -1;

      // Add to history (avoid duplicates) - but don't clear input, WebIOAdapter does that
      if (
        text &&
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
const btnDownloadTranscript = document.getElementById(
  'btn-download-transcript'
) as HTMLButtonElement;
const btnRecord = document.getElementById('btn-record') as HTMLButtonElement;
const btnDownloadRecording = document.getElementById('btn-download-recording') as HTMLButtonElement;
const btnPlayback = document.getElementById('btn-playback') as HTMLButtonElement;
const btnHelp = document.getElementById('btn-help') as HTMLButtonElement;
const helpModal = document.getElementById('help-modal') as HTMLElement;
const btnCloseHelp = document.getElementById('btn-close-help') as HTMLButtonElement;
const quickCommandsEl = document.getElementById('quick-commands') as HTMLElement;

// Map elements
const btnMap = document.getElementById('btn-map') as HTMLButtonElement;
const mapPanel = document.getElementById('map-panel') as HTMLElement;
const mapContainer = document.getElementById('map-container') as HTMLElement;
const btnMapCenter = document.getElementById('btn-map-center') as HTMLButtonElement;
const btnMapReset = document.getElementById('btn-map-reset') as HTMLButtonElement;
const btnMapExport = document.getElementById('btn-map-export') as HTMLButtonElement;
const gameLayout = document.getElementById('game-layout') as HTMLElement;

// Current IO adapter (set when game loads)
let currentIO: WebIOAdapter | null = null;

// Map tracking
let mapTracker: MapTracker | null = null;
let mapRenderer: MapRenderer | null = null;
let isMapVisible = false;

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
 * Toggle map panel visibility
 */
function toggleMap(): void {
  isMapVisible = !isMapVisible;
  mapPanel.classList.toggle('hidden', !isMapVisible);
  gameLayout.classList.toggle('map-visible', isMapVisible);
  btnMap.classList.toggle('active', isMapVisible);

  if (isMapVisible && mapRenderer) {
    mapRenderer.render();
    mapRenderer.centerOnCurrentRoom();
  }
}

/**
 * Initialize map tracking for the current game
 */
function initializeMap(): void {
  if (!machine) return;

  mapTracker = new MapTracker();
  mapTracker.attach(machine);

  mapRenderer = new MapRenderer(mapTracker, {
    container: mapContainer,
  });

  // Initial room will be captured in startGame after first run completes
}

/**
 * Export map as JSON file
 */
function exportMap(): void {
  if (!mapTracker) return;

  const json = mapTracker.exportMap();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'zmachine-map.json';
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Setup map event handlers
 */
function setupMap(): void {
  btnMap.addEventListener('click', toggleMap);
  btnMapCenter.addEventListener('click', () => mapRenderer?.centerOnCurrentRoom());
  btnMapReset.addEventListener('click', () => mapRenderer?.resetView());
  btnMapExport.addEventListener('click', exportMap);
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

  // Map controls
  setupMap();
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

    // Ctrl+M - Toggle map
    if (e.ctrlKey && e.key === 'm') {
      e.preventDefault();
      toggleMap();
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
