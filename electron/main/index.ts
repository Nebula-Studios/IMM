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
  activePath?: string; // Percorso della cartella del mod nella directory ~mods del gioco (es. C:\...\~mods\000_NomeMod) O la directory ~mods stessa per i non-virtuali.
  numericPrefix?: string; // Prefisso numerico (es. "001") usato per i file del mod quando abilitato (solo per mod non virtuali)
  isNonVirtual?: boolean; // True se il mod è un insieme di file NNN_* nella root di ~mods, false/undefined se è una cartella NNN_ModName.
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
          isNonVirtual: { type: ['boolean', 'null'], default: false }, // Aggiunto
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
          activePath: { type: ['string', 'null'] }, // Può essere undefined se non ancora determinato o se il mod è stato disabilitato
          numericPrefix: { type: ['string', 'null'] }, // Aggiunto per memorizzare il prefisso
          isNonVirtual: { type: ['boolean', 'null'], default: false }, // Aggiunto
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
      const sourceModDirectory = nodePath.dirname(modStagingPakPath);
      const isVirtualMod = sourceModDirectory.startsWith(gameModsPath);

      log.info(`[Main ENABLE_MOD] Source directory: "${sourceModDirectory}"`);
      log.info(
        `[Main ENABLE_MOD] Is virtual mod (already in ~mods): ${isVirtualMod}`
      );

      if (isVirtualMod) {
        // Per i mod virtuali, dobbiamo prima copiarli nello staging se necessario
        const stagingPath = getCurrentStagingPath();
        const stagingModDirectory = nodePath.join(stagingPath, modName);

        log.info(
          `[Main ENABLE_MOD] Virtual mod detected. Ensuring it's in staging: "${stagingModDirectory}"`
        );

        if (!fs.existsSync(stagingPath)) {
          await fsPromises.mkdir(stagingPath, { recursive: true });
          log.info(`[Main] Created staging directory: "${stagingPath}"`);
        }

        if (!fs.existsSync(stagingModDirectory)) {
          // sourceModDirectory per un mod virtuale è la sua cartella NNN_NomeMod in ~mods
          await copyDirRecursive(sourceModDirectory, stagingModDirectory);
          log.info(
            `[Main ENABLE_MOD] Copied virtual mod from "${sourceModDirectory}" to staging "${stagingModDirectory}"`
          );
        }
        // Per i mod virtuali, la loro "attivazione" è già avvenuta (sono in ~mods).
        // Il loro activePath è la cartella NNN_NomeMod.
        // Questa funzione potrebbe essere chiamata per assicurarsi che siano nello store come abilitati.
        // Restituiamo il percorso della loro cartella in ~mods.
        return { success: true, newPath: sourceModDirectory };
      }

      // NUOVA LOGICA per mod normali (dallo staging):
      const itemsInGameModsDir = await fsPromises.readdir(gameModsPath);
      let maxIndex = -1;
      for (const item of itemsInGameModsDir) {
        const itemPath = nodePath.join(gameModsPath, item);
        try {
          // Considera solo i file per determinare l'indice, non le directory
          if (fs.lstatSync(itemPath).isFile()) {
            const match = item.match(/^(\d{3})_/); // Regex per estrarre NNN dal nome del file
            if (match && match[1]) {
              const currentIndex = parseInt(match[1], 10);
              if (currentIndex > maxIndex) {
                maxIndex = currentIndex;
              }
            }
          }
        } catch (e: any) {
          // Ignora errori se lstat fallisce (es. link simbolico rotto) o l'item non è un file
          log.warn(
            `[Enable Mod - Index Scan] Error processing item ${item} in ${gameModsPath}: ${e.message}`
          );
        }
      }
      const nextModIndex = maxIndex + 1;
      const numericPrefix = String(nextModIndex).padStart(3, '0');

      const sourceModStagingDirectory = sourceModDirectory;
      log.info(
        `[Main ENABLE_MOD] Source mod staging directory: "${sourceModStagingDirectory}"`
      );

      if (!fs.existsSync(sourceModStagingDirectory)) {
        log.error(
          `[Main ENABLE_MOD] Source staging directory does not exist: ${sourceModStagingDirectory}`
        );
        return {
          success: false,
          error: `Mod source directory not found in staging: ${sourceModStagingDirectory}`,
        };
      }

      const filesToCopy = await fsPromises.readdir(sourceModStagingDirectory);
      const copiedFilePaths: string[] = [];
      let allFilesSkipped = true;

      for (const fileName of filesToCopy) {
        const sourceFilePath = nodePath.join(
          sourceModStagingDirectory,
          fileName
        );

        if (fs.lstatSync(sourceFilePath).isFile()) {
          allFilesSkipped = false;
          const targetFileName = `${numericPrefix}_${fileName}`;
          const destFilePathInGame = nodePath.join(
            gameModsPath,
            targetFileName
          );

          log.info(
            `[Main ENABLE_MOD - File Operation] Preparing to copy individual file "${fileName}" from staging "${sourceFilePath}" to game mods directory (root level) as "${targetFileName}" at "${destFilePathInGame}".`
          );
          await fsPromises.copyFile(sourceFilePath, destFilePathInGame);
          copiedFilePaths.push(destFilePathInGame);
          log.info(
            `[Main ENABLE_MOD - File Operation] Successfully copied individual file "${fileName}" to "${destFilePathInGame}". It is NOT placed in a subdirectory within ~mods.`
          );

          // Ora elimina il file originale dalla directory di staging
          try {
            await fsPromises.unlink(sourceFilePath);
            log.info(
              `[Main ENABLE_MOD - File Operation] Successfully deleted original file "${fileName}" from staging directory "${sourceFilePath}".`
            );
          } catch (deleteError: any) {
            log.error(
              `[Main ENABLE_MOD - File Operation] Failed to delete original file "${fileName}" from staging directory "${sourceFilePath}": ${deleteError.message}`
            );
            // Non consideriamo questo un errore fatale per l'abilitazione del mod,
            // ma è importante loggarlo. Il file è stato copiato.
          }
        } else {
          log.info(
            `[Main ENABLE_MOD] Skipping directory: "${fileName}" in staging folder "${sourceModStagingDirectory}".`
          );
        }
      }

      if (allFilesSkipped && filesToCopy.length > 0) {
        log.warn(
          `[Main ENABLE_MOD] Mod directory ${sourceModStagingDirectory} for mod "${modName}" contained only subdirectories. No files were copied.`
        );
        return {
          success: false, // Considerato un fallimento se nessun file idoneo viene trovato
          error:
            'Mod directory contained only subdirectories or was empty. No files copied.',
          copiedFiles: [],
          numericPrefix: numericPrefix,
        };
      } else if (copiedFilePaths.length === 0 && filesToCopy.length === 0) {
        log.warn(
          `[Main ENABLE_MOD] Mod directory ${sourceModStagingDirectory} for mod "${modName}" was empty. No files were copied.`
        );
        return {
          success: false, // Considerato un fallimento se la directory è vuota
          error: 'Mod staging directory was empty. No files copied.',
          copiedFiles: [],
          numericPrefix: numericPrefix,
        };
      }

      log.info(
        `[Main] Successfully copied ${copiedFilePaths.length} file(s) for mod "${modName}" to "${gameModsPath}" with prefix "${numericPrefix}".`
      );

      return {
        success: true,
        newPath: gameModsPath, // La directory ~mods generale (per riferimento)
        numericPrefix: numericPrefix, // Il prefisso usato
        copiedFilePaths: copiedFilePaths,
        originalStagingId: modStagingPakPath, // ID di staging originale
        isNonVirtual: true, // Flag per indicare che è un mod non virtuale
        // NOTA: per i mod non virtuali, activePath dovrebbe essere null o non impostato
        // perché non hanno una singola directory, ma file sparsi nella root di ~mods
      };
    } catch (error: any) {
      log.error(`[Enable Mod] Error enabling mod ${modName}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error during mod enabling.',
      };
    }
  }
);

// Helper function to check if a directory exists
async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(path);
    return stats.isDirectory();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return false;
    }
    // Non rilanciare l'errore qui, lascia che il chiamante decida.
    // O, se si vuole essere più specifici, loggare e restituire false.
    log.warn(`[directoryExists] Error checking path ${path}: ${error.message}`);
    return false; // Considera un errore di accesso come "non esiste" per semplicità
  }
}

// Helper function to check if a file exists
async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(path);
    return stats.isFile();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return false;
    }
    log.warn(`[fileExists] Error checking path ${path}: ${error.message}`);
    return false; // Considera un errore di accesso come "non esiste"
  }
}

/**
 * Rinumera i prefissi delle mod attive rimanenti dopo la disattivazione di una mod.
 * Scala i prefissi numerici delle mod che avevano un prefisso maggiore di quello della mod disattivata.
 * Gestisce sia file singoli (mod non virtuali) che directory (mod virtuali).
 *
 * @param gameModsDir - Percorso della directory ~mods del gioco
 * @param disabledModPrefix - Prefisso numerico della mod appena disattivata (es. "002")
 * @param wasNonVirtual - True se la mod disattivata era non virtuale (file singoli)
 */
async function renumberRemainingActiveMods(
  gameModsDir: string,
  disabledModPrefix: string | null,
  wasNonVirtual: boolean
): Promise<void> {
  if (!disabledModPrefix) {
    log.info('[renumberRemainingActiveMods] Nessun prefisso numerico fornito, rinumerazione saltata.');
    return;
  }

  if (!fs.existsSync(gameModsDir)) {
    log.warn(`[renumberRemainingActiveMods] Directory ~mods non trovata: ${gameModsDir}`);
    return;
  }

  const disabledPrefixNumber = parseInt(disabledModPrefix, 10);
  if (isNaN(disabledPrefixNumber)) {
    log.error(`[renumberRemainingActiveMods] Prefisso numerico non valido: ${disabledModPrefix}`);
    return;
  }

  log.info(
    `[renumberRemainingActiveMods] Scansionando ${gameModsDir} per rinumerare elementi con prefisso > ${disabledPrefixNumber}`
  );

  try {
    const allItems = await fsPromises.readdir(gameModsDir, { withFileTypes: true });
    
    // Raccogli tutte le mod (file e cartelle) che necessitano di rinominazione
    // ESCLUDENDO file/cartelle temporanei che potrebbero essere in uso da altre operazioni
    const itemsToRename: {
      currentPath: string;
      currentName: string;
      currentPrefix: number;
      newPrefix: number;
      newName: string;
      newPath: string;
      isDirectory: boolean;
    }[] = [];

    for (const item of allItems) {
      const itemName = item.name;
      const itemPath = nodePath.join(gameModsDir, itemName);
      
      // SKIP file/cartelle temporanei per evitare conflitti con operazioni concorrenti
      if (itemName.includes('_imm_temp_rename') || itemName.includes('_temp_') || itemName.startsWith('~')) {
        log.info(`[renumberRemainingActiveMods] Saltando elemento temporaneo: ${itemName}`);
        continue;
      }
      
      // Cerca pattern NNN_ sia per file che cartelle
      const match = itemName.match(/^(\d{3})_(.+)$/);
      if (match && match[1] && match[2]) {
        const currentPrefix = parseInt(match[1], 10);
        const baseName = match[2];
        
        // Solo elementi con prefisso maggiore del mod disattivato devono essere rinominati
        if (currentPrefix > disabledPrefixNumber) {
          const newPrefix = currentPrefix - 1;
          const newPrefixString = String(newPrefix).padStart(3, '0');
          const newName = `${newPrefixString}_${baseName}`;
          const newPath = nodePath.join(gameModsDir, newName);
          
          itemsToRename.push({
            currentPath: itemPath,
            currentName: itemName,
            currentPrefix,
            newPrefix,
            newName,
            newPath,
            isDirectory: item.isDirectory()
          });
        }
      }
    }

    if (itemsToRename.length === 0) {
      log.info('[renumberRemainingActiveMods] Nessun elemento da rinominare trovato.');
      return;
    }

    // Ordina per prefisso crescente per evitare conflitti di nomi durante la rinominazione
    itemsToRename.sort((a, b) => a.currentPrefix - b.currentPrefix);

    log.info(
      `[renumberRemainingActiveMods] Trovati ${itemsToRename.length} elementi da rinominare: ${itemsToRename.map(item => `${item.currentName} -> ${item.newName}`).join(', ')}`
    );

    // Esegui le rinominazioni in sequenza per evitare conflitti
    for (const item of itemsToRename) {
      try {
        // Verifica che l'elemento di origine esista ancora e non sia diventato temporaneo
        if (!fs.existsSync(item.currentPath)) {
          log.warn(`[renumberRemainingActiveMods] Elemento ${item.currentPath} non trovato, saltando rinomina.`);
          continue;
        }

        // Doppio controllo: verifica che il nome corrente non sia diventato temporaneo
        const currentName = nodePath.basename(item.currentPath);
        if (currentName.includes('_imm_temp_rename') || currentName.includes('_temp_') || currentName.startsWith('~')) {
          log.warn(`[renumberRemainingActiveMods] Elemento ${item.currentPath} è diventato temporaneo, saltando rinomina.`);
          continue;
        }

        // Verifica che la destinazione non esista già
        if (fs.existsSync(item.newPath)) {
          log.error(
            `[renumberRemainingActiveMods] Destinazione ${item.newPath} già esistente, saltando rinomina di ${item.currentName}.`
          );
          continue;
        }

        // Esegui la rinominazione
        await fsPromises.rename(item.currentPath, item.newPath);
        
        const itemType = item.isDirectory ? 'directory' : 'file';
        log.info(
          `[renumberRemainingActiveMods] Rinominato ${itemType} ${item.currentName} -> ${item.newName} (prefisso ${item.currentPrefix} -> ${item.newPrefix})`
        );
        
      } catch (renameError: any) {
        log.error(
          `[renumberRemainingActiveMods] Errore rinominando ${item.currentName}: ${renameError.message}`
        );
        // Continua con gli altri elementi invece di interrompere tutto
      }
    }

    log.info('[renumberRemainingActiveMods] Rinumerazione completata.');
    
  } catch (error: any) {
    log.error(`[renumberRemainingActiveMods] Errore durante la scansione di ${gameModsDir}: ${error.message}`);
    throw error;
  }
}

ipcMain.handle(
  'disable-mod',
  async (
    event,
    modToDisable: ModItemForStore // Oggetto completo dal renderer
  ) => {
    log.info(
      `[Main DISABLE_MOD] Richiesta ricevuta per disabilitare il mod: ${JSON.stringify(modToDisable)}`
    );

    const gameModsDir = await getGameModsPath();
    if (!gameModsDir) {
      log.error('[Main DISABLE_MOD] Directory ~mods non trovata.');
      return { success: false, error: 'Game mods directory not found' };
    }

    // Recupera l'entry completa del mod dallo store se esiste (per avere isNonVirtual e numericPrefix aggiornati)
    const enabledModsFromStore = store.get('savedEnabledMods', []);
    const storedModEntry = enabledModsFromStore.find(
      (mod) => mod.id === modToDisable.id
    );

    // Determina isNonVirtual e actualNumericPrefix usando i dati dallo store se disponibili, altrimenti dall'input
    // Diamo priorità allo store perché riflette lo stato "attivo" più recente.
    const isNonVirtualFromStore = storedModEntry?.isNonVirtual ?? modToDisable.isNonVirtual ?? false;
    let actualNumericPrefix = storedModEntry?.numericPrefix ?? modToDisable.numericPrefix ?? null;

    // CONTROLLO AGGIUNTIVO: Se activePath punta alla directory ~mods stessa, è probabilmente un mod non virtuale
    const modActivePath = storedModEntry?.activePath || modToDisable.activePath;
    const isActivePathGameModsRoot = modActivePath === gameModsDir;
    
    // Determina il tipo effettivo: è non virtuale se esplicitamente marcato O se activePath è la root di ~mods
    const isNonVirtualEffective = isNonVirtualFromStore || isActivePathGameModsRoot;

    log.info(
      `[Main DISABLE_MOD] Mod "${modToDisable.name}" (ID: ${modToDisable.id}): isNonVirtual (store/input)=${isNonVirtualFromStore}, activePath="${modActivePath}", isActivePathGameModsRoot=${isActivePathGameModsRoot}, isNonVirtual (effective)=${isNonVirtualEffective}, numericPrefix (effective)=${actualNumericPrefix}`
    );

    if (isNonVirtualEffective && !actualNumericPrefix) {
      log.error(
        `[Main DISABLE_MOD] numericPrefix è richiesto per il mod non virtuale "${modToDisable.name}" (ID: ${modToDisable.id}) ma non è stato fornito né trovato nello store. Impossibile disabilitare.`
      );
      return {
        success: false,
        error: `Numeric prefix is required for non-virtual mod "${modToDisable.name}" but was not provided or found.`,
      };
    }

    try {
      if (isNonVirtualEffective) {
        // Mod non virtuale (file singoli NNN_*.pak, NNN_*.ucas, NNN_*.utoc)
        const modNameBase = storedModEntry?.name || modToDisable.name;
        const extensions = ['.pak', '.ucas', '.utoc'];
        let allFilesMovedOrAbsent = true;
        let filesAttemptedToMove = 0;

        // Ottieni la directory di staging per spostare i file
        const stagingPath = getCurrentStagingPath();
        const modStagingDir = nodePath.join(stagingPath, sanitizeDirectoryName(modNameBase));

        // Assicurati che la directory di staging del mod esista
        if (!fs.existsSync(modStagingDir)) {
          await fsPromises.mkdir(modStagingDir, { recursive: true });
          log.info(`[Main DISABLE_MOD] Creata directory di staging per mod non virtuale: ${modStagingDir}`);
        }

        // Ottieni la lista di tutti i file nella directory ~mods
        const modsDirectoryFiles = await fsPromises.readdir(gameModsDir);

        // Filtra SOLO i file che corrispondono ESATTAMENTE al pattern del mod specifico
        const modFiles = modsDirectoryFiles.filter(fileName => {
          // Se abbiamo un prefisso numerico specifico, usalo per il match ESATTO
          if (actualNumericPrefix) {
            // Controlla che il file sia esattamente nel formato: {prefisso}_{nomeModBase}.{estensione}
            for (const ext of extensions) {
              const expectedFileName = `${actualNumericPrefix}_${modNameBase}${ext}`;
              if (fileName === expectedFileName) {
                return true;
              }
            }
            return false;
          }
          // Se non abbiamo un prefisso specifico, cerca qualsiasi prefisso numerico ma con nome ESATTO
          const match = fileName.match(/^(\d{3})_(.+?)\.(.+)$/);
          if (match) {
            const [, prefix, nameFromFile, extensionFromFile] = match;
            return nameFromFile === modNameBase && extensions.includes(`.${extensionFromFile}`);
          }
          return false;
        });

        log.info(
          `[Main DISABLE_MOD] Mod non virtuale "${modNameBase}": trovati ${modFiles.length} file da spostare in staging: [${modFiles.join(', ')}]`
        );

        // Sposta ogni file trovato nella directory di staging
        for (const fileName of modFiles) {
          const filePathInGame = nodePath.join(gameModsDir, fileName);
          // Rimuovi il prefisso numerico dal nome del file per lo staging
          const originalFileName = fileName.replace(/^(\d{3})_/, '');
          const destFilePath = nodePath.join(modStagingDir, originalFileName);
          
          try {
            filesAttemptedToMove++;
            await fsPromises.rename(filePathInGame, destFilePath);
            log.info(
              `[Main DISABLE_MOD] File non virtuale ${filePathInGame} spostato con successo in staging: ${destFilePath}`
            );
          } catch (fileError: any) {
            log.error(
              `[Main DISABLE_MOD] Errore durante lo spostamento del file ${filePathInGame}: ${fileError.message}`
            );
            allFilesMovedOrAbsent = false;
          }
        }

        if (filesAttemptedToMove === 0) {
          log.warn(
            `[Main DISABLE_MOD] Nessun file trovato per il mod non virtuale ${modNameBase} con prefisso ${actualNumericPrefix}. Il mod potrebbe essere già stato rimosso o il nome/prefisso non corrisponde.`
          );
        } else if (!allFilesMovedOrAbsent) {
          log.warn(
            `[Main DISABLE_MOD] Non tutti i file per il mod non virtuale ${modNameBase} sono stati spostati con successo.`
          );
        }
      } else {
        // Mod virtuale (cartella NNN_NomeMod)
        const modDirInGame = storedModEntry?.activePath || modToDisable.activePath;
        
        if (!modDirInGame) {
          log.error(
            `[Main DISABLE_MOD] activePath non definito per il mod virtuale ${modToDisable.name} (ID: ${modToDisable.id}). Impossibile determinare la cartella da spostare.`
          );
          return {
            success: false,
            error: `activePath not defined for virtual mod ${modToDisable.name}`,
          };
        }

        // CONTROLLO DI SICUREZZA CRITICO: Non spostare mai la directory ~mods stessa
        if (modDirInGame === gameModsDir) {
          log.error(
            `[Main DISABLE_MOD] ERRORE CRITICO: Il mod virtuale "${modToDisable.name}" ha activePath che punta alla directory ~mods root (${gameModsDir}). Questo indica un errore nei dati. Rifiuto di spostare l'intera directory ~mods.`
          );
          return {
            success: false,
            error: `Cannot move entire ~mods directory. Mod data appears corrupted. Please check mod configuration.`,
          };
        }

        // Verifica che la directory da spostare sia effettivamente una sottocartella di ~mods
        if (!modDirInGame.startsWith(gameModsDir + nodePath.sep)) {
          log.error(
            `[Main DISABLE_MOD] ERRORE DI SICUREZZA: Il mod virtuale "${modToDisable.name}" ha activePath (${modDirInGame}) che non è una sottocartella di ~mods (${gameModsDir}). Operazione bloccata.`
          );
          return {
            success: false,
            error: `Mod directory path is outside the expected game mods directory. Operation blocked for safety.`,
          };
        }

        // Ottieni la directory di staging e prepara la destinazione
        const stagingPath = getCurrentStagingPath();
        const modNameBase = storedModEntry?.name || modToDisable.name;
        const modStagingDir = nodePath.join(stagingPath, sanitizeDirectoryName(modNameBase));

        log.info(
          `[Main DISABLE_MOD] Tentativo di spostare la directory del mod virtuale: ${modDirInGame} -> ${modStagingDir}`
        );
        
        if (await directoryExists(modDirInGame)) {
          // Se la directory di staging esiste già, rimuovila per evitare conflitti
          if (fs.existsSync(modStagingDir)) {
            log.warn(`[Main DISABLE_MOD] Directory di staging ${modStagingDir} già esistente, la rimuovo prima dello spostamento.`);
            await fsPromises.rm(modStagingDir, { recursive: true, force: true });
          }
          
          // Assicurati che la directory padre di staging esista
          if (!fs.existsSync(stagingPath)) {
            await fsPromises.mkdir(stagingPath, { recursive: true });
            log.info(`[Main DISABLE_MOD] Creata directory di staging: ${stagingPath}`);
          }

          // Sposta l'intera directory del mod dalla directory di gioco allo staging
          await fsPromises.rename(modDirInGame, modStagingDir);
          log.info(
            `[Main DISABLE_MOD] Directory del mod virtuale ${modDirInGame} spostata con successo in staging: ${modStagingDir}`
          );
        } else {
          log.warn(
            `[Main DISABLE_MOD] La directory del mod virtuale ${modDirInGame} non esiste. Nessuna azione intrapresa.`
          );
        }
      }

      // Aggiorna lo store: rimuovi da savedEnabledMods e aggiungi a savedDisabledMods
      let currentEnabledMods = store.get('savedEnabledMods', []);
      const modIdToProcess = storedModEntry?.id || modToDisable.id;
      const modNameForLog = storedModEntry?.name || modToDisable.name;
      const modPathForStore = storedModEntry?.path || modToDisable.path;

      const modIndexInEnabled = currentEnabledMods.findIndex(
        (mod) => mod.id === modIdToProcess
      );

      if (modIndexInEnabled > -1) {
        currentEnabledMods.splice(modIndexInEnabled, 1);
        store.set('savedEnabledMods', currentEnabledMods);
        log.info(
          `[Main DISABLE_MOD] Mod ${modNameForLog} (ID: ${modIdToProcess}) rimosso da savedEnabledMods.`
        );
      } else {
        log.warn(
          `[Main DISABLE_MOD] Mod ${modNameForLog} (ID: ${modIdToProcess}) non trovato in savedEnabledMods. Lo store potrebbe non essere sincronizzato.`
        );
      }

      let currentDisabledMods = store.get('savedDisabledMods', []);
      if (!currentDisabledMods.some((mod) => mod.id === modIdToProcess)) {
        const modToStoreAsDisabled: ModItemForStore = {
          id: modIdToProcess,
          name: modNameForLog, // Usa il nome più affidabile (dallo store se c'era, o dall'input)
          path: modPathForStore, // Usa il path di staging più affidabile
          isNonVirtual: isNonVirtualEffective, // Conserva l'informazione corretta
          // activePath e numericPrefix sono rimossi/azzerati per i mod disabilitati
        };
        currentDisabledMods.push(modToStoreAsDisabled);
        store.set('savedDisabledMods', currentDisabledMods);
        log.info(
          `[Main DISABLE_MOD] Mod ${modNameForLog} (ID: ${modIdToProcess}) aggiunto a savedDisabledMods. isNonVirtual: ${isNonVirtualEffective}`
        );
      } else {
        log.info(
          `[Main DISABLE_MOD] Mod ${modNameForLog} (ID: ${modIdToProcess}) già presente in savedDisabledMods. Nessuna modifica a savedDisabledMods.`
        );
      }

      // NUOVA LOGICA: Rinumerazione dei prefissi delle mod attive rimanenti
      log.info(
        `[Main DISABLE_MOD] Iniziando rinumerazione dei prefissi delle mod rimanenti dopo disattivazione di "${modNameForLog}".`
      );
      
      try {
        await renumberRemainingActiveMods(gameModsDir, actualNumericPrefix, isNonVirtualEffective);
      } catch (renumberError: any) {
        log.error(
          `[Main DISABLE_MOD] Errore durante la rinumerazione dei prefissi: ${renumberError.message}. La mod è stata disattivata ma i prefissi potrebbero non essere corretti.`
        );
        // Non consideriamo questo un errore fatale per la disattivazione
      }

      log.info(
        `[Main DISABLE_MOD] Mod ${modNameForLog} (ID: ${modIdToProcess}) disabilitato con successo (o file non trovati).`
      );
      return { success: true };
    } catch (error: any) {
      log.error(
        `[Main DISABLE_MOD] Errore durante la disabilitazione del mod ${modToDisable.name} (ID: ${modToDisable.id}): ${error.message}`
      );
      return { success: false, error: error.message };
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
      } // Fine del loop per le directory virtuali (mod gestiti come cartelle NNN_NomeMod)

      // NUOVA LOGICA per file non virtuali (fisici) nella root di ~mods
      // Questa logica itera nuovamente su itemsToScan per trovare file singoli con prefisso.
      const nonVirtualPaksData = new Map<
        string,
        { nameBase: string; pakFileName: string; allFiles: string[] }
      >();

      for (const item of itemsToScan) {
        // itemsToScan è il contenuto della directory ~mods
        if (item.isFile()) {
          // Cerca file che corrispondono a NNN_NomeBase.pak/ucas/utoc
          const fileMatch = item.name.match(
            /^(\d{3})_(.+?)\.(pak|ucas|utoc)$/i
          );
          if (fileMatch) {
            const prefix = fileMatch[1]; // Es: "000"
            const namePart = fileMatch[2]; // Es: "KJShortDistBadSinging_P"
            const ext = fileMatch[3].toLowerCase(); // Es: "pak"

            let entry = nonVirtualPaksData.get(prefix);
            if (!entry) {
              // Inizializza nameBase con il primo nome base che trova per questo prefisso.
              // Sarà sovrascritto se un file .pak con lo stesso prefisso ha un namePart diverso.
              entry = { nameBase: namePart, pakFileName: '', allFiles: [] };
              nonVirtualPaksData.set(prefix, entry);
            }
            entry.allFiles.push(item.name);

            if (ext === 'pak') {
              entry.pakFileName = item.name; // Memorizza il nome completo del file .pak (es. 000_KJShortDistBadSinging_P.pak)
              entry.nameBase = namePart; // Il nome base del mod è definito dal file .pak
            }
          }
        }
      }

      nonVirtualPaksData.forEach((data, prefix) => {
        if (data.pakFileName) {
          // Processa solo se è stato trovato un file .pak per questo prefisso
          const fullPakPathInGame = nodePath.join(
            directoryPath!,
            data.pakFileName
          );
          pakFiles.push({
            id: fullPakPathInGame, // Placeholder ID, da risolvere in synchronizeModStatesLogic. Rappresenta il file .pak in ~mods.
            name: data.nameBase, // Nome base del mod (es. KJShortDistBadSinging_P)
            path: fullPakPathInGame, // Placeholder path, come ID. Da risolvere in synchronizeModStatesLogic per puntare allo staging.
            activePath: directoryPath!, // La directory ~mods stessa, dato che i file sono lì.
            numericPrefix: prefix,
            isNonVirtual: true,
          });
          log.info(
            `[scanDirectoryForPaks - GameMods Root Files] Found non-virtual mod files: Name: ${data.nameBase}, Prefix: ${prefix}, Pak: ${data.pakFileName}, All files: ${data.allFiles.join(', ')}`
          );
        } else {
          log.warn(
            `[scanDirectoryForPaks - GameMods Root Files] Prefix ${prefix} associated with files [${data.allFiles.join(', ')}] but no .pak file. Skipping this group.`
          );
        }
      });
      // Fine NUOVA LOGICA per file non virtuali
    } else {
      // Scansiona le sottocartelle per i mod (per la staging directory)
      // Funzione helper ricorsiva per trovare il primo .pak
      const findFirstPakRecursive = async (
        currentSearchDir: string
      ): Promise<string | null> => {
        try {
          const entries = await fsPromises.readdir(currentSearchDir, {
            withFileTypes: true,
          });
          // Cerca prima i file .pak al livello corrente
          for (const entry of entries) {
            if (
              entry.isFile() &&
              nodePath.extname(entry.name).toLowerCase() === '.pak'
            ) {
              return nodePath.join(currentSearchDir, entry.name); // Trovato .pak, restituisce il percorso completo
            }
          }
          // Se non trovato al livello corrente, cerca nelle sottocartelle
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const foundPakPath = await findFirstPakRecursive(
                nodePath.join(currentSearchDir, entry.name)
              );
              if (foundPakPath) {
                return foundPakPath; // Ritorna il percorso del .pak trovato nella sottocartella
              }
            }
          }
        } catch (e: any) {
          // Logga l'errore ma non interrompere la scansione di altre cartelle di mod principali
          log.error(
            `[scanDirectoryForPaks - Staging - findFirstPakRecursive] Error reading directory ${currentSearchDir}: ${e.message}`
          );
        }
        return null; // Non trovato in questa dir o nelle sue sottodirectory
      };
      for (const item of items) {
        // 'items' sono le cartelle principali dei mod in directoryPath (stagingPath)
        if (item.isDirectory()) {
          const modFolderName = item.name; // Nome della cartella principale del mod (es. MioMod)
          const modFolderPath = nodePath.join(directoryPath, modFolderName); // Percorso completo della cartella principale del mod

          const pakFilePath = await findFirstPakRecursive(modFolderPath);

          if (pakFilePath) {
            pakFiles.push({
              id: pakFilePath, // ID è il path completo al .pak trovato
              name: modFolderName, // Nome è il nome della cartella principale della mod
              path: pakFilePath, // Path è lo stesso dell'ID
            });
          } else {
            // Questo log ora significa che nessun .pak è stato trovato NEANCHE ricorsivamente
            log.warn(
              `[scanDirectoryForPaks - Staging] No .pak file found (recursively) in mod directory: ${modFolderPath}`
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
      log.verbose(
        `[synchronizeModStatesLogic] Processing storeDisabledMod: ${JSON.stringify(storeMod)}`
      );
      const stagedEquivalent = stagedPakMapById.get(storeMod.path); // storeMod.path è l'ID di staging
      if (stagedEquivalent) {
        // Se il mod è nello staging ed era disabilitato nello store,
        // e non è già stato marcato come abilitato, allora rimane disabilitato.
        if (
          !finalEnabledModIds.has(stagedEquivalent.id) &&
          !finalDisabledModIds.has(stagedEquivalent.id)
        ) {
          log.info(
            `[synchronizeModStatesLogic] Mod "${stagedEquivalent.name}" (ID: ${stagedEquivalent.id}) from storeDisabled, found in staging, confirmed as disabled.`
          );
          const modToDisable: ModItemForStore = {
            ...stagedEquivalent, // Usa i dati freschi dallo staging
            isNonVirtual: storeMod.isNonVirtual, // Preserva l'informazione isNonVirtual originale se disponibile
          };
          delete modToDisable.activePath;
          delete modToDisable.numericPrefix;
          finalDisabledMods.push(modToDisable);
          finalDisabledModIds.add(modToDisable.id); // Usa l'ID di staging originale
        }
      } else {
        log.warn(
          `[synchronizeModStatesLogic] Mod "${storeMod.name}" (ID: ${storeMod.id}, Path: ${storeMod.path}) was disabled in store, but NOT found in staging. Removing from lists as it's lost.`
        );
      }
    }

    // 3. Process mods found in game's ~mods folder that weren't already processed from storeEnabledMods
    for (const gamePak of actualGamePaks) {
      // gamePak.id qui è il path del .pak in ~mods (per non-virtuali) o il path del .pak dentro la cartella NNN_ (per virtuali)
      // gamePak.name è il nome base (es. "ModName" o "ModName_P")
      // gamePak.path è lo stesso di gamePak.id
      // gamePak.activePath è la cartella NNN_ModName o la directory ~mods
      // gamePak.isNonVirtual e gamePak.numericPrefix sono popolati da scanDirectoryForPaks per ~mods

      // Tentiamo di vedere se questo gamePak corrisponde a un mod già processato (e quindi presente in finalEnabledModIds)
      // basandoci sul suo *originale ID di staging*.
      // Questo è complicato perché gamePak.id è il suo path *nel gioco*.
      // Dobbiamo cercare in finalEnabledMods un mod il cui activePath o numericPrefix+name corrisponda a gamePak.

      let alreadyProcessedAsEnabled = false;
      for (const enabledMod of finalEnabledMods) {
        // enabledMod.id è l'ID di staging originale
        if (enabledMod.isNonVirtual && gamePak.isNonVirtual) {
          if (
            enabledMod.numericPrefix === gamePak.numericPrefix &&
            enabledMod.name === gamePak.name
          ) {
            alreadyProcessedAsEnabled = true;
            break;
          }
        } else if (!enabledMod.isNonVirtual && !gamePak.isNonVirtual) {
          if (enabledMod.activePath === gamePak.activePath) {
            // Confronto degli activePath per i virtuali
            alreadyProcessedAsEnabled = true;
            break;
          }
        }
      }

      if (alreadyProcessedAsEnabled) {
        log.info(
          `[synchronizeModStatesLogic] Game pak "${gamePak.name}" (Path: ${gamePak.path}) was already processed via storeEnabledMods. Skipping.`
        );
        continue;
      }

      // Se siamo qui, il gamePak è attivo nel gioco ma non era in storeEnabledMods (o non è stato trovato attivo tramite esso).
      // Potrebbe essere un mod aggiunto manualmente, o un mod il cui entry nello store era corrotto/mancante.
      log.info(
        `[synchronizeModStatesLogic] Game pak "${gamePak.name}" (Path: ${gamePak.path}, isNonVirtual: ${gamePak.isNonVirtual}) found active in game, was not in storeEnabled or not matched. Attempting to reconcile.`
      );

      // Cerchiamo un corrispondente nello staging basandoci sul nome.
      // Per i non-virtuali, il nome è il nome base del file (es. "ModName_P").
      // Per i virtuali, il nome è il nome base della cartella (es. "ModName").
      let correspondingStagedPak: ModItemForStore | undefined = undefined;
      for (const stagedPak of actualStagedPaks) {
        // stagedPak.name è il nome della cartella di staging (per virtuali) o il nome base del file .pak (se lo staging fosse flat, ma non lo è)
        // Per i mod nello staging, sono sempre in sottocartelle. Quindi stagedPak.name è il nome della cartella.
        // Se gamePak è virtuale, gamePak.name è il nome base della cartella (es. "MyMod").
        // Se gamePak è non-virtuale, gamePak.name è il nome base del file (es. "MyMod_P").
        // Questa logica di matching potrebbe aver bisogno di raffinamento.
        // Attualmente, `scanDirectoryForPaks` per lo staging usa il nome della cartella come `stagedPak.name`.
        if (stagedPak.name === gamePak.name) {
          // Confronto diretto dei nomi base
          correspondingStagedPak = stagedPak;
          break;
        }
      }

      if (correspondingStagedPak) {
        // Trovato un mod nello staging che corrisponde al nome del mod attivo nel gioco.
        // Questo mod dovrebbe essere abilitato.
        log.info(
          `[synchronizeModStatesLogic] Game pak "${gamePak.name}" matched with staged mod "${correspondingStagedPak.name}" (ID: ${correspondingStagedPak.id}). Marking as enabled.`
        );
        const modToEnable: ModItemForStore = {
          ...correspondingStagedPak, // ID, path, name dallo staging
          activePath: gamePak.activePath,
          isNonVirtual: gamePak.isNonVirtual,
          numericPrefix: gamePak.numericPrefix,
        };
        if (!finalEnabledModIds.has(modToEnable.id)) {
          finalEnabledMods.push(modToEnable);
          finalEnabledModIds.add(modToEnable.id); // Usa l'ID di staging originale

          // Se per caso era finito nei disabilitati (improbabile a questo punto, ma per sicurezza)
          if (finalDisabledModIds.has(modToEnable.id)) {
            const index = finalDisabledMods.findIndex(
              (m) => m.id === modToEnable.id
            );
            if (index > -1) finalDisabledMods.splice(index, 1);
            finalDisabledModIds.delete(modToEnable.id);
          }
        }
      } else {
        // Mod attivo nel gioco, ma nessun corrispondente trovato nello staging tramite nome.
        // Questo è un mod "orfano" o aggiunto manualmente. Creiamo un entry "virtual staging" per gestirlo.
        log.warn(
          `[synchronizeModStatesLogic] Game pak "${gamePak.name}" (Path: ${gamePak.path}) has no corresponding mod in staging by name. Creating virtual staging entry.`
        );
        const virtualStagingMod: ModItemForStore = {
          id: gamePak.path, // L'ID diventa il suo path nel gioco, dato che non ha uno staging path
          name: gamePak.name,
          path: gamePak.path, // Anche il path di "staging" è il suo path nel gioco
          activePath: gamePak.activePath,
          isNonVirtual: gamePak.isNonVirtual,
          numericPrefix: gamePak.numericPrefix,
        };
        if (!finalEnabledModIds.has(virtualStagingMod.id)) {
          // Controlla usando il nuovo ID (path del gioco)
          finalEnabledMods.push(virtualStagingMod);
          finalEnabledModIds.add(virtualStagingMod.id); // Aggiungi il nuovo ID
        }
      }
    }

    // 4. Process mods found in staging that are not yet in any list (these are new/untracked mods from staging)
    for (const stagedPak of actualStagedPaks) {
      // stagedPak.id è il path del .pak nello staging
      // stagedPak.name è il nome della cartella di staging
      if (
        !finalEnabledModIds.has(stagedPak.id) &&
        !finalDisabledModIds.has(stagedPak.id)
      ) {
        log.info(
          `[synchronizeModStatesLogic] Mod "${stagedPak.name}" (ID: ${stagedPak.id}) from staging was not in store and not found active in game. Marking as disabled by default.`
        );
        // Questi sono mod che esistono solo nello staging e non sono stati menzionati nello store né trovati attivi.
        // Vengono aggiunti come disabilitati.
        const modToDisable: ModItemForStore = {
          ...stagedPak, // Dati dallo staging
          // isNonVirtual non è rilevante qui perché non sono attivi, ma per coerenza lo impostiamo a false (default per staging)
          isNonVirtual: false,
        };
        delete modToDisable.activePath;
        delete modToDisable.numericPrefix;
        finalDisabledMods.push(modToDisable);
        finalDisabledModIds.add(modToDisable.id); // Usa l'ID di staging
      }
    }

    // 5. Final Deduplication and Refinement
    // Assicurati che nessun mod sia contemporaneamente in enabled e disabled.
    // Gli enabled hanno la precedenza.
    const finalUniqueEnabledMods: ModItemForStore[] = [];
    const finalUniqueEnabledModIds = new Set<string>();

    for (const mod of finalEnabledMods) {
      if (!finalUniqueEnabledModIds.has(mod.id)) {
        finalUniqueEnabledMods.push(mod);
        finalUniqueEnabledModIds.add(mod.id);
      } else {
        // Duplicato trovato in finalEnabledMods. Questo può accadere se un mod virtuale (già in ~mods)
        // è stato anche esplicitamente abilitato nello store.
        // Dobbiamo decidere quale entry tenere. Generalmente, l'entry con più dettagli (es. activePath corretto) è preferibile.
        // La logica precedente dovrebbe già aver gestito questo, ma per sicurezza:
        const existingIndex = finalUniqueEnabledMods.findIndex(
          (m) => m.id === mod.id
        );
        if (existingIndex !== -1) {
          const existingMod = finalUniqueEnabledMods[existingIndex];
          // Se il mod corrente ha più informazioni (es. activePath e il vecchio no), aggiorna.
          if (mod.activePath && !existingMod.activePath) {
            finalUniqueEnabledMods[existingIndex] = mod;
            log.warn(
              `[synchronizeModStatesLogic - DedupeEnabled] Updated mod ${mod.id} in finalUniqueEnabledMods with version that has activePath.`
            );
          } else if (
            mod.isNonVirtual !== existingMod.isNonVirtual ||
            mod.numericPrefix !== existingMod.numericPrefix
          ) {
            // O se ci sono altre discrepanze significative, logga e considera quale tenere.
            log.warn(
              `[synchronizeModStatesLogic - DedupeEnabled] Mod ${mod.id} has conflicting entries in finalEnabledMods. Current: ${JSON.stringify(mod)}, Existing: ${JSON.stringify(existingMod)}. Keeping the one with more details or later processed.`
            );
            // Potremmo implementare una logica di merge più sofisticata se necessario. Per ora, l'ultimo vince se ha activePath.
          }
        }
      }
    }

    const finalUniqueDisabledMods: ModItemForStore[] = [];
    for (const mod of finalDisabledMods) {
      if (!finalUniqueEnabledModIds.has(mod.id)) {
        // Se non è già stato marcato come abilitato
        // Assicurati che non ci siano duplicati neanche in finalDisabledMods
        if (!finalUniqueDisabledMods.some((m) => m.id === mod.id)) {
          // Per i mod disabilitati, rimuoviamo activePath e numericPrefix
          const { activePath, numericPrefix, ...cleanMod } = mod;
          finalUniqueDisabledMods.push(cleanMod);
        } else {
          log.warn(
            `[synchronizeModStatesLogic - DedupeDisabled] Mod ${mod.id} was already in finalUniqueDisabledMods. Skipping duplicate.`
          );
        }
      } else {
        log.info(
          `[synchronizeModStatesLogic - DedupeConflict] Mod ${mod.id} was in finalDisabledMods but also in finalEnabledMods. Prioritizing enabled state.`
        );
      }
    }

    log.info(
      `[synchronizeModStatesLogic] Synchronization complete. Final - Disabled: ${finalUniqueDisabledMods.length}, Enabled: ${finalUniqueEnabledMods.length}`
    );
    if (finalUniqueEnabledMods.length > 0) {
      log.verbose(
        `[synchronizeModStatesLogic] First final enabled mod: ${JSON.stringify(finalUniqueEnabledMods[0])}`
      );
    }
    if (finalUniqueDisabledMods.length > 0) {
      log.verbose(
        `[synchronizeModStatesLogic] First final disabled mod: ${JSON.stringify(finalUniqueDisabledMods[0])}`
      );
    }

    return {
      success: true,
      disabledMods: finalUniqueDisabledMods,
      enabledMods: finalUniqueEnabledMods,
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
        
        // SKIP la directory radice ~mods - non deve essere rinominata
        if (currentModFullPath.endsWith('~mods')) {
          log.info(`[Main - update-mod-order] Skipping root ~mods directory: ${currentModFullPath}`);
          continue;
        }
        
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
            // Verifica che il percorso di origine esista prima di tentare la rinomina
            if (!fs.existsSync(op.oldPath)) {
              log.error(
                `[Main - update-mod-order] CRITICAL: Source path ${op.oldPath} does not exist before rename to temp.`
              );
              throw new Error(`Source path does not exist: ${op.oldPath}`);
            }
            
            await fsPromises.rename(op.oldPath, op.tempPath);
            const tempExists = fs.existsSync(op.tempPath);
            const sourceStillExists = fs.existsSync(op.oldPath);
            log.info(
              `[Main - update-mod-order] SUCCESSFULLY renamed ${op.oldPath} to temporary ${op.tempPath}. Verification - tempPath exists: ${tempExists}, sourceStillExists: ${sourceStillExists}`
            );
            if (!tempExists) {
              log.error(
                `[Main - update-mod-order] CRITICAL: Rename to temp for ${op.oldPath} reported success, but ${op.tempPath} does NOT exist.`
              );
              throw new Error(`Temporary path was not created: ${op.tempPath}`);
            }
            if (sourceStillExists) {
              log.warn(
                `[Main - update-mod-order] WARNING: Source path ${op.oldPath} still exists after rename to temp. This might indicate a copy instead of move.`
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
            // Verifica che il percorso temporaneo esista prima di tentare la rinomina finale
            if (!fs.existsSync(op.tempPath)) {
              log.error(
                `[Main - update-mod-order] CRITICAL: Temporary path ${op.tempPath} does not exist before final rename. This indicates the temp file was lost or deleted.`
              );
              // Tenta di elencare il contenuto della directory padre per diagnostica
              try {
                const parentDir = nodePath.dirname(op.tempPath);
                const parentContents = fs.readdirSync(parentDir);
                log.info(`[Main - update-mod-order] Parent directory ${parentDir} contents: ${JSON.stringify(parentContents)}`);
              } catch (listError: any) {
                log.error(`[Main - update-mod-order] Failed to list parent directory contents: ${listError.message}`);
              }
              throw new Error(`Temporary path does not exist: ${op.tempPath}`);
            }
            
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

// --- IPC Handlers for Profile Management ---

const PROFILES_DIR_NAME = 'profiles';
const PROFILES_FILE_NAME = 'profiles.json';

ipcMain.handle('get-profile-paths', async () => {
  log.info('[Main Process] Renderer requested profile paths.');
  try {
    const userDataPath = app.getPath('userData');
    const profilesDir = nodePath.join(userDataPath, PROFILES_DIR_NAME);
    const profilesFilePath = nodePath.join(profilesDir, PROFILES_FILE_NAME);
    log.info(
      `[Main Process] Determined profile paths: Dir - ${profilesDir}, File - ${profilesFilePath}`
    );
    return { success: true, paths: { profilesDir, profilesFilePath } };
  } catch (error: any) {
    log.error('[Main Process] Error getting profile paths:', error);
    return {
      success: false,
      error: error.message || 'Failed to get profile paths.',
    };
  }
});

ipcMain.handle('get-user-data-path', async () => {
  log.info('[Main Process] Renderer requested user data path.');
  try {
    const userDataPath = app.getPath('userData');
    return { success: true, path: userDataPath };
  } catch (error: any) {
    log.error('[Main Process] Error getting user data path:', error);
    return {
      success: false,
      error: error.message || 'Failed to get user data path.',
    };
  }
});

ipcMain.handle('profiles-access', async (event, filePath: string) => {
  log.info(
    `[Main Process] Renderer requested to check access to file: ${filePath}`
  );
  try {
    await fsPromises.access(filePath);
    return { success: true, exists: true };
  } catch (error: any) {
    // Se l'errore è ENOENT (file non trovato), non è un vero errore dell'operazione, ma un risultato.
    if (error.code === 'ENOENT') {
      return { success: true, exists: false };
    }
    log.error(`[Main Process] Error accessing file ${filePath}:`, error);
    return {
      success: false,
      error: error.message || `Failed to access file ${filePath}.`,
      exists: false,
    };
  }
});

ipcMain.handle('profiles-mkdir', async (event, dirPath: string) => {
  log.info(`[Main Process] Renderer requested to create directory: ${dirPath}`);
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error: any) {
    log.error(`[Main Process] Error creating directory ${dirPath}:`, error);
    return {
      success: false,
      error: error.message || `Failed to create directory ${dirPath}.`,
    };
  }
});

ipcMain.handle('profiles-read-file', async (event, filePath: string) => {
  log.info(`[Main Process] Renderer requested to read file: ${filePath}`);
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error: any) {
    log.error(`[Main Process] Error reading file ${filePath}:`, error);
    return {
      success: false,
      error: error.message || `Failed to read file ${filePath}.`,
    };
  }
});

ipcMain.handle(
  'profiles-write-file',
  async (event, filePath: string, content: string) => {
    log.info(`[Main Process] Renderer requested to write file: ${filePath}`);
    try {
      await fsPromises.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error: any) {
      log.error(`[Main Process] Error writing file ${filePath}:`, error);
      return {
        success: false,
        error: error.message || `Failed to write file ${filePath}.`,
      };
    }
  }
);
// --- END IPC Handlers for Profile Management ---

// --- IPC Handlers for Generic File Operations (Import/Export Profiles) ---

ipcMain.handle(
  'show-save-dialog',
  async (event, options: Electron.SaveDialogOptions) => {
    log.info(
      '[Main Process] Renderer requested to show save dialog with options:',
      options
    );
    if (!win) {
      log.error('[Main Process] Main window not available for showSaveDialog.');
      return { canceled: true, error: 'Main window not available.' };
    }
    try {
      const result = await dialog.showSaveDialog(win, options);
      log.info('[Main Process] Save dialog result:', result);
      return result;
    } catch (error: any) {
      log.error('[Main Process] Error showing save dialog:', error);
      return {
        canceled: true,
        error: error.message || 'Failed to show save dialog.',
      };
    }
  }
);

ipcMain.handle(
  'show-open-dialog',
  async (event, options: Electron.OpenDialogOptions) => {
    log.info(
      '[Main Process] Renderer requested to show open dialog with options:',
      options
    );
    if (!win) {
      log.error('[Main Process] Main window not available for showOpenDialog.');
      return { canceled: true, error: 'Main window not available.' };
    }
    try {
      const result = await dialog.showOpenDialog(win, options);
      log.info('[Main Process] Open dialog result:', result);
      return result;
    } catch (error: any) {
      log.error('[Main Process] Error showing open dialog:', error);
      return {
        canceled: true,
        error: error.message || 'Failed to show open dialog.',
      };
    }
  }
);

ipcMain.handle('read-file-content', async (event, filePath: string) => {
  log.info(
    `[Main Process] Renderer requested to read file content: ${filePath}`
  );
  try {
    // Validate filePath if necessary (e.g., ensure it's within allowed directories if sandboxing)
    // For now, assuming filePath is trusted or validated by the renderer/service layer.
    const content = await fsPromises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error: any) {
    log.error(
      `[Main Process] Error reading file content from ${filePath}:`,
      error
    );
    // Specific check for ENOENT (File not found)
    if (error.code === 'ENOENT') {
      return {
        success: false,
        error: `File not found: ${filePath}`,
        code: 'ENOENT',
      };
    }
    return {
      success: false,
      error: error.message || `Failed to read file content from ${filePath}.`,
    };
  }
});

ipcMain.handle(
  'write-file-content',
  async (event, filePath: string, content: string) => {
    log.info(
      `[Main Process] Renderer requested to write file content to: ${filePath}`
    );
    try {
      // Validate filePath if necessary
      await fsPromises.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error: any) {
      log.error(
        `[Main Process] Error writing file content to ${filePath}:`,
        error
      );
      return {
        success: false,
        error: error.message || `Failed to write file content to ${filePath}.`,
      };
    }
  }
);

// --- END IPC Handlers for Generic File Operations ---

// --- IPC Handlers for Theme ---
ipcMain.handle('get-theme', async () => {
  const theme = store.get('theme', 'system'); // Default a 'system' se non impostato
  log.info(`[Main] Renderer requested theme, returning: ${theme}`);
  return theme;
});

ipcMain.handle(
  'set-theme',
  async (event, themeValue: 'light' | 'dark' | 'system') => {
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
  }
);
// --- END IPC Handlers for Theme ---
