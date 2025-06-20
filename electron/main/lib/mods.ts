import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import * as nodePath from 'path';
import log from 'electron-log';
import { app } from 'electron';

import { store } from './store.js';
import { getCurrentStagingPath, getGameModsPath } from './paths.js';

export interface ModItemForStore {
    id: string;
    name: string;
    path: string;
    activePath?: string | null;
    numericPrefix?: string | null;
    author?: string;
    version?: string;
}

// Function to sanitize a string to be used as a directory name
export function sanitizeDirectoryName(name: string): string {
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

export interface ProcessedModInfo {
  name: string;
  pakPath: string;
  ucasPath: string | null;
  utocPath: string | null;
  originalPath: string;
  author?: string;
  version?: string;
}

export interface ProcessDroppedModsResult {
  success: boolean;
  mods?: ProcessedModInfo[];
  error?: string;
}

// Funzione ricorsiva per copiare una directory
export async function copyDirRecursive(src: string, dest: string): Promise<void> {
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

export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stat = await fsPromises.stat(path);
    return stat.isDirectory();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return false;
    }
    log.warn(`[directoryExists] Error checking path ${path}: ${error.message}`);
    return false;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(path);
    return stats.isFile();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return false;
    }
    log.warn(`[fileExists] Error checking path ${path}: ${error.message}`);
    return false;
  }
}

export async function renumberRemainingActiveMods(
  gameModsDir: string,
  disabledModPrefix: string | null
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
      
      const itemsToRename: {
        currentPath: string;
        currentName: string;
        currentPrefix: number;
        newPrefix: number;
        newName: string;
        newPath: string;
      }[] = [];

      for (const item of allItems) {
        const itemName = item.name;
        const itemPath = nodePath.join(gameModsDir, itemName);
        
        if (itemName.includes('_imm_temp_rename') || itemName.includes('_temp_') || itemName.startsWith('~') || !item.isDirectory()) {
          log.info(`[renumberRemainingActiveMods] Saltando elemento: ${itemName}`);
          continue;
        }
        
        const match = itemName.match(/^(\d{3})_(.+)$/);
        if (match && match[1] && match[2]) {
          const currentPrefix = parseInt(match[1], 10);
          const baseName = match[2];
          
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
            });
          }
        }
      }

      if (itemsToRename.length === 0) {
        log.info('[renumberRemainingActiveMods] Nessun elemento da rinominare trovato.');
        return;
      }

      itemsToRename.sort((a, b) => a.currentPrefix - b.currentPrefix);

      log.info(
        `[renumberRemainingActiveMods] Trovati ${itemsToRename.length} elementi da rinominare: ${itemsToRename.map(item => `${item.currentName} -> ${item.newName}`).join(', ')}`
      );

      for (const item of itemsToRename) {
        try {
          if (!fs.existsSync(item.currentPath)) {
            log.warn(`[renumberRemainingActiveMods] Elemento ${item.currentPath} non trovato, saltando rinomina.`);
            continue;
          }

          const currentName = nodePath.basename(item.currentPath);
          if (currentName.includes('_imm_temp_rename') || currentName.includes('_temp_') || currentName.startsWith('~')) {
            log.warn(`[renumberRemainingActiveMods] Elemento ${item.currentPath} è diventato temporaneo, saltando rinomina.`);
            continue;
          }

          if (fs.existsSync(item.newPath)) {
            log.error(
              `[renumberRemainingActiveMods] Destinazione ${item.newPath} già esistente, saltando rinomina di ${item.currentName}.`
            );
            continue;
          }

          await fsPromises.rename(item.currentPath, item.newPath);
          
          log.info(
            `[renumberRemainingActiveMods] Rinominata directory ${item.currentName} -> ${item.newName} (prefisso ${item.currentPrefix} -> ${item.newPrefix})`
          );
          
        } catch (renameError: any) {
          log.error(
            `[renumberRemainingActiveMods] Errore rinominando ${item.currentName}: ${renameError.message}`
          );
        }
      }

      log.info('[renumberRemainingActiveMods] Rinumerazione completata.');
      
    } catch (error: any) {
      log.error(`[renumberRemainingActiveMods] Errore durante la scansione di ${gameModsDir}: ${error.message}`);
      throw error;
    }
}

export async function scanDirectoryForPaks(
  directoryPath: string | null,
  isGameModsDirectory: boolean = false
): Promise<ModItemForStore[]> {
  // ... (implementation moved from index.ts)
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
      for (const item of items) {
        if (item.isDirectory() && /^\d{3}_/.test(item.name)) {
          const modFolderName = item.name;
          const actualModName = modFolderName.substring(4);
          const modFolderPath = nodePath.join(directoryPath, modFolderName);
          try {
            const filesInsideModFolder = await fsPromises.readdir(modFolderPath);
            let foundPakFile = filesInsideModFolder.find(f => f.toLowerCase().endsWith('.pak'));
            if (foundPakFile) {
              const pakFilePath = nodePath.join(modFolderPath, foundPakFile);
              pakFiles.push({
                id: pakFilePath,
                name: actualModName,
                path: pakFilePath,
                activePath: modFolderPath,
                numericPrefix: modFolderName.substring(0, 3)
              });
            }
          } catch (e: any) {
            log.error(`[scanDirectoryForPaks] Error reading mod directory ${modFolderPath}: ${e.message}`);
          }
        }
      }
    } else {
        const findFirstPakRecursive = async (currentSearchDir: string): Promise<string | null> => {
            try {
                const entries = await fsPromises.readdir(currentSearchDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isFile() && nodePath.extname(entry.name).toLowerCase() === '.pak') {
                        return nodePath.join(currentSearchDir, entry.name);
                    }
                }
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const foundPakPath = await findFirstPakRecursive(nodePath.join(currentSearchDir, entry.name));
                        if (foundPakPath) return foundPakPath;
                    }
                }
            } catch (e: any) {
                log.error(`[scanDirectoryForPaks - Staging] Error reading dir ${currentSearchDir}: ${e.message}`);
            }
            return null;
        };
        for (const item of items) {
            if (item.isDirectory()) {
                const modFolderName = item.name;
                const modFolderPath = nodePath.join(directoryPath, modFolderName);
                const pakFilePath = await findFirstPakRecursive(modFolderPath);
                if (pakFilePath) {
                    pakFiles.push({
                        id: pakFilePath,
                        name: modFolderName,
                        path: pakFilePath,
                    });
                } else {
                    log.warn(`[scanDirectoryForPaks - Staging] No .pak file found recursively in: ${modFolderPath}`);
                }
            }
        }
    }
    return pakFiles;
  } catch (error: any) {
    log.error(`[scanDirectoryForPaks] Error scanning directory ${directoryPath}:`, error);
    return [];
  }
}

export async function synchronizeModStatesLogic(): Promise<{
  success: boolean;
  disabledMods: ModItemForStore[];
  enabledMods: ModItemForStore[];
  error?: string;
}> {
  try {
    const stagingPath = getCurrentStagingPath();
    const gameModsPath = await getGameModsPath();

    const finalEnabledMods: ModItemForStore[] = [];
    const finalDisabledMods: ModItemForStore[] = [];

    const processModDirectory = async (
      dirPath: string,
      isEnabled: boolean
    ): Promise<ModItemForStore | null> => {
      const manifestPath = findFileRecursive(dirPath, 'mod_manifest.json');
      const paks = findPaksRecursive(dirPath);

      if (!manifestPath || paks.length === 0) {
        log.warn(
          `[Sync] Skipping invalid mod directory ${dirPath}: missing manifest or .pak file.`
        );
        return null;
      }

      let fileContent = await fsPromises.readFile(manifestPath);
      if (fileContent[0] === 0xEF && fileContent[1] === 0xBB && fileContent[2] === 0xBF) {
        fileContent = fileContent.slice(3);
      }
      const manifestContent = JSON.parse(fileContent.toString('utf-8'));

      const baseName = isEnabled
        ? nodePath.basename(dirPath).substring(4)
        : nodePath.basename(dirPath);

      const version =
        manifestContent.Version?.replace('.W.MODKIT.EGS', '') || undefined;

      return {
        id: paks[0],
        name: manifestContent.FriendlyName || baseName,
        path: paks[0],
        author: manifestContent.Author,
        version: version,
        activePath: isEnabled ? dirPath : undefined,
        numericPrefix: isEnabled
          ? nodePath.basename(dirPath).substring(0, 3)
          : undefined,
      };
    };

    // Process enabled mods found in the game's mod directory
    if (fs.existsSync(gameModsPath)) {
      for (const dir of fs.readdirSync(gameModsPath)) {
        const fullPath = nodePath.join(gameModsPath, dir);
        if (/^\\d{3}_/.test(dir) && fs.statSync(fullPath).isDirectory()) {
          const modItem = await processModDirectory(fullPath, true);
          if (modItem) finalEnabledMods.push(modItem);
        }
      }
    }

    // Process disabled mods from the staging directory
    const enabledDirBaseNames = new Set(
      finalEnabledMods.map((m) => nodePath.basename(m.activePath!).substring(4))
    );

    if (fs.existsSync(stagingPath)) {
      for (const dir of fs.readdirSync(stagingPath)) {
        const fullPath = nodePath.join(stagingPath, dir);
        if (fs.statSync(fullPath).isDirectory()) {
          if (!enabledDirBaseNames.has(dir)) {
            const modItem = await processModDirectory(fullPath, false);
            if (modItem) finalDisabledMods.push(modItem);
          }
        }
      }
    }

    // The store is now treated as a cache of the last known valid state
    store.set('savedEnabledMods', finalEnabledMods);
    store.set('savedDisabledMods', finalDisabledMods);

    return {
      success: true,
      disabledMods: finalDisabledMods,
      enabledMods: finalEnabledMods,
    };
  } catch (error: any) {
    log.error('Error during mod state synchronization:', error);
    return {
      success: false,
      error: error.message,
      disabledMods: [],
      enabledMods: [],
    };
  }
}

export function findPaksRecursive(dir: string): string[] {
  let paks: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        paks = paks.concat(findPaksRecursive(fullPath));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pak')) {
        paks.push(fullPath);
      }
    }
  } catch (error) {
    log.error(`Error reading directory ${dir}:`, error);
  }
  return paks;
}

/**
 * Recursively finds the first occurrence of a file in a directory.
 * @param dir The directory to start searching from.
 * @param fileName The name of the file to find (case-insensitive).
 * @returns The full path to the file if found, otherwise null.
 */
export function findFileRecursive(
  dir: string,
  fileName: string
): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFileRecursive(fullPath, fileName);
        if (found) return found;
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase() === fileName.toLowerCase()
      ) {
        return fullPath;
      }
    }
  } catch (error) {
    log.error(`Error scanning directory ${dir}:`, error);
  }
  return null;
}