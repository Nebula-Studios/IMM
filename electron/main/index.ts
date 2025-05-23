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

// Define a schema for the store
interface StoreSchema {
  gameFolderPath?: string;
  modStagingPath?: string;
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
  log.info(
    '[Main Process] Renderer requested to clear custom mod staging path.'
  );
  try {
    store.delete('modStagingPath');
    log.info(
      '[Main Process] Custom mod staging path cleared from store. Will revert to default.'
    );
    return { success: true };
  } catch (error: any) {
    log.error('[Main Process] Error clearing custom mod staging path:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to clear custom staging path: ${errorMessage}`,
    };
  }
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
