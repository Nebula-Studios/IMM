import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { update } from './update.js';
import log from 'electron-log';
import Store from 'electron-store';

// Define a schema for the store
interface StoreSchema {
  gameFolderPath?: string;
}

// Initialize electron-store with the schema
const store = new Store<StoreSchema>({
  schema: {
    gameFolderPath: {
      type: 'string',
    },
  },
});

// Configure electron-log to catch unhandled exceptions
log.catchErrors();

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..');

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
const preload = path.join(__dirname, '../preload/index.mjs');
const indexHtml = path.join(RENDERER_DIST, 'index.html');

async function createWindow() {
  log.info('Creating main window');
  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    width: 1280,
    height: 720,
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Auto update
  update(win);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  win = null;
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

// --- IPC Handlers for Game Folder ---

// Handler to get the saved game folder path
ipcMain.handle('get-game-folder-path', async () => {
  const gameFolderPath = store.get('gameFolderPath');
  log.info('Renderer requested game folder path, returning:', gameFolderPath);
  return gameFolderPath;
});

// Handler to open folder selection dialog
ipcMain.handle('open-folder-dialog', async () => {
  log.info('Renderer requested to open folder dialog');
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
    title: 'Seleziona la cartella di installazione di InZOI',
  });
  if (canceled || filePaths.length === 0) {
    log.info('Folder selection was canceled or no folder selected');
    return null;
  }
  log.info('Folder selected:', filePaths[0]);
  return filePaths[0];
});

// Handler to save the game folder path
ipcMain.handle('save-game-folder-path', async (event, folderPath: string) => {
  if (typeof folderPath === 'string' && folderPath.length > 0) {
    const folderName = path.basename(folderPath);
    if (folderName.toLowerCase() !== 'inzoi') {
      log.warn(
        `Invalid folder name: "${folderName}". Expected "InZOI" (case-insensitive). Path: ${folderPath}`
      );
      return {
        success: false,
        error:
          'The selected folder is not named "InZOI". Please ensure you select the main game installation folder.',
      };
    }

    store.set('gameFolderPath', folderPath);
    log.info('Game folder path saved:', folderPath);
    return { success: true, path: folderPath };
  } else {
    log.error('Invalid folderPath received for saving:', folderPath);
    return { success: false, error: 'Invalid folder path provided.' };
  }
});

// --- DEV ONLY: Handler to clear the saved game folder path ---
ipcMain.handle('clear-game-folder-path', async () => {
  log.info('DEV: Clearing game folder path from store.');
  try {
    store.delete('gameFolderPath');
    return { success: true, message: 'Game folder path cleared.' };
  } catch (error: any) {
    log.error('DEV: Error clearing game folder path:', error);
    return { success: false, error: error.message };
  }
});

// --- IPC Handler for Logging from Renderer/Preload ---
ipcMain.on(
  'log-from-renderer',
  (event, level: string, message: string, ...args: unknown[]) => {
    const logMessage = `[Renderer] ${message}`;
    switch (level) {
      case 'error':
        log.error(logMessage, ...args);
        break;
      case 'warn':
        log.warn(logMessage, ...args);
        break;
      case 'info':
        log.info(logMessage, ...args);
        break;
      case 'debug':
        log.debug(logMessage, ...args);
        break;
      case 'verbose':
        log.verbose(logMessage, ...args);
        break;
      default:
        log.info(`[Renderer - unknown level: ${level}] ${message}`, ...args);
        break;
    }
  }
);

// --- End IPC Handlers for Game Folder ---

// --- IPC Handlers for Mod Enabler ---
interface ModEnablerStatus {
  dsoundExists: boolean;
  bitfixFolderExists: boolean;
}

// Funzione helper per controllare lo stato del Mod Enabler
async function getModEnablerStatusInternal(
  gameFolderPath: string
): Promise<ModEnablerStatus> {
  log.info('[Main] Checking Mod Enabler status for path:', gameFolderPath);
  const dsoundPath = path.join(
    gameFolderPath,
    'BlueClient',
    'Binaries',
    'Win64',
    'dsound.dll'
  );
  const bitfixFolderPath = path.join(
    gameFolderPath,
    'BlueClient',
    'Binaries',
    'Win64',
    'bitfix'
  );

  try {
    const dsoundExists = fs.existsSync(dsoundPath);
    const bitfixFolderExists =
      fs.existsSync(bitfixFolderPath) &&
      fs.lstatSync(bitfixFolderPath).isDirectory();

    log.info(`[Main] dsound.dll exists: ${dsoundExists} at ${dsoundPath}`);
    log.info(
      `[Main] bitfix folder exists: ${bitfixFolderExists} at ${bitfixFolderPath}`
    );

    return { dsoundExists, bitfixFolderExists };
  } catch (error) {
    log.error('[Main] Error checking mod enabler file/folder status:', error);
    // Se c'è un errore nell'accesso ai file, consideriamo che non esistano.
    return { dsoundExists: false, bitfixFolderExists: false };
  }
}

// Handler IPC per checkModEnablerStatus
ipcMain.handle('check-mod-enabler-status', async () => {
  const gameFolderPath = store.get('gameFolderPath');
  if (!gameFolderPath) {
    log.warn('[Main] check-mod-enabler-status: Game folder path not set.');
    return {
      checked: false,
      error: 'Game folder path not set.',
    };
  }

  log.info(
    '[Main] Renderer requested to check Mod Enabler status. Game folder path is:',
    gameFolderPath
  );
  try {
    const status = await getModEnablerStatusInternal(gameFolderPath);
    return {
      checked: true,
      ...status,
    };
  } catch (error: any) {
    log.error('[Main] Error in check-mod-enabler-status IPC handler:', error);
    return {
      checked: true,
      dsoundExists: false,
      bitfixFolderExists: false,
      error: error.message || 'Unknown error during Mod Enabler verification.',
    };
  }
});

// --- End IPC Handlers for Mod Enabler ---

// --- IPC Handler for Opening External Links ---
ipcMain.handle('open-external-link', async (event, url: string) => {
  log.info(`[Main] Renderer requested to open external link: ${url}`);
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      log.error(`[Main] Failed to open external link ${url}:`, error);
      return { success: false, error: error.message };
    }
  } else {
    log.warn(`[Main] Blocked attempt to open non-http(s) URL: ${url}`);
    return {
      success: false,
      error: 'Invalid URL. Only http/https links are allowed.',
    };
  }
});
// --- End IPC Handler for Opening External Links ---
