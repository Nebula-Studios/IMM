import { app, BrowserWindow, dialog } from 'electron';
import * as nodePath from 'path';
import { store } from './store.js';
import log from 'electron-log';

// It's often good practice to group constants.
export const INZOI_MOD_MANAGER_FILES_DIR_NAME = 'inzoi_mod_manager_files';
export const STAGED_MODS_DIR_NAME = 'staged_mods';

/**
 * Retrieves the absolute default path to the staging directory for mods.
 * This directory is located within the application's user data folder.
 * @returns {string} The absolute default path to the staging directory.
 */
export function getDefaultStagingPath(): string {
  const userDataPath = app.getPath('userData');
  const defaultPath = nodePath.join(
    userDataPath,
    INZOI_MOD_MANAGER_FILES_DIR_NAME,
    STAGED_MODS_DIR_NAME
  );
  const customPath = store.get('modStagingPath');
  return customPath || defaultPath;
}

/**
 * Retrieves the current staging path for mods.
 * It first checks if a custom path is set in the store,
 * otherwise, it returns the default staging path.
 * @returns {string} The current absolute path to the staging directory.
 */
export function getCurrentStagingPath(): string {
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

export const getStagingPath = getCurrentStagingPath;

/**
 * Gets the path to the game's Mods directory in the user's Documents folder.
 * This is the new standard path for active mods.
 * @returns {Promise<string>} The full path to the Documents/InZOI/Mods directory.
 */
export async function getGameModsPath(): Promise<string> {
  const documentsPath = app.getPath('documents');
  const modsPath = nodePath.join(documentsPath, 'InZOI', 'Mods');
  log.info(`[Paths] Determined game mods path: ${modsPath}`);
  return modsPath;
}

/**
 * Gets the path to the game's root directory from the store.
 * @returns {string | null} The game path or null if not set.
 */
export function getGamePath(): string | null {
  const gamePath = store.get('gamePath');
  if (gamePath && typeof gamePath === 'string') {
    log.info(`[Paths] Determined game path: ${gamePath}`);
    return gamePath;
  }
  log.warn(`[Paths] Game path not set in store.`);
  return null;
}

export async function setGamePath(win: BrowserWindow): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Select InZOI Game Folder',
    properties: ['openDirectory'],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const selectedPath = filePaths[0];
  store.set('gamePath', selectedPath);
  return selectedPath;
}

export async function setStagingPath(win: BrowserWindow): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Select Custom Mod Staging Folder',
    properties: ['openDirectory'],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const selectedPath = filePaths[0];
  store.set('customStagingPath', selectedPath);
  return selectedPath;
} 