import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import AdmZip from 'adm-zip'; // Aggiunto per la gestione degli ZIP
import { createExtractorFromFile } from 'node-unrar-js'; // Aggiunto per la gestione dei RAR
// 7zip-min sarà importato usando 'require' più avanti a causa di problemi con l'importazione ESM e i tipi
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
  path: string; // Percorso di staging del file .pak principale
  activePath?: string; // Percorso della cartella del mod nella directory ~mods del gioco (es. C:\...\~mods\000_NomeMod)
}

interface StoreSchema {
  gameFolderPath?: string;
  modStagingPath?: string;
  savedDisabledMods?: ModItemForStore[]; // activePath non è rilevante per i mod disabilitati
  savedEnabledMods?: ModItemForStore[]; // activePath è rilevante qui
  theme?: 'light' | 'dark' | 'system';
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
          // activePath non è memorizzato per i mod disabilitati
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
          activePath: { type: 'string' }, // Può essere undefined se non ancora determinato o se il mod è stato disabilitato
        },
        required: ['id', 'name', 'path'], // activePath non è required, può essere aggiunto dinamicamente
      },
      default: [], // Default a un array vuoto
    },
    theme: {
      type: 'string',
      enum: ['light', 'dark', 'system'],
      default: 'system',
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
    // win.webContents.openDevTools(); // LEAVE COMMENTED FOR NOW
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
// Function to sanitize a string to be used as a directory name
function sanitizeDirectoryName(name: string): string {
  let sanitized = name.trim();
  // Remove invalid characters for Windows/Unix and control characters
  sanitized = sanitized.replace(/[<>:"/\\\\|?*\x00-\x1F]/g, '_');
  // Replace whitespace sequences with a single underscore
  sanitized = sanitized.replace(/\s+/g, '_'); // Corretto: \s+ invece di \\s+
  // Remove any character that is not alphanumeric, underscore, hyphen, or period
  sanitized = sanitized.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  // Collapse multiple underscores
  sanitized = sanitized.replace(/__+/g, '_');
  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');

  if (sanitized.length === 0) {
    sanitized = 'untitled_mod';
  }

  // Avoid Windows reserved names (very basic check)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(sanitized.split('.')[0])) {
    sanitized = `_${sanitized}`;
  }
  // Limit length
  return sanitized.substring(0, 250);
}

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
    log.info(`[Main Process] Staging path for mods: ${stagingPath}`);
    log.info(
      `[Main Process] Received ${filePaths.length} files/folders to process: ${filePaths.join(', ')}`
    );

    const tempExtractionBaseDir = nodePath.join(
      app.getPath('temp'),
      'inzoi-mod-manager-unzips'
    );
    const extractionFoldersToClean: string[] = [];

    try {
      if (!fs.existsSync(stagingPath)) {
        fs.mkdirSync(stagingPath, { recursive: true });
        log.info(`[Main Process] Created staging directory: ${stagingPath}`);
      }
      if (!fs.existsSync(tempExtractionBaseDir)) {
        fs.mkdirSync(tempExtractionBaseDir, { recursive: true });
        log.info(
          `[Main Process] Created base temporary extraction directory: ${tempExtractionBaseDir}`
        );
      }

      const processedModsInfo: ProcessedModInfo[] = [];
      const filesToStage: string[] = []; // Lista per i .pak da mettere in staging

      for (const originalSourcePath of filePaths) {
        const fileExtension = nodePath
          .extname(originalSourcePath)
          .toLowerCase();
        log.info(
          `[Main Process] Processing original source: ${originalSourcePath} (type: ${fileExtension})`
        );

        const findPaksRecursive = (dir: string): string[] => {
          let paks: string[] = [];
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = nodePath.join(dir, entry.name);
            if (entry.isDirectory()) {
              paks = paks.concat(findPaksRecursive(fullPath));
            } else if (
              entry.isFile() &&
              nodePath.extname(entry.name).toLowerCase() === '.pak'
            ) {
              paks.push(fullPath);
            }
          }
          return paks;
        };

        if (fileExtension === '.zip') {
          log.info(`[Main Process] Identified ZIP file: ${originalSourcePath}`);
          const tempExtractDir = nodePath.join(
            tempExtractionBaseDir,
            `extract_zip_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
          );
          extractionFoldersToClean.push(tempExtractDir);

          try {
            if (!fs.existsSync(tempExtractDir)) {
              fs.mkdirSync(tempExtractDir, { recursive: true });
            }
            const zip = new AdmZip(originalSourcePath);
            zip.extractAllTo(tempExtractDir, /*overwrite*/ true);
            log.info(
              `[Main Process] Extracted ZIP ${originalSourcePath} to ${tempExtractDir}`
            );
            const extractedPaks = findPaksRecursive(tempExtractDir);
            if (extractedPaks.length > 0) {
              log.info(
                `[Main Process] Found ${extractedPaks.length} .pak file(s) in extracted ZIP ${originalSourcePath}: ${extractedPaks.join(', ')}`
              );
              filesToStage.push(...extractedPaks);
            } else {
              log.warn(
                `[Main Process] No .pak files found in extracted ZIP: ${originalSourcePath}`
              );
            }
          } catch (zipError: any) {
            log.error(
              `[Main Process] Error processing ZIP file ${originalSourcePath}: ${zipError.message}`,
              zipError
            );
          }
        } else if (fileExtension === '.rar') {
          log.info(`[Main Process] Identified RAR file: ${originalSourcePath}`);
          const tempExtractDir = nodePath.join(
            tempExtractionBaseDir,
            `extract_rar_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
          );
          extractionFoldersToClean.push(tempExtractDir);

          try {
            if (!fs.existsSync(tempExtractDir)) {
              fs.mkdirSync(tempExtractDir, { recursive: true });
            }
            const extractor = await createExtractorFromFile({
              filepath: originalSourcePath,
              targetPath: tempExtractDir,
            });
            [...extractor.extract().files]; // Esegui l'estrazione
            log.info(
              `[Main Process] Extracted RAR ${originalSourcePath} to ${tempExtractDir}`
            );
            const extractedPaks = findPaksRecursive(tempExtractDir);
            if (extractedPaks.length > 0) {
              log.info(
                `[Main Process] Found ${extractedPaks.length} .pak file(s) in extracted RAR ${originalSourcePath}: ${extractedPaks.join(', ')}`
              );
              filesToStage.push(...extractedPaks);
            } else {
              log.warn(
                `[Main Process] No .pak files found in extracted RAR: ${originalSourcePath}`
              );
            }
          } catch (rarError: any) {
            log.error(
              `[Main Process] Error processing RAR file ${originalSourcePath}: ${rarError.message}`,
              rarError
            );
          }
        } else if (fileExtension === '.7z') {
          log.info(`[Main Process] Identified 7z file: ${originalSourcePath}`);
          const tempExtractDir = nodePath.join(
            tempExtractionBaseDir,
            `extract_7z_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
          );
          extractionFoldersToClean.push(tempExtractDir);

          try {
            if (!fs.existsSync(tempExtractDir)) {
              fs.mkdirSync(tempExtractDir, { recursive: true });
            }
            // Importa 7zip-min usando require a causa di problemi con ESM/tipi
            const SevenZipLib = require('7zip-min');
            await SevenZipLib.extractFull(originalSourcePath, tempExtractDir);
            log.info(
              `[Main Process] Extracted 7z ${originalSourcePath} to ${tempExtractDir}`
            );
            const extractedPaks = findPaksRecursive(tempExtractDir);
            if (extractedPaks.length > 0) {
              log.info(
                `[Main Process] Found ${extractedPaks.length} .pak file(s) in extracted 7z ${originalSourcePath}: ${extractedPaks.join(', ')}`
              );
              filesToStage.push(...extractedPaks);
            } else {
              log.warn(
                `[Main Process] No .pak files found in extracted 7z: ${originalSourcePath}`
              );
            }
          } catch (sevenZipError: any) {
            log.error(
              `[Main Process] Error processing 7z file ${originalSourcePath}: ${sevenZipError.message}`,
              sevenZipError
            );
          }
        } else if (fileExtension === '.pak') {
          filesToStage.push(originalSourcePath);
        } else {
          log.warn(
            `[Main Process] Skipped non-PAK, non-ZIP, non-RAR, non-7z file: ${originalSourcePath}`
          );
        }
      }

      if (filesToStage.length === 0) {
        log.info(
          '[Main Process] No .pak files (direct or from archives) to stage.'
        );
        // Non è un errore, semplicemente non ci sono mod validi da processare.
        // La pulizia avverrà nel blocco finally.
        return { success: true, mods: [] };
      }

      log.info(
        `[Main Process] Total .pak files to stage (from direct drop or archives): ${filesToStage.length} - ${filesToStage.join(', ')}`
      );

      for (const sourceFilePath of filesToStage) {
        const sourceDir = nodePath.dirname(sourceFilePath);
        const baseName = nodePath.basename(sourceFilePath, '.pak');
        const sanitizedModName = sanitizeDirectoryName(baseName);
        const modSpecificStagingDir = nodePath.join(
          stagingPath,
          sanitizedModName
        );

        if (!fs.existsSync(modSpecificStagingDir)) {
          fs.mkdirSync(modSpecificStagingDir, { recursive: true });
          log.info(
            `[Main Process] Created mod-specific staging directory: ${modSpecificStagingDir}`
          );
        }

        const pakFileName = `${baseName}.pak`; // Usa il baseName per consistenza
        const ucasFileName = `${baseName}.ucas`;
        const utocFileName = `${baseName}.utoc`;
        const destinationPakPath = nodePath.join(
          modSpecificStagingDir,
          pakFileName
        );

        fs.copyFileSync(sourceFilePath, destinationPakPath);
        log.info(
          `[Main Process] Copied ${pakFileName} from ${sourceFilePath} to ${destinationPakPath}`
        );

        const modInfo: ProcessedModInfo = {
          name: baseName, // Nome base del file .pak (senza estensione)
          pakPath: destinationPakPath,
          ucasPath: null,
          utocPath: null,
          originalPath: sourceFilePath, // Path originale del .pak, sia esso diretto o estratto da ZIP
        };

        const sourceUcasPath = nodePath.join(sourceDir, ucasFileName);
        if (fs.existsSync(sourceUcasPath)) {
          const destinationUcasPath = nodePath.join(
            modSpecificStagingDir,
            ucasFileName
          );
          fs.copyFileSync(sourceUcasPath, destinationUcasPath);
          modInfo.ucasPath = destinationUcasPath;
          log.info(
            `[Main Process] Copied ${ucasFileName} from ${sourceUcasPath} to ${destinationUcasPath}`
          );
        }

        const sourceUtocPath = nodePath.join(sourceDir, utocFileName);
        if (fs.existsSync(sourceUtocPath)) {
          const destinationUtocPath = nodePath.join(
            modSpecificStagingDir,
            utocFileName
          );
          fs.copyFileSync(sourceUtocPath, destinationUtocPath);
          modInfo.utocPath = destinationUtocPath;
          log.info(
            `[Main Process] Copied ${utocFileName} from ${sourceUtocPath} to ${destinationUtocPath}`
          );
        }
        processedModsInfo.push(modInfo);
      }

      log.info(
        `[Main Process] Successfully processed ${processedModsInfo.length} mods (from PAKs/ZIPs/RARs/7zs): ${processedModsInfo.map((m) => m.name).join(', ')}`
      );
      return { success: true, mods: processedModsInfo };
    } catch (error: any) {
      log.error(
        '[Main Process] Error processing dropped files (PAK/ZIP/RAR/7z):',
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to copy mods to staging area: ${errorMessage}`,
      };
    } finally {
      // Pulizia delle cartelle di estrazione temporanee
      log.info(
        `[Main Process] Starting cleanup of ${extractionFoldersToClean.length} temporary extraction folder(s).`
      );
      for (const folderToClean of extractionFoldersToClean) {
        try {
          if (fs.existsSync(folderToClean)) {
            // fs.rmdirSync(folderToClean, { recursive: true }); // Deprecato, usare fs.rmSync
            fs.rmSync(folderToClean, { recursive: true, force: true });
            log.info(
              `[Main Process] Cleaned up temporary extraction folder: ${folderToClean}`
            );
          } else {
            log.warn(
              `[Main Process] Temporary extraction folder not found for cleanup (already deleted?): ${folderToClean}`
            );
          }
        } catch (cleanupError: any) {
          log.error(
            `[Main Process] Error cleaning up temporary extraction folder ${folderToClean}: ${cleanupError.message}`
          );
          // Non far fallire l'intera operazione per un errore di pulizia
        }
      }
      log.info(
        `[Main Process] Finished cleanup of temporary extraction folders.`
      );
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
  async (event, modStagingPakPath: string, modName: string) => {
    // modStagingPakPath può essere:
    // 1. Il percorso del file .pak nell'area di staging (mod normale)
    // 2. Il percorso del file .pak nella directory ~mods (mod virtuale)
    // modName è il nome base sanificato della mod
    log.info(
      `[Main] Attempting to enable mod: "${modName}" from PAK path: "${modStagingPakPath}"`
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

    try {
      // Determina se questo è un mod virtuale (esiste già nella directory ~mods)
      const sourceModDirectory = nodePath.dirname(modStagingPakPath);
      const isVirtualMod = sourceModDirectory.startsWith(gameModsPath);

      log.info(`[Main ENABLE_MOD] Source directory: "${sourceModDirectory}"`);
      log.info(
        `[Main ENABLE_MOD] Is virtual mod (already in ~mods): ${isVirtualMod}`
      );

      if (isVirtualMod) {
        // Per i mod virtuali, dobbiamo prima copiarli nello staging
        const stagingPath = getCurrentStagingPath();
        const stagingModDirectory = nodePath.join(stagingPath, modName);

        log.info(
          `[Main ENABLE_MOD] Virtual mod detected. Copying to staging: "${stagingModDirectory}"`
        );

        // Assicurati che la directory di staging esista
        if (!fs.existsSync(stagingPath)) {
          await fsPromises.mkdir(stagingPath, { recursive: true });
          log.info(`[Main] Created staging directory: "${stagingPath}"`);
        }

        // Copia dalla directory ~mods allo staging se non esiste già
        if (!fs.existsSync(stagingModDirectory)) {
          await copyDirRecursive(sourceModDirectory, stagingModDirectory);
          log.info(
            `[Main ENABLE_MOD] Copied virtual mod from "${sourceModDirectory}" to staging "${stagingModDirectory}"`
          );
        }

        // Il mod è già attivo nella directory ~mods, quindi restituisci semplicemente il path esistente
        return { success: true, newPath: sourceModDirectory };
      }

      // Logica esistente per i mod normali dallo staging
      const itemsInGameModsDir = await fsPromises.readdir(gameModsPath);
      let maxIndex = -1;
      for (const item of itemsInGameModsDir) {
        const itemPath = nodePath.join(gameModsPath, item);
        try {
          // Assicurati che sia una directory prima di tentare di matchare il nome
          if (fs.lstatSync(itemPath).isDirectory()) {
            const match = item.match(/^(\d{3})_/); // Regex per estrarre NNN
            if (match && match[1]) {
              const currentIndex = parseInt(match[1], 10);
              if (currentIndex > maxIndex) {
                maxIndex = currentIndex;
              }
            }
          }
        } catch (e: any) {
          // Ignora errori se lstat fallisce o l'item non è una directory, ecc.
          log.warn(
            `[Enable Mod] Error processing item ${item} in ${gameModsPath}: ${e.message}`
          );
        }
      }
      const nextModIndex = maxIndex + 1; // Il prossimo indice è il massimo trovato + 1
      const numericPrefix = String(nextModIndex).padStart(3, '0');

      // Il nome della cartella di destinazione nel gioco userà il modName fornito.
      // Questo modName dovrebbe essere il nome sanificato della directory della mod nello staging.
      const targetGameModFolderName = `${numericPrefix}_${modName}`;
      const destModFolderPathInGame = nodePath.join(
        gameModsPath,
        targetGameModFolderName
      );

      // La directory sorgente è la cartella della mod nell'area di staging.
      // Se modStagingPakPath è ".../staging/MyMod/MyMod.pak",
      // allora sourceModStagingDirectory è ".../staging/MyMod/"
      const sourceModStagingDirectory = sourceModDirectory;

      log.info(
        `[Main ENABLE_MOD] Source mod staging directory: "${sourceModStagingDirectory}"`
      );
      log.info(
        `[Main ENABLE_MOD] Target mod folder name in game: "${targetGameModFolderName}"`
      );
      log.info(
        `[Main ENABLE_MOD] Full destination path in game: "${destModFolderPathInGame}"`
      );

      // Verifica se la directory sorgente esiste
      if (!fs.existsSync(sourceModStagingDirectory)) {
        log.error(
          `[Main ENABLE_MOD] Source staging directory does not exist: ${sourceModStagingDirectory}`
        );
        return {
          success: false,
          error: `Mod source directory not found in staging: ${sourceModStagingDirectory}`,
        };
      }

      // Non è necessario creare destModFolderPathInGame esplicitamente qui,
      // perché copyDirRecursive lo farà se non esiste.

      log.info(
        `[Main] Copying mod directory from "${sourceModStagingDirectory}" to "${destModFolderPathInGame}"`
      );
      await copyDirRecursive(
        sourceModStagingDirectory,
        destModFolderPathInGame
      );
      log.info(
        `[Main] Successfully copied directory for mod "${modName}" to "${destModFolderPathInGame}".`
      );

      return { success: true, newPath: destModFolderPathInGame };
    } catch (error: any) {
      log.error(`[Enable Mod] Error enabling mod ${modName}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error during mod enabling.',
      };
    }
  }
);

ipcMain.handle(
  'disable-mod',
  async (
    event,
    baseModNameInput: string,
    isVirtualModParam: boolean = false
  ) => {
    // Log IMMEDIATO dei parametri di input
    log.info(
      `[Disable Mod - ENTRY] Received baseModNameInput: "${baseModNameInput}", isVirtualModParam: ${isVirtualModParam}`
    );

    let effectiveBaseModName = baseModNameInput;
    // Usiamo isVirtualModParam qui per la condizione
    if (isVirtualModParam && /^\d{3}_/.test(baseModNameInput)) {
      log.info(
        `[Disable Mod - STRIP LOGIC] Condition TRUE. baseModNameInput: "${baseModNameInput}", isVirtualModParam: ${isVirtualModParam}. Attempting to strip prefix.`
      );
      effectiveBaseModName = baseModNameInput.substring(4);
      log.info(
        `[Disable Mod - STRIP LOGIC] Stripped. effectiveBaseModName is now: "${effectiveBaseModName}"`
      );
    } else {
      log.info(
        `[Disable Mod - STRIP LOGIC] Condition FALSE. baseModNameInput: "${baseModNameInput}", isVirtualModParam: ${isVirtualModParam}, regexTestResult: ${/^\d{3}_/.test(baseModNameInput)}.`
      );
    }

    const rawCleanBaseModName = effectiveBaseModName.replace(/\\.pak$/, '');
    log.info(
      `[Disable Mod - PRE-SANITIZE] effectiveBaseModName: "${effectiveBaseModName}", rawCleanBaseModName: "${rawCleanBaseModName}"`
    );

    const searchName = sanitizeDirectoryName(rawCleanBaseModName);
    log.info(
      `[Disable Mod - POST-SANITIZE] Sanitized searchName for comparison: "${searchName}"`
    );
    const gameModsPath = await getGameModsPath();
    if (!gameModsPath) {
      return { success: false, error: 'Game folder path not configured.' };
    }

    try {
      const itemsInGameModsDir = await fsPromises.readdir(gameModsPath);
      let modFolderToDelete: string | undefined;

      for (const item of itemsInGameModsDir) {
        const itemPath = nodePath.join(gameModsPath, item);
        log.info(
          `[Disable Mod - DEBUG] Processing item: "${item}" at path: "${itemPath}"`
        );

        let isDir = false;
        try {
          isDir = fs.lstatSync(itemPath).isDirectory();
          log.info(
            `[Disable Mod - DEBUG] Item "${item}" is a directory: ${isDir}`
          );
        } catch (e: any) {
          log.warn(
            `[Disable Mod - DEBUG] Failed to lstat item "${item}": ${e.message}. Skipping.`
          );
          continue; // Salta questo item se lstat fallisce
        }

        const isNNNPrefixed = /^\d{3}_/.test(item); // CORREZIONE: Rimosso doppio backslash
        log.info(
          `[Disable Mod - DEBUG] Item "${item}" is NNN_ prefixed: ${isNNNPrefixed}`
        );

        if (isDir && isNNNPrefixed) {
          const folderBaseName = item.substring(4); // Rimuove "NNN_"
          log.info(
            `[Disable Mod - DEBUG] Candidate folder: "${item}". Extracted folderBaseName: "${folderBaseName}". Comparing with searchName: "${searchName}" (case-insensitive)`
          );

          if (folderBaseName.toLowerCase() === searchName.toLowerCase()) {
            log.info(
              `[Disable Mod - DEBUG] Match FOUND for "${item}". folderBaseName.toLowerCase(): "${folderBaseName.toLowerCase()}", searchName.toLowerCase(): "${searchName.toLowerCase()}"`
            );
            modFolderToDelete = item;
            break;
          } else {
            log.info(
              `[Disable Mod - DEBUG] Match FAILED for "${item}". folderBaseName.toLowerCase(): "${folderBaseName.toLowerCase()}", searchName.toLowerCase(): "${searchName.toLowerCase()}"`
            );
          }
        } else {
          let reason = '';
          if (!isDir) reason += 'Not a directory. ';
          if (!isNNNPrefixed) reason += 'Not NNN_ prefixed. ';
          log.info(
            `[Disable Mod - DEBUG] Item "${item}" skipped. Reason: ${reason.trim()}`
          );
        }
      }

      if (!modFolderToDelete) {
        log.warn(
          `[Disable Mod] No directory found for base name ${searchName} in ${gameModsPath} with NNN_ prefix.`
        );
        return {
          success: true,
          message:
            'Mod directory not found, possibly already disabled or removed.',
        };
      }

      const fullPathToModFolderInGame = nodePath.join(
        gameModsPath,
        modFolderToDelete! // modFolderToDelete è garantito essere definito se siamo qui
      );

      if (isVirtualModParam) {
        // CORREZIONE: da isVirtualMod a isVirtualModParam
        log.info(
          `[Disable Mod] Virtual mod "${searchName}" (folder ${modFolderToDelete}) detected. Moving from game's ~mods to staging and then removing from ~mods.`
        );
        const stagingPath = getCurrentStagingPath();
        // searchName è già il nome sanificato della cartella come dovrebbe essere nello staging
        const stagingModDirectoryPath = nodePath.join(stagingPath, searchName);

        try {
          // 1. Assicurati che la directory di staging esista
          if (!fs.existsSync(stagingPath)) {
            await fsPromises.mkdir(stagingPath, { recursive: true });
            log.info(
              `[Disable Mod - Virtual] Created staging directory: "${stagingPath}"`
            );
          }

          // 2. Copia la cartella del mod da ~mods allo staging
          //    Sovrascrivi se esiste già nello staging (potrebbe essere una versione vecchia)
          if (fs.existsSync(stagingModDirectoryPath)) {
            log.warn(
              `[Disable Mod - Virtual] Staging directory "${stagingModDirectoryPath}" already exists. It will be overwritten.`
            );
            await fsPromises.rm(stagingModDirectoryPath, {
              recursive: true,
              force: true,
            });
          }

          log.info(
            `[Disable Mod - Virtual] Attempting to copy from (game ~mods): "${fullPathToModFolderInGame}" to (staging): "${stagingModDirectoryPath}"`
          );
          if (!fs.existsSync(fullPathToModFolderInGame)) {
            log.error(
              `[Disable Mod - Virtual] CRITICAL PRE-COPY CHECK: Source directory "${fullPathToModFolderInGame}" does NOT exist. Aborting copy.`
            );
            // Potresti voler restituire un errore qui per evitare ulteriori problemi
            // return { success: false, error: `Source mod directory ${fullPathToModFolderInGame} not found for virtual mod.` };
          } else {
            log.info(
              `[Disable Mod - Virtual] PRE-COPY CHECK: Source directory "${fullPathToModFolderInGame}" exists.`
            );
          }

          await copyDirRecursive(
            fullPathToModFolderInGame,
            stagingModDirectoryPath
          );
          log.info(
            `[Disable Mod - Virtual] Call to copyDirRecursive completed. Source: "${fullPathToModFolderInGame}", Destination: "${stagingModDirectoryPath}".`
          );

          // Verifica se la directory di staging è stata creata/popolata
          const stagingDirExistsAfterCopy = fs.existsSync(
            stagingModDirectoryPath
          );
          log.info(
            `[Disable Mod - Virtual] Verification after copy: Staging directory "${stagingModDirectoryPath}" exists: ${stagingDirExistsAfterCopy}`
          );
          if (stagingDirExistsAfterCopy) {
            const filesInStagingDir = fs.readdirSync(stagingModDirectoryPath);
            log.info(
              `[Disable Mod - Virtual] Files in staging directory "${stagingModDirectoryPath}" after copy: ${filesInStagingDir.join(', ')} (Count: ${filesInStagingDir.length})`
            );
            if (filesInStagingDir.length === 0) {
              log.warn(
                `[Disable Mod - Virtual] Staging directory "${stagingModDirectoryPath}" was created but is empty after copy attempt from "${fullPathToModFolderInGame}".`
              );
            }
          } else {
            log.error(
              `[Disable Mod - Virtual] CRITICAL: Staging directory "${stagingModDirectoryPath}" was NOT created after copy attempt from "${fullPathToModFolderInGame}".`
            );
          }

          // 3. Rimuovi la cartella del mod dalla directory ~mods del gioco
          //    Questa parte verrà eseguita solo se la copia non ha generato un errore che ha interrotto il blocco try.
          //    Se la stagingDirExistsAfterCopy è false, la rimozione qui sotto è problematica.
          if (!stagingDirExistsAfterCopy) {
            log.error(
              `[Disable Mod - Virtual] SKIPPING deletion from ~mods because staging copy failed for "${fullPathToModFolderInGame}".`
            );
            // Considera di lanciare un errore o restituire un fallimento qui
            // throw new Error(`Failed to copy virtual mod ${searchName} to staging. Deletion from ~mods aborted.`);
          } else {
            // Procedi con la rimozione solo se la copia nello staging sembra essere andata a buon fine
            log.info(
              `[Disable Mod - Virtual] Deleting directory ${fullPathToModFolderInGame} from game's ~mods.`
            );
            await fsPromises.rm(fullPathToModFolderInGame, {
              recursive: true,
              force: true,
            });
            // Verifica se la cartella è stata effettivamente eliminata
            const stillExistsAfterDelete = fs.existsSync(
              fullPathToModFolderInGame
            );
            log.info(
              `[Disable Mod - Virtual] Verification after delete: Path "${fullPathToModFolderInGame}" still exists: ${stillExistsAfterDelete}`
            );
            if (stillExistsAfterDelete) {
              log.error(
                `[Disable Mod - Virtual] CRITICAL: Deletion of "${fullPathToModFolderInGame}" was attempted but path still exists! This indicates a problem with file system permissions or a lock on the directory/files.`
              );
            }
          }
          log.info(
            `[Disable Mod - Virtual] Mod ${searchName} (original folder ${modFolderToDelete}) processed successfully (copy to staging and deletion from ~mods attempted).`
          );
          log.info(
            `[Disable Mod - Virtual] Deleting directory ${fullPathToModFolderInGame} from game's ~mods.`
          );
          await fsPromises.rm(fullPathToModFolderInGame, {
            recursive: true,
            force: true,
          });
          // Verifica se la cartella è stata effettivamente eliminata
          const stillExistsAfterDelete = fs.existsSync(
            fullPathToModFolderInGame
          );
          log.info(
            `[Disable Mod - Virtual] Verification after delete: Path "${fullPathToModFolderInGame}" still exists: ${stillExistsAfterDelete}`
          );
          if (stillExistsAfterDelete) {
            log.error(
              `[Disable Mod - Virtual] CRITICAL: Deletion of "${fullPathToModFolderInGame}" was attempted but path still exists! This indicates a problem with file system permissions or a lock on the directory/files.`
            );
            // Considerare di restituire un errore qui se la rimozione è fondamentale per lo stato corretto
            // return { success: false, error: `Failed to remove mod from game directory '${modFolderToDelete}' after staging. It may be locked or permissions are insufficient.` };
          }
          log.info(
            `[Disable Mod - Virtual] Mod ${searchName} (original folder ${modFolderToDelete}) processed successfully (deletion from ~mods attempted).`
          );
          return {
            success: true,
            message: `Virtual mod ${searchName} moved to staging and removed from active mods.`,
          };
        } catch (virtualModError: any) {
          log.error(
            `[Disable Mod - Virtual] Error during virtual mod processing for "${searchName}" (source: "${fullPathToModFolderInGame}", target staging: "${stagingModDirectoryPath}"):`,
            virtualModError
          );
          return {
            success: false,
            error: `Error processing virtual mod ${searchName}: ${virtualModError.message || 'Unknown error'}. Check logs for details.`,
          };
        }
      } else {
        // Logica esistente per i mod non virtuali (quelli che hanno una controparte nello staging)
        log.info(
          `[Disable Mod] Standard mod "${searchName}" (folder ${modFolderToDelete}). Deleting directory ${fullPathToModFolderInGame} from game's ~mods.`
        );
        await fsPromises.rm(fullPathToModFolderInGame, {
          recursive: true,
          force: true,
        });
        log.info(
          `[Disable Mod] Mod ${searchName} (folder ${modFolderToDelete}) disabled successfully.`
        );
        return { success: true };
      }
    } catch (error: any) {
      log.error(`[Disable Mod] Error disabling mod ${searchName}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error during mod disabling.',
      };
    }
  }
);

// --- END IPC Handlers for Mod Enable/Disable ---

// --- IPC Handlers for Saving/Loading Mod Lists ---
ipcMain.handle('load-mod-lists', async () => {
  log.info('[Main] Renderer requested to load mod lists.');
  try {
    const disabledMods = store.get('savedDisabledMods', []); // Default a array vuoto se non trovato
    const enabledMods = store.get('savedEnabledMods', []);
    log.info(
      `[Main] Loaded ${disabledMods.length} disabled mods and ${enabledMods.length} enabled mods from store.`
    );
    if (enabledMods.length > 0 && enabledMods[0]) {
      log.verbose(
        `[Main load-mod-lists] First enabled mod from store: ${JSON.stringify(enabledMods[0])}`
      );
    }
    if (disabledMods.length > 0 && disabledMods[0]) {
      log.verbose(
        `[Main load-mod-lists] First disabled mod from store: ${JSON.stringify(disabledMods[0])}`
      );
    }
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
    if (modLists.enabledMods.length > 0 && modLists.enabledMods[0]) {
      log.verbose(
        `[Main save-mod-lists] First enabled mod received from renderer to save: ${JSON.stringify(modLists.enabledMods[0])}`
      );
    }
    if (modLists.disabledMods.length > 0 && modLists.disabledMods[0]) {
      log.verbose(
        `[Main save-mod-lists] First disabled mod received from renderer to save: ${JSON.stringify(modLists.disabledMods[0])}`
      );
    }

    try {
      // Assicurati che i mod disabilitati non abbiano activePath salvato
      const disabledToSave = modLists.disabledMods.map((mod) => {
        const { activePath, ...rest } = mod;
        return rest;
      });
      store.set('savedDisabledMods', disabledToSave);

      // Salva i mod abilitati come vengono ricevuti (dovrebbero includere activePath se il renderer li invia)
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

    const items = await fsPromises.readdir(stagingPath, {
      withFileTypes: true,
    });
    const stagedMods: ModItemForStore[] = [];

    for (const item of items) {
      if (item.isDirectory()) {
        const modFolderName = item.name;
        const modFolderPath = nodePath.join(stagingPath, modFolderName);
        try {
          const filesInsideModFolder = await fsPromises.readdir(modFolderPath);
          // Cerca il primo file .pak all'interno della cartella della mod
          const pakFileName = filesInsideModFolder.find(
            (f) => nodePath.extname(f).toLowerCase() === '.pak'
          );

          if (pakFileName) {
            const pakFilePath = nodePath.join(modFolderPath, pakFileName);
            stagedMods.push({
              id: pakFilePath, // ID è il path completo al .pak
              name: modFolderName, // Nome è il nome della cartella della mod
              path: pakFilePath, // Path è lo stesso dell'ID
            });
          } else {
            log.warn(
              `[scan-staging-directory] No .pak file found in mod directory: ${modFolderPath}`
            );
          }
        } catch (e: any) {
          log.error(
            `[scan-staging-directory] Error reading mod directory ${modFolderPath}: ${e.message}`
          );
        }
      }
    }
    log.info(
      `[Main] Found ${stagedMods.length} mods (directories with .pak files) in staging directory.`
    );
    return { success: true, mods: stagedMods };
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
  directoryPath: string | null,
  isGameModsDirectory: boolean = false
): Promise<ModItemForStore[]> {
  if (!directoryPath || !fs.existsSync(directoryPath)) {
    log.info(
      `[scanDirectoryForPaks] Directory does not exist or path is null: ${directoryPath}`
    );
    return [];
  }

  try {
    const items = await fsPromises.readdir(directoryPath, {
      withFileTypes: true,
    });
    const pakFiles: ModItemForStore[] = [];

    if (isGameModsDirectory) {
      let currentItems = items; // 'items' sono i Dirent letti inizialmente
      let itemsWereChanged = false;

      // Fase 1: Identifica le cartelle da rinominare e il prossimo indice disponibile
      let maxIndex = -1;
      const directoriesToPotentiallyRename: {
        originalName: string;
        sanitizedBaseName: string;
        originalPath: string;
      }[] = [];

      for (const item of currentItems) {
        if (item.isDirectory()) {
          const match = item.name.match(/^(\d{3})_(.*)$/);
          if (match && match[1] && match[2]) {
            // Cartella con prefisso NNN_BaseName
            const currentIndex = parseInt(match[1], 10);
            if (currentIndex > maxIndex) {
              maxIndex = currentIndex;
            }
            // Verifica se il nome base necessita di sanitizzazione
            const currentBaseName = match[2];
            const sanitizedBaseName = sanitizeDirectoryName(currentBaseName);
            if (currentBaseName !== sanitizedBaseName) {
              // Il nome base necessita di sanitizzazione
              log.info(
                `[scanDirectoryForPaks] Directory "${item.name}" has base name "${currentBaseName}" that needs sanitization to "${sanitizedBaseName}".`
              );
              directoriesToPotentiallyRename.push({
                originalName: item.name,
                sanitizedBaseName: sanitizedBaseName,
                originalPath: nodePath.join(directoryPath!, item.name),
              });
            }
          } else {
            // Cartella senza prefisso NNN_
            const sanitizedBaseName = sanitizeDirectoryName(item.name);
            log.info(
              `[scanDirectoryForPaks] Directory "${item.name}" lacks NNN_ prefix. Sanitized base name: "${sanitizedBaseName}".`
            );
            directoriesToPotentiallyRename.push({
              originalName: item.name,
              sanitizedBaseName: sanitizedBaseName,
              originalPath: nodePath.join(directoryPath!, item.name),
            });
          }
        }
      }

      let nextAvailableIndex = maxIndex + 1;

      // Fase 2: Rinomina le cartelle non prefissate o quelle che necessitano di sanitizzazione
      if (directoriesToPotentiallyRename.length > 0) {
        log.info(
          `[scanDirectoryForPaks] Found ${directoriesToPotentiallyRename.length} directories to potentially rename in game mods directory.`
        );
        for (const dirToRename of directoriesToPotentiallyRename) {
          let newFolderName: string;
          const originalPrefixMatch =
            dirToRename.originalName.match(/^(\d{3})_/);

          if (originalPrefixMatch && originalPrefixMatch[1]) {
            // La cartella originale aveva un prefisso NNN_
            // Usiamo il prefisso originale e il nome base sanificato
            const originalPrefix = originalPrefixMatch[1];
            newFolderName = `${originalPrefix}_${dirToRename.sanitizedBaseName}`;
            // Non incrementare nextAvailableIndex qui, stiamo preservando il prefisso
          } else {
            // La cartella originale NON aveva un prefisso NNN_
            // Assegniamo un nuovo prefisso e usiamo il nome base sanificato
            newFolderName = `${String(nextAvailableIndex).padStart(3, '0')}_${dirToRename.sanitizedBaseName}`;
            // Solo ora incrementiamo nextAvailableIndex perché abbiamo usato un nuovo slot
            nextAvailableIndex++;
          }

          const newPath = nodePath.join(directoryPath!, newFolderName);

          if (dirToRename.originalPath !== newPath) {
            try {
              await fsPromises.rename(dirToRename.originalPath, newPath);
              log.info(
                `[scanDirectoryForPaks] Successfully renamed "${dirToRename.originalName}" to "${newFolderName}".`
              );
              itemsWereChanged = true;
            } catch (renameError: any) {
              log.error(
                `[scanDirectoryForPaks] Failed to rename "${dirToRename.originalName}" to "${newFolderName}": ${renameError.message}`
              );
            }
          } else {
            log.info(
              `[scanDirectoryForPaks] No rename needed for "${dirToRename.originalName}" as new name "${newFolderName}" results in the same path (original path: ${dirToRename.originalPath}).`
            );
          }
        }
      }

      // Fase 3: Se sono state fatte modifiche, rileggi il contenuto della directory
      const itemsToScan = itemsWereChanged
        ? await fsPromises.readdir(directoryPath!, { withFileTypes: true })
        : currentItems;

      log.info(
        `[scanDirectoryForPaks] Scanning ${itemsToScan.length} items in game mods directory${itemsWereChanged ? ' (after renaming operations)' : ''}.`
      );

      // Fase 4: Scansiona le sottocartelle NNN_ModName (logica esistente, ma usa itemsToScan)
      for (const item of itemsToScan) {
        if (item.isDirectory() && /^\d{3}_/.test(item.name)) {
          const modFolderName = item.name; // Es: 000_MyMod
          const actualModName = modFolderName.substring(4); // Es: MyMod
          const modFolderPath = nodePath.join(directoryPath, modFolderName);

          try {
            const filesInsideModFolder =
              await fsPromises.readdir(modFolderPath);
            let foundPakFile: string | undefined;
            // Cerca un file .pak che corrisponda al nome base del mod (es. MyMod.pak)
            // o il primo .pak trovato se non c'è corrispondenza esatta.
            const expectedPakName = `${actualModName}.pak`;
            if (filesInsideModFolder.includes(expectedPakName)) {
              foundPakFile = expectedPakName;
            } else {
              foundPakFile = filesInsideModFolder.find((f) =>
                f.toLowerCase().endsWith('.pak')
              );
            }

            if (foundPakFile) {
              const pakFilePath = nodePath.join(modFolderPath, foundPakFile);
              pakFiles.push({
                id: pakFilePath, // ID è il path completo al .pak dentro la cartella NNN_
                name: actualModName, // Nome è il nome base del mod (senza NNN_ e senza .pak)
                path: pakFilePath, // Path è lo stesso dell'ID (percorso del .pak di staging per riferimento)
                // Tuttavia, per i mod attivi, l'ID primario di riferimento nel renderer
                // è il path di staging. Qui stiamo scansionando la cartella ~mods.
                // Il 'path' qui dovrebbe idealmente riferirsi al path di staging originale
                // se potessimo determinarlo. Per ora, usiamo pakFilePath, ma
                // sync-mod-states dovrà riconciliare questo.
                // L'importante è activePath.
                activePath: modFolderPath, // Percorso della cartella NNN_NomeMod
              });
            } else {
              log.warn(
                `[scanDirectoryForPaks] No .pak file found in mod directory: ${modFolderPath}`
              );
            }
          } catch (e: any) {
            log.error(
              `[scanDirectoryForPaks] Error reading mod directory ${modFolderPath}: ${e.message}`
            );
          }
        }
      }
    } else {
      // Scansiona le sottocartelle per i mod (per la staging directory)
      for (const item of items) {
        if (item.isDirectory()) {
          const modFolderName = item.name;
          const modFolderPath = nodePath.join(directoryPath, modFolderName);
          try {
            const filesInsideModFolder =
              await fsPromises.readdir(modFolderPath);
            const pakFileName = filesInsideModFolder.find(
              (f) => nodePath.extname(f).toLowerCase() === '.pak'
            );

            if (pakFileName) {
              const pakFilePath = nodePath.join(modFolderPath, pakFileName);
              pakFiles.push({
                id: pakFilePath, // ID è il path completo al .pak
                name: modFolderName, // Nome è il nome della cartella della mod
                path: pakFilePath, // Path è lo stesso dell'ID
              });
            } else {
              log.warn(
                `[scanDirectoryForPaks - Staging] No .pak file found in mod directory: ${modFolderPath}`
              );
            }
          } catch (e: any) {
            log.error(
              `[scanDirectoryForPaks - Staging] Error reading mod directory ${modFolderPath}: ${e.message}`
            );
          }
        }
      }
    }

    log.info(
      `[scanDirectoryForPaks] Found ${pakFiles.length} .pak entries in ${directoryPath} (mode: ${isGameModsDirectory ? 'game_mods' : 'staging'})`
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

// --- Helper function for Mod State Synchronization Logic ---
async function synchronizeModStatesLogic(): Promise<{
  success: boolean;
  disabledMods: ModItemForStore[];
  enabledMods: ModItemForStore[];
  error?: string;
}> {
  log.info(
    '[Main - synchronizeModStatesLogic] Starting mod state synchronization logic.'
  );
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
      `[synchronizeModStatesLogic] Store state - Disabled: ${storeDisabledMods.length}, Enabled: ${storeEnabledMods.length}`
    );

    // Passa il flag corretto a scanDirectoryForPaks
    const actualStagedPaks = await scanDirectoryForPaks(stagingPath, false); // false o ometti
    const actualGamePaks = await scanDirectoryForPaks(gameModsPath, true); // true per la cartella ~mods

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
        if (gameEquivalent) {
          // gameEquivalent è l'item da actualGamePaks, quindi ha gameEquivalent.activePath
          // Mod esiste nello staging e nella cartella ~mods del gioco.
          const modToEnable: ModItemForStore = {
            ...stagedEquivalent, // Prendi i dati base dallo staging (ID, path di staging, nome cartella staging)
            activePath: gameEquivalent.activePath, // Prendi l'activePath effettivo dal file system del gioco
          };
          finalEnabledMods.push(modToEnable);
          finalEnabledModIds.add(modToEnable.id);
        } else {
          // Mod esiste nello staging, ma non nella cartella ~mods del gioco. Tratta come disabilitato.
          log.warn(
            `[synchronizeModStatesLogic] Mod "${stagedEquivalent.name}" was enabled in store, found in staging, but NOT in game's ~mods. Moving to disabled.`
          );
          const modToDisable: ModItemForStore = { ...stagedEquivalent };
          delete modToDisable.activePath; // Assicurati che non ci sia activePath
          finalDisabledMods.push(modToDisable);
          finalDisabledModIds.add(modToDisable.id);
        }
      } else {
        log.warn(
          `[synchronizeModStatesLogic] Mod "${storeMod.name}" (path: ${storeMod.path}) was enabled in store, but NOT found in staging. Removing from lists.`
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
          `[synchronizeModStatesLogic] Mod "${storeMod.name}" (path: ${storeMod.path}) was disabled in store, but NOT found in staging. Removing from lists.`
        );
      }
    }

    // 3. Process mods found in game's ~mods folder that weren't in store's enabled list (and thus not in finalEnabledMods yet)
    for (const gamePak of actualGamePaks) {
      // Try to find its source in the staging folder by matching base name
      // gamePak.name è il nome della cartella del mod nella directory ~mods (es. "MyMod" da "000_MyMod")
      // non il nome del file .pak, quindi non dobbiamo rimuovere ".pak"
      const baseNameOfGamePak = gamePak.name; // gamePak.name è già il nome base senza prefisso NNN_
      let correspondingStagedPak: ModItemForStore | undefined = undefined;
      for (const stagedPak of actualStagedPaks) {
        // stagedPak.name è il nome della cartella di staging
        // Confronta i nomi delle cartelle, non i nomi dei file .pak
        if (stagedPak.name === baseNameOfGamePak) {
          correspondingStagedPak = stagedPak;
          break;
        }
      }

      if (correspondingStagedPak) {
        if (!finalEnabledModIds.has(correspondingStagedPak.id)) {
          log.info(
            `[synchronizeModStatesLogic] Mod "${correspondingStagedPak.name}" (from staging) found in game's ~mods (as "${gamePak.name}"), but not in current finalEnabledMods list. Marking as enabled.`
          );
          const modToEnable: ModItemForStore = {
            ...correspondingStagedPak, // Dati base dallo staging
            activePath: gamePak.activePath, // activePath dalla cartella ~mods
          };
          finalEnabledMods.push(modToEnable);
          finalEnabledModIds.add(modToEnable.id);

          // Se era stato erroneamente aggiunto a finalDisabledMods, rimuovilo.
          if (finalDisabledModIds.has(correspondingStagedPak.id)) {
            const index = finalDisabledMods.findIndex(
              (m) => m.id === correspondingStagedPak!.id
            );
            if (index > -1) {
              finalDisabledMods.splice(index, 1);
              log.info(
                `[synchronizeModStatesLogic] Removed ${correspondingStagedPak.name} from finalDisabledMods as it's now confirmed enabled.`
              );
            }
            finalDisabledModIds.delete(correspondingStagedPak.id);
          }
        }
      } else {
        log.info(
          `[synchronizeModStatesLogic] Mod "${gamePak.name}" (folder ${gamePak.activePath}) found in game's ~mods, but no corresponding source file found in staging. Creating virtual staging entry for management.`
        );
        // Crea un entry virtuale per i mod che esistono solo nella directory ~mods
        // Questi mod possono essere stati aggiunti manualmente dall'utente
        const virtualStagingMod: ModItemForStore = {
          id: gamePak.id, // Usa l'ID del mod dalla directory ~mods
          name: gamePak.name, // Nome base del mod
          path: gamePak.path, // Path del .pak nella directory ~mods (non nello staging)
          activePath: gamePak.activePath, // Path della cartella nella directory ~mods
        };

        finalEnabledMods.push(virtualStagingMod);
        finalEnabledModIds.add(virtualStagingMod.id);

        log.info(
          `[synchronizeModStatesLogic] Added virtual staging entry for mod "${gamePak.name}" as enabled.`
        );
      }
    }

    // 4. Process mods found in staging that are not yet in any list (these are new/untracked mods)
    for (const stagedPak of actualStagedPaks) {
      if (
        !finalEnabledModIds.has(stagedPak.id) &&
        !finalDisabledModIds.has(stagedPak.id)
      ) {
        log.info(
          `[synchronizeModStatesLogic] Mod "${stagedPak.name}" found in staging, not in any processed list. Marking as disabled by default.`
        );
        finalDisabledMods.push(stagedPak);
        finalDisabledModIds.add(stagedPak.id);
      }
    }

    // Final deduplication using the already constructed finalEnabledMods and finalDisabledMods lists,
    // which contain ModItemForStore objects potentially enriched with activePath.
    const finalEnabledMap = new Map<string, ModItemForStore>();
    for (const mod of finalEnabledMods) {
      if (!finalEnabledMap.has(mod.id)) {
        finalEnabledMap.set(mod.id, mod);
      } else {
        // If a mod with the same ID is already in the map, prioritize the one with activePath if the current one doesn't have it.
        // This handles edge cases, though prior logic should ideally prevent needing this.
        const existingMod = finalEnabledMap.get(mod.id)!;
        if (!existingMod.activePath && mod.activePath) {
          finalEnabledMap.set(mod.id, mod);
          log.warn(
            `[synchronizeModStatesLogic] Deduplication: Updated mod ${mod.id} in finalEnabledMap with version that has activePath.`
          );
        }
      }
    }
    const uniqueFinalEnabledMods = Array.from(finalEnabledMap.values());

    const finalDisabledMap = new Map<string, ModItemForStore>();
    for (const mod of finalDisabledMods) {
      if (!finalEnabledMap.has(mod.id)) {
        // Ensure it's not in the enabled list
        if (!finalDisabledMap.has(mod.id)) {
          // Ensure activePath is not present for disabled mods
          const { activePath, ...modWithoutActivePath } = mod;
          finalDisabledMap.set(mod.id, modWithoutActivePath);
        }
      }
    }
    const uniqueFinalDisabledMods = Array.from(finalDisabledMap.values());

    log.info(
      `[synchronizeModStatesLogic] Synchronization complete. Final - Disabled: ${uniqueFinalDisabledMods.length}, Enabled: ${uniqueFinalEnabledMods.length}`
    );

    return {
      success: true,
      disabledMods: uniqueFinalDisabledMods,
      enabledMods: uniqueFinalEnabledMods,
    };
  } catch (error: any) {
    log.error(
      '[synchronizeModStatesLogic] Error during mod state synchronization:',
      error
    );
    return {
      success: false,
      error: error.message || 'Unknown error during mod state synchronization.',
      disabledMods: [],
      enabledMods: [],
    };
  }
}
// --- END Helper function for Mod State Synchronization Logic ---

// --- IPC Handler for Synchronizing Mod States ---
ipcMain.handle('sync-mod-states', async () => {
  // Ora questo handler chiama semplicemente la funzione helper
  return synchronizeModStatesLogic();
});
// --- END IPC Handler for Synchronizing Mod States ---

// --- IPC Handler for Refreshing Mod List ---
ipcMain.handle('refresh-mod-list', async () => {
  log.info('[Main - refresh-mod-list] Received request to refresh mod list.');
  try {
    // 1. Esegui la sincronizzazione degli stati dei mod chiamando la funzione helper
    const syncResult = await synchronizeModStatesLogic();

    if (!syncResult.success) {
      log.error(
        '[Main - refresh-mod-list] synchronizeModStatesLogic failed:',
        syncResult.error
      );
      return {
        success: false,
        error:
          syncResult.error ||
          'Failed to synchronize mod states during refresh.',
      };
    }

    log.info(
      `[Main - refresh-mod-list] synchronizeModStatesLogic successful. Synced Disabled: ${syncResult.disabledMods.length}, Synced Enabled: ${syncResult.enabledMods.length}`
    );

    // 2. Salva le liste sincronizzate nello store
    const disabledToSave = syncResult.disabledMods.map(
      (mod: ModItemForStore) => {
        const { activePath, ...rest } = mod; // Assicurati che activePath non sia salvato per i disabilitati
        return rest;
      }
    );
    store.set('savedDisabledMods', disabledToSave);
    store.set('savedEnabledMods', syncResult.enabledMods);

    log.info(
      '[Main - refresh-mod-list] Successfully saved synchronized mod lists to store.'
    );

    // 3. Restituisci le liste aggiornate al renderer
    return {
      success: true,
      disabledMods: syncResult.disabledMods,
      enabledMods: syncResult.enabledMods,
    };
  } catch (error: any) {
    log.error('[Main - refresh-mod-list] Error refreshing mod list:', error);
    return {
      success: false,
      error: error.message || 'Unknown error refreshing mod list.',
      disabledMods: [],
      enabledMods: [],
    };
  }
});
// --- END IPC Handler for Refreshing Mod List ---

// --- IPC Handler for Updating Mod Order ---
ipcMain.handle(
  'update-mod-order',
  async (
    event,
    orderedMods: ModItemForStore[]
  ): Promise<{
    success: boolean;
    updatedMods: ModItemForStore[];
    error?: string;
  }> => {
    log.info(
      `[Main - update-mod-order] Received request to update mod order. ${orderedMods.length} mods.`
    );
    log.verbose(
      `[Main - update-mod-order] Ordered mods (activePaths): ${JSON.stringify(orderedMods.map((m) => m.activePath))}`
    );

    if (orderedMods.some((mod) => !mod.activePath)) {
      log.error(
        '[Main - update-mod-order] Error: Some mods in the list are missing their activePath.'
      );
      return {
        success: false,
        error: 'Some mods are missing their activePath, cannot update order.',
        updatedMods: orderedMods,
      };
    }

    const gameModsPath = await getGameModsPath();
    if (!gameModsPath) {
      log.error(
        '[Main - update-mod-order] Game mods path could not be determined.'
      );
      return {
        success: false,
        error: 'Game installation path not configured.',
        updatedMods: orderedMods,
      };
    }

    if (!fs.existsSync(gameModsPath)) {
      log.warn(
        `[Main - update-mod-order] Game mods directory does not exist: ${gameModsPath}. Nothing to reorder.`
      );
      return { success: true, updatedMods: orderedMods }; // No mods to reorder, operation is trivially successful
    }

    const renameOperations: {
      originalModId: string; // Store mod.id for easier mapping later
      oldPath: string;
      newPath: string;
      tempPath: string;
    }[] = [];
    const tempSuffix = '_imm_temp_rename';

    try {
      // Fase 1: Calcola le operazioni di rinomina e i nomi temporanei
      for (let i = 0; i < orderedMods.length; i++) {
        const mod = orderedMods[i];
        const currentModFullPath = mod.activePath!; // Assicurato dal controllo precedente
        const currentModFolderName = nodePath.basename(currentModFullPath);

        const baseNameMatch = currentModFolderName.match(/^\d{3}_(.*)$/);
        let baseName: string;

        if (baseNameMatch && baseNameMatch[1]) {
          baseName = baseNameMatch[1];
        } else {
          // Se il nome della cartella non ha il prefisso NNN_ (es. un mod aggiunto manualmente senza prefisso),
          // usa il nome della cartella così com'è, ma sanificato.
          // Oppure, potremmo usare mod.name (che è il nome della cartella di staging sanificato)
          // Per coerenza con la logica di estrazione, se non c'è NNN_, usiamo il nome della cartella.
          log.warn(
            `[Main - update-mod-order] Folder name "${currentModFolderName}" from path "${currentModFullPath}" does not have NNN_ prefix. Using full name as baseName.`
          );
          baseName = sanitizeDirectoryName(currentModFolderName); // Usa il nome sanificato della cartella
          // Alternativamente, se mod.name è più affidabile come nome base pulito:
          // baseName = mod.name; // Assumendo che mod.name sia il nome base desiderato
        }

        const newNumericPrefix = String(i).padStart(3, '0');
        const newFolderName = `${newNumericPrefix}_${baseName}`;
        const newModFullPath = nodePath.join(gameModsPath, newFolderName);

        if (currentModFullPath !== newModFullPath) {
          renameOperations.push({
            originalModId: mod.id,
            oldPath: currentModFullPath,
            newPath: newModFullPath,
            tempPath: currentModFullPath + tempSuffix,
          });
        }
      }

      log.verbose(
        `[Main - update-mod-order] Calculated rename operations: ${JSON.stringify(
          renameOperations
        )}`
      );
      if (renameOperations.length === 0) {
        log.info('[Main - update-mod-order] No rename operations needed.');
        return { success: true, updatedMods: orderedMods };
      }

      const successfullyRenamedToTemp: string[] = [];
      for (const op of renameOperations) {
        if (fs.existsSync(op.oldPath)) {
          if (fs.existsSync(op.tempPath)) {
            log.warn(
              `[Main - update-mod-order] Temporary path ${op.tempPath} already exists. Attempting to remove it.`
            );
            try {
              await fsPromises.rm(op.tempPath, {
                recursive: true,
                force: true,
              });
              log.info(
                `[Main - update-mod-order] Successfully removed existing temporary path ${op.tempPath}.`
              );
            } catch (rmError: any) {
              log.error(
                `[Main - update-mod-order] Failed to remove existing temporary path ${op.tempPath}: ${rmError.message}. Skipping rename for ${op.oldPath}.`
              );
              continue;
            }
          }
          log.info(
            `[Main - update-mod-order] Attempting to rename ${op.oldPath} to temporary ${op.tempPath}`
          );
          try {
            await fsPromises.rename(op.oldPath, op.tempPath);
            const tempExists = fs.existsSync(op.tempPath);
            log.info(
              `[Main - update-mod-order] SUCCESSFULLY renamed ${op.oldPath} to temporary ${op.tempPath}. Verification - tempPath exists: ${tempExists}`
            );
            if (!tempExists) {
              log.error(
                `[Main - update-mod-order] CRITICAL: Rename to temp for ${op.oldPath} reported success, but ${op.tempPath} does NOT exist.`
              );
            }
            successfullyRenamedToTemp.push(op.tempPath);
          } catch (renameError: any) {
            log.error(
              `[Main - update-mod-order] FAILED to rename ${op.oldPath} to temporary ${op.tempPath}: ${renameError.message}`
            );
            throw renameError;
          }
        } else {
          log.warn(
            `[Main - update-mod-order] Old path ${op.oldPath} does not exist. Skipping rename to temp.`
          );
        }
      }

      for (const op of renameOperations) {
        if (successfullyRenamedToTemp.includes(op.tempPath)) {
          if (fs.existsSync(op.newPath) && op.newPath !== op.tempPath) {
            log.warn(
              `[Main - update-mod-order] Target path ${op.newPath} already exists. Attempting to remove it before renaming from temp.`
            );
            try {
              await fsPromises.rm(op.newPath, { recursive: true, force: true });
              log.info(
                `[Main - update-mod-order] Successfully removed existing target path ${op.newPath}.`
              );
            } catch (rmError: any) {
              log.error(
                `[Main - update-mod-order] Failed to remove existing target path ${op.newPath}: ${rmError.message}. Skipping rename for ${op.tempPath}.`
              );
              continue;
            }
          }
          log.info(
            `[Main - update-mod-order] Attempting to rename temporary ${op.tempPath} to final ${op.newPath}`
          );
          try {
            await fsPromises.rename(op.tempPath, op.newPath);
            const finalExists = fs.existsSync(op.newPath);
            const tempStillExists = fs.existsSync(op.tempPath);
            log.info(
              `[Main - update-mod-order] SUCCESSFULLY renamed temporary ${op.tempPath} to final ${op.newPath}. Verification - newPath exists: ${finalExists}, tempPath still exists: ${tempStillExists}`
            );
            if (!finalExists) {
              log.error(
                `[Main - update-mod-order] CRITICAL: Rename from temp ${op.tempPath} to final ${op.newPath} reported success, but ${op.newPath} does NOT exist.`
              );
            }
            if (finalExists && tempStillExists) {
              log.warn(
                `[Main - update-mod-order] UNEXPECTED: Rename from temp ${op.tempPath} to final ${op.newPath} reported success, newPath exists, BUT tempPath ${op.tempPath} ALSO still exists. This might indicate a copy instead of a move, or an issue.`
              );
            }
          } catch (renameError: any) {
            log.error(
              `[Main - update-mod-order] FAILED to rename temporary ${op.tempPath} to final ${op.newPath}: ${renameError.message}`
            );
            throw renameError;
          }
        } else {
          log.warn(
            `[Main - update-mod-order] Temporary path ${op.tempPath} was not created (original ${op.oldPath} likely missing). Skipping rename to final ${op.newPath}.`
          );
        }
      }

      const updatedModList = orderedMods.map((mod) => {
        const operation = renameOperations.find(
          (op) => op.originalModId === mod.id && op.oldPath === mod.activePath
        );
        if (operation) {
          return { ...mod, activePath: operation.newPath };
        }
        // Se il mod non era in renameOperations (perché il suo activePath non necessitava di modifiche),
        // dobbiamo comunque assicurarci che il suo activePath rifletta il nuovo ordine se il *nome base* è lo stesso
        // ma il prefisso numerico era diverso.
        // La logica attuale di `renameOperations` aggiunge solo se `currentModFullPath !== newModFullPath`.
        // Quindi, se un mod non è in `renameOperations`, il suo `activePath` è già corretto.
        return mod;
      });

      log.info(
        '[Main - update-mod-order] Mod order updated successfully on the file system.'
      );
      log.verbose(
        `[Main - update-mod-order] Returning updated mods: ${JSON.stringify(updatedModList.map((m) => ({ name: m.name, activePath: m.activePath })))}`
      );
      return { success: true, updatedMods: updatedModList };
    } catch (error: any) {
      log.error('[Main - update-mod-order] Error updating mod order:', error);
      log.info(
        '[Main - update-mod-order] Attempting to rollback temporary renames...'
      );
      for (const op of renameOperations) {
        if (fs.existsSync(op.tempPath)) {
          try {
            if (!fs.existsSync(op.oldPath) || op.oldPath === op.tempPath) {
              log.info(
                `[Main - update-mod-order - Rollback] Reverting ${op.tempPath} to ${op.oldPath}`
              );
              await fsPromises.rename(op.tempPath, op.oldPath);
            } else {
              log.warn(
                `[Main - update-mod-order - Rollback] Original path ${op.oldPath} for ${op.tempPath} is occupied. Cannot automatically revert.`
              );
            }
          } catch (rollbackError: any) {
            log.error(
              `[Main - update-mod-order - Rollback] Error reverting ${op.tempPath} to ${op.oldPath}: ${rollbackError.message}`
            );
          }
        }
      }
      return {
        success: false,
        error: error.message || 'Unknown error updating mod order.',
        updatedMods: orderedMods, // Restituisce l'array originale in caso di errore
      };
    }
  }
);
// --- END IPC Handler for Updating Mod Order ---

// --- IPC Handler for Renaming Mod Staging Directory ---
ipcMain.handle(
  'rename-mod-staging-directory',
  async (
    event,
    oldModPakPath: string,
    newModNameRaw: string
  ): Promise<{
    success: boolean;
    newModPath?: string;
    newModName?: string;
    error?: string;
  }> => {
    log.info(
      `[Main - rename-mod-staging-directory] Request to rename mod. Old PAK path: "${oldModPakPath}", New raw name: "${newModNameRaw}"`
    );

    if (!oldModPakPath || typeof oldModPakPath !== 'string') {
      return { success: false, error: 'Invalid old mod path provided.' };
    }
    if (
      !newModNameRaw ||
      typeof newModNameRaw !== 'string' ||
      newModNameRaw.trim() === ''
    ) {
      return { success: false, error: 'Invalid new mod name provided.' };
    }

    const stagingBasePath = getCurrentStagingPath(); // Es: /path/to/userData/inzoi_mod_manager_files/staged_mods
    const oldModDirectoryPath = nodePath.dirname(oldModPakPath); // Es: /path/to/.../staged_mods/OldModName
    const oldModDirectoryName = nodePath.basename(oldModDirectoryPath); // Es: OldModName
    const pakFileName = nodePath.basename(oldModPakPath); // Es: OldModName.pak or whatever.pak

    // Verifica che oldModDirectoryPath sia effettivamente dentro stagingBasePath
    if (!oldModDirectoryPath.startsWith(stagingBasePath)) {
      log.error(
        `[Main - rename-mod-staging-directory] Old mod directory "${oldModDirectoryPath}" is not within the staging base path "${stagingBasePath}".`
      );
      return {
        success: false,
        error: 'Old mod path is not within the expected staging directory.',
      };
    }

    const sanitizedNewModName = sanitizeDirectoryName(newModNameRaw);
    if (!sanitizedNewModName) {
      log.error(
        `[Main - rename-mod-staging-directory] Sanitized new mod name is empty for raw name: "${newModNameRaw}"`
      );
      return {
        success: false,
        error: 'New mod name is invalid after sanitization.',
      };
    }

    const newModDirectoryPath = nodePath.join(
      stagingBasePath,
      sanitizedNewModName
    );

    log.info(
      `[Main - rename-mod-staging-directory] Old mod directory: "${oldModDirectoryPath}" (name: "${oldModDirectoryName}")`
    );
    log.info(
      `[Main - rename-mod-staging-directory] Sanitized new mod name: "${sanitizedNewModName}", New directory path: "${newModDirectoryPath}"`
    );

    if (oldModDirectoryPath === newModDirectoryPath) {
      log.info(
        '[Main - rename-mod-staging-directory] New name is the same as the old name after sanitization. No action needed.'
      );
      // Restituisce successo ma indica che il nome non è cambiato, fornendo i path originali/nuovi.
      // Il frontend potrebbe volerlo sapere per aggiornare l'UI se il nome raw era diverso.
      return {
        success: true,
        newModPath: oldModPakPath, // Il path del PAK non cambia
        newModName: sanitizedNewModName, // Il nome della directory (sanificato)
      };
    }

    try {
      // Controlla se la vecchia directory esiste
      if (!fs.existsSync(oldModDirectoryPath)) {
        log.error(
          `[Main - rename-mod-staging-directory] Old mod directory "${oldModDirectoryPath}" does not exist.`
        );
        return { success: false, error: 'Original mod directory not found.' };
      }

      // Controlla se la nuova directory di destinazione esiste già
      if (fs.existsSync(newModDirectoryPath)) {
        log.warn(
          `[Main - rename-mod-staging-directory] New mod directory "${newModDirectoryPath}" already exists.`
        );
        return {
          success: false,
          error: `A mod with the name "${sanitizedNewModName}" already exists. Please choose a different name.`,
        };
      }

      // Esegui la rinomina della directory
      await fsPromises.rename(oldModDirectoryPath, newModDirectoryPath);
      log.info(
        `[Main - rename-mod-staging-directory] Successfully renamed directory from "${oldModDirectoryPath}" to "${newModDirectoryPath}"`
      );

      // Costruisci il nuovo path del file .pak
      // Il nome del file .pak all'interno della cartella non cambia.
      const newPakFilePath = nodePath.join(newModDirectoryPath, pakFileName);

      // Verifica che il file .pak esista nel nuovo percorso (opzionale ma buono per la sanità)
      if (!fs.existsSync(newPakFilePath)) {
        log.error(
          `[Main - rename-mod-staging-directory] CRITICAL: Directory renamed, but PAK file "${pakFileName}" not found at new path "${newPakFilePath}". This should not happen.`
        );
        // Potrebbe essere necessario un rollback o una gestione degli errori più complessa qui.
        // Per ora, segnaliamo un errore grave.
        return {
          success: false,
          error:
            'Mod directory renamed, but the PAK file is missing in the new location. Manual check required.',
        };
      }

      log.info(
        `[Main - rename-mod-staging-directory] New PAK file path: "${newPakFilePath}"`
      );

      return {
        success: true,
        newModPath: newPakFilePath,
        newModName: sanitizedNewModName, // Questo è il nome della directory, che il frontend usa come mod.name
      };
    } catch (error: any) {
      log.error(
        `[Main - rename-mod-staging-directory] Error renaming mod directory from "${oldModDirectoryPath}" to "${newModDirectoryPath}":`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to rename mod: ${errorMessage}`,
      };
    }
  }
);
// --- END IPC Handler for Renaming Mod Staging Directory ---

// --- IPC Handlers for Theme ---
ipcMain.handle('get-theme', async () => {
  const theme = store.get('theme', 'system'); // Default a 'system' se non impostato
  log.info(`[Main] Renderer requested theme, returning: ${theme}`);
  return theme;
});

ipcMain.handle('set-theme', async (event, themeValue: 'light' | 'dark' | 'system') => {
  if (['light', 'dark', 'system'].includes(themeValue)) {
    store.set('theme', themeValue);
    log.info(`[Main] Theme set to: ${themeValue}`);
    // Opzionale: notifica la finestra del renderer del cambio di tema se necessario immediatamente
    // win?.webContents.send('theme-changed', themeValue);
    return { success: true, theme: themeValue };
  } else {
    log.error(`[Main] Invalid theme value received: ${themeValue}`);
    return { success: false, error: 'Invalid theme value provided.' };
  }
});
// --- END IPC Handlers for Theme ---
