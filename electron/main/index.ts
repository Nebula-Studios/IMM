import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { update } from './update.js';
import log from 'electron-log';
import Store from 'electron-store';
import * as nodePath from 'path';
import fsPromises from 'node:fs/promises';

// Define a schema for the store
// Questa interfaccia deve corrispondere a quella usata nel renderer (src/components/mod-management/ModCard.tsx)
interface ModItemForStore {
  id: string;
  name: string;
  path: string;
}

interface StoreSchema {
  gameFolderPath?: string;
  modStagingPath?: string;
  savedDisabledMods?: ModItemForStore[];
  savedEnabledMods?: ModItemForStore[];
}

// Initialize electron-store with the schema
const store = new Store<StoreSchema>({
  schema: {
    gameFolderPath: {
      type: 'string',
    },
    modStagingPath: {
      type: 'string',
    },
    savedDisabledMods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['id', 'name', 'path'],
      },
      default: [], // Default a un array vuoto
    },
    savedEnabledMods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['id', 'name', 'path'],
      },
      default: [], // Default a un array vuoto
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
    title: 'IMM by Nebula Studios',
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

app.whenReady().then(() => {
  createWindow();
  // Log del percorso di staging all'avvio
  const initialStagingPath = getCurrentStagingPath();
  log.info(`[Main] Initial staging path determined: ${initialStagingPath}`);
  // Assicurati che la cartella di staging esista all'avvio
  if (!fs.existsSync(initialStagingPath)) {
    try {
      fs.mkdirSync(initialStagingPath, { recursive: true });
      log.info(`[Main] Created staging directory at: ${initialStagingPath}`);
    } catch (error) {
      log.error(
        `[Main] Error creating staging directory at ${initialStagingPath}:`,
        error
      );
    }
  }
});

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

// It's often good practice to group constants.
const INZOI_MOD_MANAGER_FILES_DIR_NAME = 'inzoi_mod_manager_files';
const STAGED_MODS_DIR_NAME = 'staged_mods';

/**
 * Retrieves the absolute default path to the staging directory for mods.
 * This directory is located within the application's user data folder.
 * @returns {string} The absolute default path to the staging directory.
 */
function getDefaultStagingPath(): string {
  const userDataPath = app.getPath('userData');
  return nodePath.join(
    userDataPath,
    INZOI_MOD_MANAGER_FILES_DIR_NAME,
    STAGED_MODS_DIR_NAME
  );
}

/**
 * Retrieves the current staging path for mods.
 * It first checks if a custom path is set in the store,
 * otherwise, it returns the default staging path.
 * @returns {string} The current absolute path to the staging directory.
 */
function getCurrentStagingPath(): string {
  const customStagingPath = store.get('modStagingPath');
  if (customStagingPath && typeof customStagingPath === 'string') {
    // Basic validation: ensure it's an absolute path.
    // More robust validation might be needed depending on requirements.
    if (nodePath.isAbsolute(customStagingPath)) {
      log.info(
        `[Main Process] Using custom staging path: ${customStagingPath}`
      );
      return customStagingPath;
    }
    log.warn(
      `[Main Process] Custom staging path "${customStagingPath}" is not absolute. Falling back to default.`
    );
  }
  const defaultPath = getDefaultStagingPath();
  log.info(`[Main Process] Using default staging path: ${defaultPath}`);
  return defaultPath;
}

/**
 * Information about a processed mod file and its associated files.
 */
interface ProcessedModInfo {
  /** The base name of the mod (without extension). */
  name: string;
  /** The new path to the .pak file in the staging directory. */
  pakPath: string;
  /** The new path to the .ucas file in the staging directory, or null if not found. */
  ucasPath: string | null;
  /** The new path to the .utoc file in the staging directory, or null if not found. */
  utocPath: string | null;
  /** The original path of the .pak file. */
  originalPath: string;
}

/**
 * Result object for the 'process-dropped-mods' IPC handler.
 */
interface ProcessDroppedModsResult {
  /** Whether the operation was successful. */
  success: boolean;
  /** An array of objects containing information about the processed mods. Present if success is true. */
  mods?: ProcessedModInfo[];
  /** An error message if the operation failed. Present if success is false. */
  error?: string;
}

/**
 * Handles the 'process-dropped-mods' IPC event from the renderer process.
 * It takes a list of file paths (presumably .pak files dropped by the user),
 * copies them and their associated .ucas and .utoc files (if present in the same source directory)
 * into a managed staging directory within the app's user data folder.
 *
 * Associated files (.ucas, .utoc) are identified by having the same base name as the .pak file.
 *
 * @param {Electron.IpcMainInvokeEvent} event - The IPC event.
 * @param {string[]} filePaths - An array of absolute paths to the dropped files.
 * @returns {Promise<ProcessDroppedModsResult>} A promise that resolves with an object indicating success or failure.
 */
ipcMain.handle(
  'process-dropped-mods',
  async (event, filePaths: string[]): Promise<ProcessDroppedModsResult> => {
    const stagingPath = getCurrentStagingPath();
    console.log(`[Main Process] Staging path for mods: ${stagingPath}`);

    try {
      if (!fs.existsSync(stagingPath)) {
        fs.mkdirSync(stagingPath, { recursive: true });
        console.log(`[Main Process] Created staging directory: ${stagingPath}`);
      }

      const processedModsInfo: ProcessedModInfo[] = [];

      for (const sourceFilePath of filePaths) {
        if (nodePath.extname(sourceFilePath).toLowerCase() !== '.pak') {
          console.warn(
            `[Main Process] Skipped non-PAK file: ${sourceFilePath}`
          );
          continue;
        }

        const sourceDir = nodePath.dirname(sourceFilePath);
        const baseName = nodePath.basename(sourceFilePath, '.pak');

        const pakFileName = `${baseName}.pak`;
        const ucasFileName = `${baseName}.ucas`;
        const utocFileName = `${baseName}.utoc`;

        const destinationPakPath = nodePath.join(stagingPath, pakFileName);

        // Copy .pak file. Overwrites if exists.
        fs.copyFileSync(sourceFilePath, destinationPakPath);
        console.log(
          `[Main Process] Copied ${pakFileName} from ${sourceFilePath} to ${destinationPakPath}`
        );

        const modInfo: ProcessedModInfo = {
          name: baseName,
          pakPath: destinationPakPath,
          ucasPath: null,
          utocPath: null,
          originalPath: sourceFilePath,
        };

        // Check for and copy associated .ucas file
        const sourceUcasPath = nodePath.join(sourceDir, ucasFileName);
        if (fs.existsSync(sourceUcasPath)) {
          const destinationUcasPath = nodePath.join(stagingPath, ucasFileName);
          fs.copyFileSync(sourceUcasPath, destinationUcasPath);
          modInfo.ucasPath = destinationUcasPath;
          console.log(
            `[Main Process] Copied ${ucasFileName} to ${destinationUcasPath}`
          );
        }

        // Check for and copy associated .utoc file
        const sourceUtocPath = nodePath.join(sourceDir, utocFileName);
        if (fs.existsSync(sourceUtocPath)) {
          const destinationUtocPath = nodePath.join(stagingPath, utocFileName);
          fs.copyFileSync(sourceUtocPath, destinationUtocPath);
          modInfo.utocPath = destinationUtocPath;
          console.log(
            `[Main Process] Copied ${utocFileName} to ${destinationUtocPath}`
          );
        }

        processedModsInfo.push(modInfo);
      }

      console.log(
        '[Main Process] Successfully processed dropped mods:',
        processedModsInfo.map((m) => m.name)
      );
      return { success: true, mods: processedModsInfo };
    } catch (error: any) {
      console.error('[Main Process] Error processing dropped mods:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to copy mods to staging area: ${errorMessage}`,
      };
    }
  }
);

// --- IPC Handlers for Mod Staging Path Configuration ---

/**
 * @typedef {object} ModStagingPathConfig
 * @property {string | null} customPath - The custom staging path set by the user, or null if not set.
 * @property {string} defaultPath - The default staging path.
 * @property {string} activePath - The currently active staging path (either custom or default).
 */

/**
 * Handles the 'get-mod-staging-path-config' IPC event from the renderer process.
 * Returns the custom, default, and active mod staging paths.
 * @returns {Promise<ModStagingPathConfig>} An object containing path configurations.
 */
ipcMain.handle('get-mod-staging-path-config', async () => {
  log.info('[Main Process] Renderer requested mod staging path configuration.');
  const customPath = store.get('modStagingPath');
  const defaultPath = getDefaultStagingPath();
  const activePath = getCurrentStagingPath(); // This already incorporates the logic

  return {
    customPath: typeof customPath === 'string' ? customPath : null,
    defaultPath,
    activePath,
  };
});

/**
 * Handles the 'set-mod-staging-path' IPC event from the renderer process.
 * Allows the user to select a new directory for staging mods.
 * If a directory is selected, it's saved in the store.
 * If the user cancels or selects nothing, no changes are made.
 * To reset to default, the renderer should call 'clear-mod-staging-path'.
 *
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 *          An object indicating success or failure, and the new path if successful.
 */
ipcMain.handle('set-mod-staging-path', async () => {
  log.info('[Main Process] Renderer requested to set a new mod staging path.');
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Mod Staging Directory',
    defaultPath: getCurrentStagingPath(), // Suggest current or default path
  });

  if (canceled || filePaths.length === 0) {
    log.info(
      '[Main Process] Mod staging directory selection was canceled or no folder selected.'
    );
    return { success: false, error: 'Directory selection canceled.' };
  }

  const selectedPath = filePaths[0];
  log.info(
    `[Main Process] User selected new mod staging directory: ${selectedPath}`
  );

  // It's crucial to ensure the application has write permissions to this path.
  // For simplicity, we'll assume it does for now, but in a real app,
  // you'd want to test fs.accessSync(selectedPath, fs.constants.W_OK) or similar.
  try {
    // Create the directory if it doesn't exist (though 'createDirectory' should handle this)
    if (!fs.existsSync(selectedPath)) {
      fs.mkdirSync(selectedPath, { recursive: true });
      log.info(
        `[Main Process] Created selected staging directory as it did not exist: ${selectedPath}`
      );
    }
    store.set('modStagingPath', selectedPath);
    log.info(
      `[Main Process] New mod staging path saved to store: ${selectedPath}`
    );
    return { success: true, path: selectedPath };
  } catch (error: any) {
    log.error(
      `[Main Process] Error setting new mod staging path "${selectedPath}":`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to set staging directory: ${errorMessage}`,
    };
  }
});

/**
 * Handles the 'clear-mod-staging-path' IPC event from the renderer process.
 * Clears any custom mod staging path from the store, reverting to the default.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
ipcMain.handle('clear-mod-staging-path', async () => {
  log.info('DEV: Clearing mod staging path from store.');
  try {
    store.delete('modStagingPath');
    // Logga il nuovo percorso di staging (che sarà quello di default)
    log.info(
      `[Main-DEV] Mod staging path cleared. New effective staging path: ${getCurrentStagingPath()}`
    );
    return {
      success: true,
      message: 'Mod staging path cleared and reset to default.',
    };
  } catch (error: any) {
    log.error('DEV: Error clearing mod staging path:', error);
    return { success: false, error: error.message };
  }
});

// NUOVO IPC HANDLER per ottenere il percorso di staging corrente
ipcMain.handle('get-current-staging-path-dev', async () => {
  const stagingPath = getCurrentStagingPath();
  log.info(
    `[Main-DEV] Renderer requested current staging path. Returning: ${stagingPath}`
  );
  return stagingPath;
});

// --- End IPC Handlers for Mod Staging Path Configuration ---

// Funzione ricorsiva per copiare una directory
async function copyDirRecursive(src: string, dest: string): Promise<void> {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const childItemName of fs.readdirSync(src)) {
      await copyDirRecursive(
        nodePath.join(src, childItemName),
        nodePath.join(dest, childItemName)
      );
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// --- IPC Handler for Installing Mod Enabler ---
ipcMain.handle('install-mod-enabler', async () => {
  const gameFolderPath = store.get('gameFolderPath');
  if (!gameFolderPath) {
    log.error('[Main Process] Install Mod Enabler: Game folder path not set.');
    return {
      success: false,
      error: 'Game folder path is not configured. Please set it up first.',
    };
  }

  log.info(
    '[Main Process] Attempting to install Mod Enabler to:',
    gameFolderPath
  );

  const destinationDir = nodePath.join(
    gameFolderPath,
    'BlueClient',
    'Binaries',
    'Win64'
  );

  // Definisci i percorsi sorgente RELATIVI alla directory dell'applicazione
  // __dirname in un contesto Electron Main process punta a dist-electron/main o simile se impacchettato
  // quindi dobbiamo costruire il percorso a 'electron/resources' correttamente.
  // Quando impacchettato, la cartella 'resources' è di solito al livello di app.asar o simile.
  // process.resourcesPath è un modo più affidabile per accedere alla cartella resources.
  const resourcesPath = process.resourcesPath; // Questo dovrebbe puntare alla cartella resources dell'app impacchettata

  // Se in sviluppo, process.resourcesPath potrebbe non essere definito o puntare altrove.
  // Forniamo un fallback per lo sviluppo basato sulla struttura del progetto.
  // Questo presuppone che 'electron' sia una cartella al livello della root del progetto.
  const devResourcesFallbackPath = nodePath.join(
    app.getAppPath(),
    'electron',
    'resources'
  );
  const actualResourcesPath = fs.existsSync(
    nodePath.join(resourcesPath, 'mod_enabler_payload')
  )
    ? resourcesPath
    : devResourcesFallbackPath;

  log.info(
    `[Main Process] Using resources path for Mod Enabler: ${actualResourcesPath}`
  );

  const sourceDsoundPath = nodePath.join(
    actualResourcesPath,
    'mod_enabler_payload',
    'dsound.dll'
  );
  const sourceBitfixFolderPath = nodePath.join(
    actualResourcesPath,
    'mod_enabler_payload',
    'bitfix'
  );

  const destinationDsoundPath = nodePath.join(destinationDir, 'dsound.dll');
  const destinationBitfixFolderPath = nodePath.join(destinationDir, 'bitfix');

  try {
    // 1. Assicurati che la directory di destinazione esista
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
      log.info(
        '[Main Process] Created destination directory for Mod Enabler:',
        destinationDir
      );
    }

    // 2. Controlla se i file sorgente esistono
    if (!fs.existsSync(sourceDsoundPath)) {
      const err = `Mod Enabler source file dsound.dll not found at ${sourceDsoundPath}`;
      log.error(`[Main Process] ${err}`);
      return { success: false, error: err };
    }
    if (!fs.existsSync(sourceBitfixFolderPath)) {
      const err = `Mod Enabler source folder bitfix not found at ${sourceBitfixFolderPath}`;
      log.error(`[Main Process] ${err}`);
      return { success: false, error: err };
    }

    // 3. Copia dsound.dll
    log.info(
      `[Main Process] Copying dsound.dll from ${sourceDsoundPath} to ${destinationDsoundPath}`
    );
    fs.copyFileSync(sourceDsoundPath, destinationDsoundPath);
    log.info('[Main Process] dsound.dll copied successfully.');

    // 4. Copia la cartella bitfix
    log.info(
      `[Main Process] Copying bitfix folder from ${sourceBitfixFolderPath} to ${destinationBitfixFolderPath}`
    );
    await copyDirRecursive(sourceBitfixFolderPath, destinationBitfixFolderPath);
    log.info('[Main Process] bitfix folder copied successfully.');

    return { success: true };
  } catch (error: any) {
    log.error('[Main Process] Error installing Mod Enabler:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to install Mod Enabler: ${errorMessage}`,
    };
  }
});

// --- IPC Handlers for Mod Enable/Disable ---

const GAME_MODS_SUBFOLDER = 'BlueClient/Content/Paks/~mods'; // CORRETTO: Percorso relativo standard per i mod

async function getGameModsPath(): Promise<string | null> {
  const gameFolderPath = store.get('gameFolderPath');
  if (!gameFolderPath) {
    log.error('[Enable/Disable Mod] Game folder path is not set.');
    return null;
  }
  return nodePath.join(gameFolderPath, GAME_MODS_SUBFOLDER);
}

ipcMain.handle(
  'enable-mod',
  async (event, modOriginalPath: string, modName: string) => {
    log.info(
      `[Main] Attempting to enable mod: "${modName}" from path: "${modOriginalPath}"`
    );

    const gameModsPath = await getGameModsPath();
    if (!gameModsPath) {
      log.error(
        '[Main] Game mods path could not be determined. Cannot enable mod.'
      );
      return {
        success: false,
        error: 'Game installation path not found or not configured correctly.',
      };
    }

    // Assicurati che la cartella ~mods esista
    try {
      if (!fs.existsSync(gameModsPath)) {
        await fsPromises.mkdir(gameModsPath, { recursive: true });
        log.info(`[Main] Created game mods directory: "${gameModsPath}"`);
      }
    } catch (error: any) {
      log.error(
        `[Main] Error creating game mods directory at ${gameModsPath}:`,
        error
      );
      return {
        success: false,
        error: `Failed to create game mods directory: ${error.message}`,
      };
    }

    const baseName = nodePath.basename(modOriginalPath); // e.g., MyMod.pak
    const destPakPath = nodePath.join(gameModsPath, baseName);

    // >>> INIZIO NUOVO LOGGING DETTAGLIATO <<<
    log.info(
      `[Main ENABLE_MOD_DEBUG] Original mod path (in staging): "${modOriginalPath}"`
    );
    log.info(`[Main ENABLE_MOD_DEBUG] Original base name: "${baseName}"`);
    log.info(
      `[Main ENABLE_MOD_DEBUG] Destination path (in game's ~mods): "${destPakPath}"`
    );
    // >>> FINE NUOVO LOGGING DETTAGLIATO <<<

    try {
      log.info(`[Main] Copying "${modOriginalPath}" to "${destPakPath}"`);
      await fsPromises.copyFile(modOriginalPath, destPakPath);
      log.info(
        `[Main] Successfully copied PAK file for mod "${modName}" to game directory.`
      );

      // Gestione file .ucas e .utoc associati
      const sourceDir = nodePath.dirname(modOriginalPath);
      const baseNameWithoutExt = baseName.replace(/\.pak$/, '');
      const ucasSourcePath = nodePath.join(
        sourceDir,
        `${baseNameWithoutExt}.ucas`
      );
      const utocSourcePath = nodePath.join(
        sourceDir,
        `${baseNameWithoutExt}.utoc`
      );

      try {
        if (await fsPromises.stat(ucasSourcePath)) {
          const newUcasName = `${baseNameWithoutExt}.ucas`;
          const destUcasPath = nodePath.join(gameModsPath, newUcasName);
          log.info(`[Enable Mod] Copying ${ucasSourcePath} to ${destUcasPath}`);
          await fsPromises.copyFile(ucasSourcePath, destUcasPath);
        }
      } catch (e) {
        // File .ucas non trovato, va bene
        log.info(`[Enable Mod] No .ucas file found for ${baseName}`);
      }

      try {
        if (await fsPromises.stat(utocSourcePath)) {
          const newUtocName = `${baseNameWithoutExt}.utoc`;
          const destUtocPath = nodePath.join(gameModsPath, newUtocName);
          log.info(`[Enable Mod] Copying ${utocSourcePath} to ${destUtocPath}`);
          await fsPromises.copyFile(utocSourcePath, destUtocPath);
        }
      } catch (e) {
        // File .utoc non trovato, va bene
        log.info(`[Enable Mod] No .utoc file found for ${baseName}`);
      }

      log.info(
        `[Enable Mod] Mod ${baseName} enabled successfully as ${baseName}`
      );
      return { success: true, newPath: destPakPath }; // Potremmo voler ritornare il nuovo path completo
    } catch (error: any) {
      log.error(`[Enable Mod] Error enabling mod ${baseName}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error during mod enabling.',
      };
    }
  }
);

ipcMain.handle('disable-mod', async (event, baseModName: string) => {
  // baseModName qui dovrebbe essere il nome del file SENZA estensione, es. "MyMod"
  // Se il renderer invia "MyMod.pak", dobbiamo normalizzarlo.
  const cleanBaseModName = baseModName.replace(/\.pak$/, '');

  log.info(`[Disable Mod] Request to disable mod: ${cleanBaseModName}`);
  const gameModsPath = await getGameModsPath();
  if (!gameModsPath) {
    return { success: false, error: 'Game folder path not configured.' };
  }

  const pakFileNameToDelete = `${cleanBaseModName}.pak`;
  const ucasFileNameToDelete = `${cleanBaseModName}.ucas`;
  const utocFileNameToDelete = `${cleanBaseModName}.utoc`;

  let deleteOccurred = false;

  try {
    // Elimina il file .pak
    const fullPakPath = nodePath.join(gameModsPath, pakFileNameToDelete);
    if (fs.existsSync(fullPakPath)) {
      log.info(`[Disable Mod] Deleting ${fullPakPath}`);
      await fsPromises.unlink(fullPakPath);
      deleteOccurred = true;
    } else {
      log.warn(
        `[Disable Mod] PAK file not found for ${cleanBaseModName} at ${fullPakPath}`
      );
    }

    // Elimina il file .ucas associato, se esiste
    const fullUcasPath = nodePath.join(gameModsPath, ucasFileNameToDelete);
    if (fs.existsSync(fullUcasPath)) {
      log.info(`[Disable Mod] Deleting ${fullUcasPath}`);
      await fsPromises.unlink(fullUcasPath);
      deleteOccurred = true;
    } else {
      log.info(
        `[Disable Mod] No .ucas file found for ${cleanBaseModName} at ${fullUcasPath}`
      );
    }

    // Elimina il file .utoc associato, se esiste
    const fullUtocPath = nodePath.join(gameModsPath, utocFileNameToDelete);
    if (fs.existsSync(fullUtocPath)) {
      log.info(`[Disable Mod] Deleting ${fullUtocPath}`);
      await fsPromises.unlink(fullUtocPath);
      deleteOccurred = true;
    } else {
      log.info(
        `[Disable Mod] No .utoc file found for ${cleanBaseModName} at ${fullUtocPath}`
      );
    }

    if (deleteOccurred) {
      log.info(`[Disable Mod] Mod ${cleanBaseModName} disabled successfully.`);
      return { success: true };
    } else {
      log.warn(
        `[Disable Mod] No files found for mod ${cleanBaseModName} in ${gameModsPath}. It might have been already disabled or named differently.`
      );
      return {
        success: true, // Consideriamo comunque un successo se i file non ci sono
        message: 'Mod files not found, possibly already disabled or removed.',
      };
    }
  } catch (error: any) {
    log.error(`[Disable Mod] Error disabling mod ${cleanBaseModName}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error during mod disabling.',
    };
  }
});

// --- END IPC Handlers for Mod Enable/Disable ---

// --- IPC Handlers for Saving/Loading Mod Lists ---
ipcMain.handle('load-mod-lists', async () => {
  log.info('[Main] Renderer requested to load mod lists.');
  try {
    const disabledMods = store.get('savedDisabledMods', []); // Default a array vuoto se non trovato
    const enabledMods = store.get('savedEnabledMods', []); // Default a array vuoto se non trovato
    log.info(
      `[Main] Loaded ${disabledMods.length} disabled mods and ${enabledMods.length} enabled mods from store.`
    );
    return { success: true, disabledMods, enabledMods };
  } catch (error: any) {
    log.error('[Main] Error loading mod lists from store:', error);
    return {
      success: false,
      error: error.message || 'Unknown error loading mod lists.',
      disabledMods: [], // Restituisci array vuoti in caso di errore
      enabledMods: [],
    };
  }
});

ipcMain.handle(
  'save-mod-lists',
  async (
    event,
    modLists: {
      disabledMods: ModItemForStore[];
      enabledMods: ModItemForStore[];
    }
  ) => {
    log.info(
      `[Main] Renderer requested to save mod lists. Disabled: ${modLists.disabledMods.length}, Enabled: ${modLists.enabledMods.length}`
    );
    try {
      store.set('savedDisabledMods', modLists.disabledMods);
      store.set('savedEnabledMods', modLists.enabledMods);
      log.info('[Main] Mod lists saved successfully to store.');
      return { success: true };
    } catch (error: any) {
      log.error('[Main] Error saving mod lists to store:', error);
      return {
        success: false,
        error: error.message || 'Unknown error saving mod lists.',
      };
    }
  }
);

// --- END IPC Handlers for Saving/Loading Mod Lists ---

// --- IPC Handler for Scanning Staging Directory ---
ipcMain.handle('scan-staging-directory', async () => {
  const stagingPath = getCurrentStagingPath();
  log.info(`[Main] Scanning staging directory: ${stagingPath}`);

  try {
    if (!fs.existsSync(stagingPath)) {
      log.info(
        '[Main] Staging directory does not exist. Returning empty list.'
      );
      return { success: true, mods: [] };
    }

    const files = await fsPromises.readdir(stagingPath);
    const pakFiles: ModItemForStore[] = [];

    for (const file of files) {
      if (nodePath.extname(file).toLowerCase() === '.pak') {
        const filePath = nodePath.join(stagingPath, file);
        // Potenzialmente qui potremmo voler leggere più metadati dal file .pak se necessario
        // Per ora, usiamo il nome del file come nome del mod e il path come ID.
        pakFiles.push({
          id: filePath, // Usare il path completo come ID unico
          name: file, // Nome del file
          path: filePath, // Path completo al file .pak nella staging
        });
      }
    }
    log.info(
      `[Main] Found ${pakFiles.length} .pak files in staging directory.`
    );
    return { success: true, mods: pakFiles };
  } catch (error: any) {
    log.error('[Main] Error scanning staging directory:', error);
    return {
      success: false,
      error: error.message || 'Unknown error scanning staging directory.',
      mods: [],
    };
  }
});
// --- END IPC Handler for Scanning Staging Directory ---

// --- Helper function to scan a directory for .pak files and return ModItemForStore[] ---
async function scanDirectoryForPaks(
  directoryPath: string | null
): Promise<ModItemForStore[]> {
  if (!directoryPath || !fs.existsSync(directoryPath)) {
    log.info(
      `[scanDirectoryForPaks] Directory does not exist or path is null: ${directoryPath}`
    );
    return [];
  }

  try {
    const files = await fsPromises.readdir(directoryPath);
    const pakFiles: ModItemForStore[] = [];
    for (const file of files) {
      if (nodePath.extname(file).toLowerCase() === '.pak') {
        const filePath = nodePath.join(directoryPath, file);
        // Per coerenza, l'ID è il path completo del .pak, il nome è il nome del file.
        pakFiles.push({
          id: filePath,
          name: file, // Questo è il nome del file con estensione, es: MyMod.pak
          path: filePath,
        });
      }
    }
    log.info(
      `[scanDirectoryForPaks] Found ${pakFiles.length} .pak files in ${directoryPath}`
    );
    return pakFiles;
  } catch (error: any) {
    log.error(
      `[scanDirectoryForPaks] Error scanning directory ${directoryPath}:`,
      error
    );
    return []; // Restituisce array vuoto in caso di errore
  }
}
// --- END Helper function ---

// --- IPC Handler for Synchronizing Mod States ---
ipcMain.handle('sync-mod-states', async () => {
  log.info('[Main - sync-mod-states] Starting mod state synchronization.');
  try {
    const stagingPath = getCurrentStagingPath();
    const gameModsPath = await getGameModsPath(); // Path to game's ~mods directory

    const storeDisabledMods: ModItemForStore[] = store.get(
      'savedDisabledMods',
      []
    );
    const storeEnabledMods: ModItemForStore[] = store.get(
      'savedEnabledMods',
      []
    );

    log.info(
      `[sync-mod-states] Store state - Disabled: ${storeDisabledMods.length}, Enabled: ${storeEnabledMods.length}`
    );

    const actualStagedPaks = await scanDirectoryForPaks(stagingPath); // Mods in staging folder
    const actualGamePaks = await scanDirectoryForPaks(gameModsPath); // Mods in game's ~mods folder

    const finalEnabledMods: ModItemForStore[] = [];
    const finalDisabledMods: ModItemForStore[] = [];
    const finalEnabledModIds = new Set<string>(); // Store IDs (paths) of mods decided to be enabled
    const finalDisabledModIds = new Set<string>(); // Store IDs (paths) of mods decided to be disabled

    // Convert actualGamePaks to a Map for quick lookup by base name
    const gamePakMapByName = new Map<string, ModItemForStore>();
    actualGamePaks.forEach((pak) => {
      const baseName = nodePath.basename(pak.name, '.pak');
      gamePakMapByName.set(baseName, pak);
    });

    // Convert actualStagedPaks to a Map for quick lookup by path (ID)
    const stagedPakMapById = new Map<string, ModItemForStore>();
    actualStagedPaks.forEach((pak) => stagedPakMapById.set(pak.id, pak));

    // 1. Process mods enabled in store
    for (const storeMod of storeEnabledMods) {
      const stagedEquivalent = stagedPakMapById.get(storeMod.path); // mod.path from store is the staging path
      if (stagedEquivalent) {
        // Check if it's also in game's ~mods folder
        const gameEquivalent = gamePakMapByName.get(
          nodePath.basename(stagedEquivalent.name, '.pak')
        ); // Use stagedEquivalent.name for basename
        if (
          gameEquivalent &&
          nodePath.basename(gameEquivalent.name) ===
            nodePath.basename(stagedEquivalent.name)
        ) {
          // Mod exists in staging and in game ~mods folder
          finalEnabledMods.push(stagedEquivalent); // Use the ModItem from staging for consistency
          finalEnabledModIds.add(stagedEquivalent.id);
        } else {
          // Mod exists in staging, but not in game's ~mods. Treat as disabled.
          log.warn(
            `[sync-mod-states] Mod "${stagedEquivalent.name}" was enabled in store, found in staging, but NOT in game's ~mods. Moving to disabled.`
          );
          finalDisabledMods.push(stagedEquivalent);
          finalDisabledModIds.add(stagedEquivalent.id);
        }
      } else {
        log.warn(
          `[sync-mod-states] Mod "${storeMod.name}" (path: ${storeMod.path}) was enabled in store, but NOT found in staging. Removing from lists.`
        );
        // If source in staging is gone, it cannot be active or disabled.
      }
    }

    // 2. Process mods disabled in store
    for (const storeMod of storeDisabledMods) {
      const stagedEquivalent = stagedPakMapById.get(storeMod.path);
      if (stagedEquivalent) {
        if (
          !finalEnabledModIds.has(stagedEquivalent.id) &&
          !finalDisabledModIds.has(stagedEquivalent.id)
        ) {
          finalDisabledMods.push(stagedEquivalent);
          finalDisabledModIds.add(stagedEquivalent.id);
        }
      } else {
        log.warn(
          `[sync-mod-states] Mod "${storeMod.name}" (path: ${storeMod.path}) was disabled in store, but NOT found in staging. Removing from lists.`
        );
      }
    }

    // 3. Process mods found in game's ~mods folder that weren't in store's enabled list (and thus not in finalEnabledMods yet)
    for (const gamePak of actualGamePaks) {
      // Try to find its source in the staging folder by matching base name
      const baseNameOfGamePak = nodePath.basename(gamePak.name, '.pak');
      let correspondingStagedPak: ModItemForStore | undefined = undefined;
      for (const stagedPak of actualStagedPaks) {
        // Iterate over the array, not the map for this
        if (nodePath.basename(stagedPak.name, '.pak') === baseNameOfGamePak) {
          correspondingStagedPak = stagedPak;
          break;
        }
      }

      if (correspondingStagedPak) {
        if (!finalEnabledModIds.has(correspondingStagedPak.id)) {
          log.info(
            `[sync-mod-states] Mod "${correspondingStagedPak.name}" found in game's ~mods and staging, but not in current finalEnabledMods list. Marking as enabled.`
          );
          finalEnabledMods.push(correspondingStagedPak);
          finalEnabledModIds.add(correspondingStagedPak.id);
          // If it was accidentally in finalDisabledMods from a previous step (e.g. store said enabled, but not in game, so moved to disabled)
          // ensure it's removed from disabled if we are now affirmatively enabling it because it *is* in game ~mods.
          if (finalDisabledModIds.has(correspondingStagedPak.id)) {
            const index = finalDisabledMods.findIndex(
              (m) => m.id === correspondingStagedPak!.id
            );
            if (index > -1) finalDisabledMods.splice(index, 1);
            finalDisabledModIds.delete(correspondingStagedPak.id);
          }
        }
      } else {
        log.warn(
          `[sync-mod-states] Mod "${gamePak.name}" found in game's ~mods, but no corresponding source file found in staging. Cannot manage this mod.`
        );
        // This is an "orphaned" mod in the game's ~mods folder.
      }
    }

    // 4. Process mods found in staging that are not yet in any list (these are new/untracked mods)
    for (const stagedPak of actualStagedPaks) {
      if (
        !finalEnabledModIds.has(stagedPak.id) &&
        !finalDisabledModIds.has(stagedPak.id)
      ) {
        log.info(
          `[sync-mod-states] Mod "${stagedPak.name}" found in staging, not in any processed list. Marking as disabled by default.`
        );
        finalDisabledMods.push(stagedPak);
        finalDisabledModIds.add(stagedPak.id);
      }
    }

    // Final deduplication and ensure no mod is in both lists
    // Rebuild from IDs to ensure unique objects if any were added multiple times by mistake
    const uniqueFinalEnabledMods = Array.from(finalEnabledModIds).map(
      (id) => stagedPakMapById.get(id)!
    );
    // For disabled, ensure they are in staging and not in the final enabled list
    const uniqueFinalDisabledMods = Array.from(finalDisabledModIds)
      .map((id) => stagedPakMapById.get(id)!)
      .filter((mod) => mod && !finalEnabledModIds.has(mod.id));

    log.info(
      `[sync-mod-states] Synchronization complete. Final - Disabled: ${uniqueFinalDisabledMods.length}, Enabled: ${uniqueFinalEnabledMods.length}`
    );

    return {
      success: true,
      disabledMods: uniqueFinalDisabledMods,
      enabledMods: uniqueFinalEnabledMods,
    };
  } catch (error: any) {
    log.error(
      '[sync-mod-states] Error during mod state synchronization:',
      error
    );
    return {
      success: false,
      error: error.message || 'Unknown error during mod state synchronization.',
      disabledMods: [],
      enabledMods: [],
    };
  }
});

// --- END IPC Handler for Synchronizing Mod States ---
