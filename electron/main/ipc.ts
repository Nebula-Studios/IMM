import { ipcMain, shell, dialog, app, BrowserWindow } from 'electron';
import log from 'electron-log';
import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { createExtractorFromFile } from 'node-unrar-js';
import fsPromises from 'node:fs/promises';
import * as nodePath from 'path';
import { ModItem } from '../../src/types/common.js';
import {
  getCurrentStagingPath,
  getDefaultStagingPath,
  getGameModsPath,
  getStagingPath,
  getGamePath,
  setGamePath,
  setStagingPath,
} from './lib/paths.js';
import {
  sanitizeDirectoryName,
  copyDirRecursive,
  renumberRemainingActiveMods,
  synchronizeModStatesLogic,
  scanDirectoryForPaks,
  ProcessedModInfo,
  findPaksRecursive,
  findFileRecursive,
} from './lib/mods.js';
import { store } from './lib/store.js';

export function registerIpcHandlers(win: BrowserWindow | null) {
  // --- IPC Handlers for Game Folder ---

  ipcMain.handle('get-game-folder-path', async () => {
    const gameFolderPath = store.get('gameFolderPath');
    log.info('Renderer requested game folder path, returning:', gameFolderPath);
    return gameFolderPath;
  });

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

  ipcMain.handle('save-game-folder-path', async (event, folderPath: string) => {
    if (typeof folderPath === 'string' && folderPath.length > 0) {
      const folderName = nodePath.basename(folderPath);
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

  // --- IPC Handler for Logging ---
  ipcMain.on(
    'log-from-renderer',
    (event, level: string, message: string, ...args: unknown[]) => {
      const logMessage = `[Renderer] ${message}`;
      switch (level) {
        case 'error': log.error(logMessage, ...args); break;
        case 'warn': log.warn(logMessage, ...args); break;
        case 'info': log.info(logMessage, ...args); break;
        case 'debug': log.debug(logMessage, ...args); break;
        case 'verbose': log.verbose(logMessage, ...args); break;
        default: log.info(`[Renderer - unknown level: ${level}] ${message}`, ...args); break;
      }
    }
  );
  
  // --- IPC Handler for Opening External Links ---
  ipcMain.handle('open-external-link', async (event, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Invalid URL. Only http/https links are allowed.'};
  });

  // --- IPC Handler for Dropped Mods ---
  ipcMain.handle('process-dropped-mod-paths', async (event, filePaths: string[]) => {
    const stagingPath = getCurrentStagingPath();
    if (!fs.existsSync(stagingPath)) {
      fs.mkdirSync(stagingPath, { recursive: true });
    }

    const processedModsInfo: ProcessedModInfo[] = [];
    const failedMods: { name: string; reason: string }[] = [];

    for (const originalSourcePath of filePaths) {
      if (!originalSourcePath) {
        log.warn(`Skipping a file with no path.`);
        continue;
      }
      
      const absolutePath = nodePath.resolve(originalSourcePath);
      const fileExtension = nodePath.extname(absolutePath).toLowerCase();
      const baseName = nodePath.basename(absolutePath, fileExtension);
      const sanitizedModName = sanitizeDirectoryName(baseName);
      
      try {
        if (['.zip', '.rar', '.7z'].includes(fileExtension)) {
          const modFinalStagingDir = nodePath.join(stagingPath, sanitizedModName);

          if (fs.existsSync(modFinalStagingDir)) {
            failedMods.push({ name: sanitizedModName, reason: 'Directory already exists.' });
            continue; 
          }
          
          const tempExtractDir = modFinalStagingDir + '_temp_extract';
          fs.mkdirSync(tempExtractDir, { recursive: true });

          if (fileExtension === '.zip') {
            const zip = new AdmZip(absolutePath);
            zip.extractAllTo(tempExtractDir, true);
          } else if (fileExtension === '.rar') {
            const extractor = await createExtractorFromFile({ filepath: absolutePath, targetPath: tempExtractDir });
            [...extractor.extract().files];
          } else if (fileExtension === '.7z') {
            const SevenZipLib = require('7zip-min');
            await SevenZipLib.extractFull(absolutePath, tempExtractDir);
          }

          const entries = fs.readdirSync(tempExtractDir);
          if (entries.length === 1 && fs.statSync(nodePath.join(tempExtractDir, entries[0])).isDirectory()) {
            fs.renameSync(nodePath.join(tempExtractDir, entries[0]), modFinalStagingDir);
            fs.rmdirSync(tempExtractDir);
          } else {
            fs.renameSync(tempExtractDir, modFinalStagingDir);
          }
          
          const manifestPath = findFileRecursive(modFinalStagingDir, 'mod_manifest.json');
          if (!manifestPath) {
            failedMods.push({ name: sanitizedModName, reason: `Manifest 'mod_manifest.json' not found.` });
            await fsPromises.rm(modFinalStagingDir, { recursive: true, force: true });
            continue;
          }

          // Read and parse the manifest, stripping UTF-8 BOM if present
          let fileContent = await fsPromises.readFile(manifestPath);
          if (fileContent[0] === 0xEF && fileContent[1] === 0xBB && fileContent[2] === 0xBF) {
            fileContent = fileContent.slice(3);
          }
          const manifestContent = JSON.parse(fileContent.toString('utf-8'));
          const displayName = manifestContent.FriendlyName || sanitizedModName;
          const author = manifestContent.Author;
          let version = manifestContent.Version;
          if (typeof version === 'string' && version.endsWith('.W.MODKIT.EGS')) {
            version = version.replace('.W.MODKIT.EGS', '');
          }

          const paksInDir = findPaksRecursive(modFinalStagingDir);
          const primaryPakPath = paksInDir.length > 0 ? paksInDir[0] : modFinalStagingDir;
          const pakDir = paksInDir.length > 0 ? nodePath.dirname(primaryPakPath) : modFinalStagingDir;
          const pakFileName = paksInDir.length > 0 ? nodePath.basename(primaryPakPath, '.pak') : sanitizedModName;
          
          const modInfo: ProcessedModInfo = {
            name: displayName,
            pakPath: primaryPakPath,
            ucasPath: nodePath.join(pakDir, `${pakFileName}.ucas`),
            utocPath: nodePath.join(pakDir, `${pakFileName}.utoc`),
            originalPath: absolutePath,
            author,
            version,
          };
          if (!fs.existsSync(modInfo.ucasPath!)) modInfo.ucasPath = null;
          if (!fs.existsSync(modInfo.utocPath!)) modInfo.utocPath = null;
          processedModsInfo.push(modInfo);
          
        } else if (fileExtension === '.pak') {
          const modFinalStagingDir = nodePath.join(stagingPath, sanitizedModName);

          if (fs.existsSync(modFinalStagingDir)) {
            failedMods.push({ name: sanitizedModName, reason: 'Directory already exists.' });
            continue;
          }
          fs.mkdirSync(modFinalStagingDir, { recursive: true });

          const destinationPakPath = nodePath.join(modFinalStagingDir, nodePath.basename(absolutePath));
          fs.copyFileSync(absolutePath, destinationPakPath);
          
          const sourceDir = nodePath.dirname(absolutePath);
          const pakBaseName = nodePath.basename(absolutePath, '.pak');
          const ucasSourcePath = nodePath.join(sourceDir, `${pakBaseName}.ucas`);
          const utocSourcePath = nodePath.join(sourceDir, `${pakBaseName}.utoc`);
          let ucasDestPath: string | null = null;
          let utocDestPath: string | null = null;

          if (fs.existsSync(ucasSourcePath)) {
            ucasDestPath = nodePath.join(modFinalStagingDir, `${pakBaseName}.ucas`);
            fs.copyFileSync(ucasSourcePath, ucasDestPath);
          }
          if (fs.existsSync(utocSourcePath)) {
            utocDestPath = nodePath.join(modFinalStagingDir, `${pakBaseName}.utoc`);
            fs.copyFileSync(utocSourcePath, utocDestPath);
          }

          // In this simple case, we must assume the manifest is dropped alongside the .pak
           const manifestPath = findFileRecursive(sourceDir, 'mod_manifest.json');
           if (!manifestPath) {
            failedMods.push({ name: sanitizedModName, reason: `Manifest 'mod_manifest.json' must be in the same folder as the .pak file.` });
            await fsPromises.rm(modFinalStagingDir, { recursive: true, force: true });
            continue;
          }
          // We can copy it into the staging dir for consistency
          fs.copyFileSync(manifestPath, nodePath.join(modFinalStagingDir, 'mod_manifest.json'));

          // Read and parse the manifest, stripping UTF-8 BOM if present
          let fileContent = await fsPromises.readFile(manifestPath);
          if (fileContent[0] === 0xEF && fileContent[1] === 0xBB && fileContent[2] === 0xBF) {
            fileContent = fileContent.slice(3);
          }
          const manifestContent = JSON.parse(fileContent.toString('utf-8'));
          const displayName = manifestContent.FriendlyName || sanitizedModName;
          const author = manifestContent.Author;
          let version = manifestContent.Version;
          if (typeof version === 'string' && version.endsWith('.W.MODKIT.EGS')) {
            version = version.replace('.W.MODKIT.EGS', '');
          }

          processedModsInfo.push({
            name: displayName,
            pakPath: destinationPakPath,
            ucasPath: ucasDestPath,
            utocPath: utocDestPath,
            originalPath: absolutePath,
            author,
            version,
          });
        }
      } catch (err: any) {
        log.error(`Error processing file ${absolutePath}:`, err.message);
        failedMods.push({ name: sanitizedModName, reason: err.message });
      }
    }

    if (processedModsInfo.length > 0) {
      const currentDisabledMods = store.get('savedDisabledMods', []);
      const newModsForStore = processedModsInfo.map(mod => ({
        id: mod.pakPath,
        name: mod.name,
        path: mod.pakPath,
        author: mod.author,
        version: mod.version,
      }));
      store.set('savedDisabledMods', [...currentDisabledMods, ...newModsForStore]);
    }
    
    return { success: processedModsInfo.length > 0, mods: processedModsInfo, failedMods };
  });

  // --- IPC Handlers for Staging Path ---
  ipcMain.handle('get-mod-staging-path-config', async () => {
    const customPath = store.get('modStagingPath');
    return {
      customPath: typeof customPath === 'string' ? customPath : null,
      defaultPath: getDefaultStagingPath(),
      activePath: getCurrentStagingPath(),
    };
  });

  ipcMain.handle('set-mod-staging-path', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Mod Staging Directory',
      defaultPath: getCurrentStagingPath(),
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'Directory selection canceled.' };
    }
    
    const selectedPath = filePaths[0];
    try {
      if (!fs.existsSync(selectedPath)) fs.mkdirSync(selectedPath, { recursive: true });
      store.set('modStagingPath', selectedPath);
      return { success: true, path: selectedPath };
    } catch (error: any) {
      return { success: false, error: `Failed to set staging directory: ${error.message}` };
    }
  });

  ipcMain.handle('clear-mod-staging-path', async () => {
    try {
      store.delete('modStagingPath');
      return { success: true, message: 'Mod staging path cleared.' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // --- IPC Handlers for Mod Enable/Disable ---
  ipcMain.handle('enable-mod', async (event, modStagingPakPath: string, modName: string) => {
    const gameModsPath = await getGameModsPath();
    if (!fs.existsSync(gameModsPath)) await fsPromises.mkdir(gameModsPath, { recursive: true });
    
    try {
      const stagingPath = getCurrentStagingPath();
      
      // Correctly determine the root source directory of the mod within staging.
      const relativePathFromStaging = nodePath.relative(stagingPath, modStagingPakPath);
      if (relativePathFromStaging.startsWith('..') || nodePath.isAbsolute(relativePathFromStaging)) {
        throw new Error('Security Error: Mod source path is outside of the staging directory.');
      }
      const modRootInStaging = relativePathFromStaging.split(nodePath.sep)[0];
      const sourceModDirectory = nodePath.join(stagingPath, modRootInStaging);

      const itemsInGameModsDir = await fsPromises.readdir(gameModsPath);
      let maxIndex = -1;
      for (const item of itemsInGameModsDir) {
          const match = item.match(/^(\\d{3})_/);
          if (match?.[1]) {
            const index = parseInt(match[1], 10);
            if (index > maxIndex) {
              maxIndex = index;
            }
          }
      }
      const numericPrefix = String(maxIndex + 1).padStart(3, '0');
      const modFolderNameInGame = `${numericPrefix}_${modName}`;
      const destinationPathInGame = nodePath.join(gameModsPath, modFolderNameInGame);

      // Use recursive copy instead of move to preserve the original staged mod
      await copyDirRecursive(sourceModDirectory, destinationPathInGame);
      log.info(`[Enable Mod] Copied mod from ${sourceModDirectory} to ${destinationPathInGame}`);
      
      return { 
        success: true, 
        activePath: destinationPathInGame,
        numericPrefix: numericPrefix 
      };

    } catch (error: any) {
      log.error(`[Enable Mod] Error enabling mod ${modName}:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('disable-mod', async (event, modToDisable: ModItem) => {
    const gameModsDir = await getGameModsPath();
    const stagingPath = getCurrentStagingPath();
    const enabledModsFromStore = store.get('savedEnabledMods', []);
    const storedModEntry = enabledModsFromStore.find(mod => mod.id === modToDisable.id);
    
    const modDirInGame = storedModEntry?.activePath || modToDisable.activePath;

    if (!modDirInGame) {
      log.error(`[Disable Mod] activePath is missing for mod ${modToDisable.name}. Cannot disable.`);
      return { success: false, error: `Could not determine the active directory for mod ${modToDisable.name}.` };
    }

    // Safety check: ensure we are deleting something inside the ~mods folder
    if (!modDirInGame.startsWith(gameModsDir)) {
        log.error(`[Disable Mod] SECURITY_ERROR: Attempted to process directory outside of ~mods folder. Path: ${modDirInGame}`);
        return { success: false, error: "Operation path is outside the game's mods directory. Operation aborted." };
    }
    
    try {
        if (fs.existsSync(modDirInGame)) {
            const destinationPathInStaging = nodePath.join(stagingPath, modToDisable.name);

            if (fs.existsSync(destinationPathInStaging)) {
                log.warn(`[Disable Mod] Directory ${destinationPathInStaging} already exists. Removing it before moving the active mod back.`);
                await fsPromises.rm(destinationPathInStaging, { recursive: true, force: true });
            }

            await fsPromises.rename(modDirInGame, destinationPathInStaging);
            log.info(`[Disable Mod] Successfully moved mod from ${modDirInGame} to ${destinationPathInStaging}`);
        } else {
            log.warn(`[Disable Mod] Mod directory to move not found, it might have been removed manually: ${modDirInGame}`);
        }

        const modFolderName = nodePath.basename(modDirInGame);
        const prefixMatch = modFolderName.match(/^(\\d{3})_/);
        const numericPrefix = prefixMatch ? prefixMatch[1] : null;

        await renumberRemainingActiveMods(gameModsDir, numericPrefix);

        // Update store
        const currentEnabledMods = store.get('savedEnabledMods', []).filter(mod => mod.id !== modToDisable.id);
        const disabledMod = store.get('savedEnabledMods', []).find(mod => mod.id === modToDisable.id);

        store.set('savedEnabledMods', currentEnabledMods);

        if (disabledMod) {
          let currentDisabledMods = store.get('savedDisabledMods', []);
          if (!currentDisabledMods.some(mod => mod.id === modToDisable.id)) {
              const { activePath, numericPrefix, ...modToStoreAsDisabled } = disabledMod;
              currentDisabledMods.push(modToStoreAsDisabled);
              store.set('savedDisabledMods', currentDisabledMods);
          }
        }
        
        return { success: true };
    } catch (error: any) {
        log.error(`[Disable Mod] Error disabling mod ${modToDisable.name}:`, error);
        return { success: false, error: error.message };
    }
  });

  // --- IPC Handlers for Mod Lists ---
  ipcMain.handle('load-mod-lists', async () => {
    try {
      const disabledMods = store.get('savedDisabledMods', []);
      const enabledMods = store.get('savedEnabledMods', []);
      return { success: true, disabledMods, enabledMods };
    } catch (error: any) {
      return { success: false, error: error.message, disabledMods: [], enabledMods: [] };
    }
  });

  ipcMain.handle('save-mod-lists', async (event, modLists: { disabledMods: ModItem[]; enabledMods: ModItem[] }) => {
    try {
      const disabledToSave = modLists.disabledMods.map(({ activePath, ...rest }) => rest);
      store.set('savedDisabledMods', disabledToSave);
      store.set('savedEnabledMods', modLists.enabledMods);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // --- IPC Handlers for Sync/Refresh/Scan ---
  ipcMain.handle('scan-staging-directory', async () => {
      const stagingPath = getCurrentStagingPath();
      try {
          const mods = await scanDirectoryForPaks(stagingPath, false);
          return { success: true, mods };
      } catch (error: any) {
          return { success: false, error: error.message, mods: [] };
      }
  });

  ipcMain.handle('sync-mod-states', async () => synchronizeModStatesLogic());

  ipcMain.handle('refresh-mod-list', async () => {
    try {
        const syncResult = await synchronizeModStatesLogic();
        const disabledToSave = syncResult.disabledMods.map(({ activePath, ...rest }) => rest);
        store.set('savedDisabledMods', disabledToSave);
        store.set('savedEnabledMods', syncResult.enabledMods);
        return syncResult;
    } catch (error: any) {
        return { success: false, error: error.message, disabledMods: [], enabledMods: [] };
    }
  });

  // --- IPC Handler for Mod Order ---
  ipcMain.handle('update-mod-order', async (event, orderedMods: ModItem[]) => {
      if (orderedMods.some(mod => !mod.activePath)) {
          return { success: false, error: 'Some mods missing activePath.' };
      }
      const gameModsPath = await getGameModsPath();
      if (!fs.existsSync(gameModsPath)) {
          return { success: true, updatedMods: orderedMods };
      }
      const tempSuffix = '_imm_temp_rename';
      const renameOperations: { oldPath: string; newPath: string; tempPath: string, originalModId: string }[] = [];
      try {
          for (let i = 0; i < orderedMods.length; i++) {
              const mod = orderedMods[i];
              if (mod.activePath!.endsWith('~mods')) continue;

              const currentModFolderName = nodePath.basename(mod.activePath!);
              const baseNameMatch = currentModFolderName.match(/^\d{3}_(.*)$/);
              const baseName = baseNameMatch?.[1] ?? sanitizeDirectoryName(currentModFolderName);
              const newFolderName = `${String(i).padStart(3, '0')}_${baseName}`;
              const newModFullPath = nodePath.join(gameModsPath, newFolderName);
              if (mod.activePath! !== newModFullPath) {
                  renameOperations.push({ originalModId: mod.id, oldPath: mod.activePath!, newPath: newModFullPath, tempPath: mod.activePath! + tempSuffix });
              }
          }
          
          for (const op of renameOperations) if(fs.existsSync(op.oldPath)) await fsPromises.rename(op.oldPath, op.tempPath);
          for (const op of renameOperations) if(fs.existsSync(op.tempPath)) await fsPromises.rename(op.tempPath, op.newPath);

          const updatedModList = orderedMods.map(mod => {
              const operation = renameOperations.find(op => op.originalModId === mod.id);
              return operation ? { ...mod, activePath: operation.newPath } : mod;
          });
          return { success: true, updatedMods: updatedModList };
      } catch (error: any) {
          log.error('Error updating mod order:', error);
          // Rollback attempt
          for (const op of renameOperations) {
              if (fs.existsSync(op.tempPath)) await fsPromises.rename(op.tempPath, op.oldPath).catch(e => log.error("Rollback failed:", e));
          }
          return { success: false, error: error.message, updatedMods: orderedMods };
      }
  });

  // --- IPC Handler for Renaming Mod ---
  ipcMain.handle('rename-mod-staging-directory', async (event, oldModPakPath: string, newModNameRaw: string) => {
      const stagingBasePath = getCurrentStagingPath();
      const oldModDirectoryPath = nodePath.dirname(oldModPakPath);
      if (!oldModDirectoryPath.startsWith(stagingBasePath)) {
          return { success: false, error: 'Old mod path is not within the staging directory.' };
      }
      const sanitizedNewModName = sanitizeDirectoryName(newModNameRaw);
      if (!sanitizedNewModName) {
          return { success: false, error: 'New mod name is invalid.' };
      }
      const newModDirectoryPath = nodePath.join(stagingBasePath, sanitizedNewModName);
      if (oldModDirectoryPath === newModDirectoryPath) {
          return { success: true, newModPath: oldModPakPath, newModName: sanitizedNewModName };
      }
      if (fs.existsSync(newModDirectoryPath)) {
          return { success: false, error: `A mod with the name "${sanitizedNewModName}" already exists.` };
      }
      try {
          await fsPromises.rename(oldModDirectoryPath, newModDirectoryPath);
          const newPakFilePath = nodePath.join(newModDirectoryPath, nodePath.basename(oldModPakPath));
          return { success: true, newModPath: newPakFilePath, newModName: sanitizedNewModName };
      } catch (error: any) {
          return { success: false, error: error.message };
      }
  });
  
  // --- IPC Handlers for Profiles & Generic File Ops ---
  ipcMain.handle('get-user-data-path', async () => ({ success: true, path: app.getPath('userData') }));

  ipcMain.handle('profiles-access', async (event, filePath: string) => {
      try {
          await fsPromises.access(filePath);
          return { success: true, exists: true };
      } catch (error: any) {
          return { success: true, exists: false };
      }
  });
  ipcMain.handle('profiles-mkdir', async (event, dirPath: string) => {
      try {
          await fsPromises.mkdir(dirPath, { recursive: true });
          return { success: true };
      } catch (error: any) {
          return { success: false, error: error.message };
      }
  });
  ipcMain.handle('profiles-read-file', async (event, filePath: string) => {
      try {
          const content = await fsPromises.readFile(filePath, 'utf-8');
          return { success: true, content };
      } catch (error: any) {
          return { success: false, error: error.message };
      }
  });
  ipcMain.handle('profiles-write-file', async (event, filePath: string, content: string) => {
      try {
          await fsPromises.writeFile(filePath, content, 'utf-8');
          return { success: true };
      } catch (error: any) {
          return { success: false, error: error.message };
      }
  });
  ipcMain.handle('show-save-dialog', async (event, options) => dialog.showSaveDialog(win!, options));
  ipcMain.handle('show-open-dialog', async (event, options) => dialog.showOpenDialog(win!, options));
  ipcMain.handle('read-file-content', async (event, filePath) => {
    try {
        const content = await fsPromises.readFile(filePath, 'utf-8');
        return { success: true, content };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
  });
  ipcMain.handle('write-file-content', async (event, filePath, content) => {
     try {
        await fsPromises.writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
  });

  // --- IPC Handlers for Theme ---
  ipcMain.handle('get-theme', async () => store.get('theme', 'system'));
  ipcMain.handle('set-theme', async (event, themeValue: 'light' | 'dark' | 'system') => {
      store.set('theme', themeValue);
      return { success: true, theme: themeValue };
  });

  // --- IPC Handler for Launching Game ---
  ipcMain.handle('launch-game', async () => {
      const gameFolderPath = store.get('gameFolderPath');
      if (!gameFolderPath) {
          return { success: false, error: 'Game installation path not configured.' };
      }
      const possibleExecutables = [
          'inZOI.exe', 'InZOI.exe', 'BlueClient/Binaries/Win64/InZOI.exe', 'BlueClient/Binaries/Win64/BlueClient.exe'
      ];
      const gameExecutablePath = possibleExecutables.map(p => nodePath.join(gameFolderPath, p)).find(p => fs.existsSync(p));

      if (!gameExecutablePath) {
          return { success: false, error: 'Game executable not found.' };
      }
      try {
          const { spawn } = require('child_process');
          const gameProcess = spawn(gameExecutablePath, ['BlueClient'], {
              detached: true,
              stdio: 'ignore',
              cwd: nodePath.dirname(gameExecutablePath)
          });
          gameProcess.unref();
          return { success: true, pid: gameProcess.pid };
      } catch (error: any) {
          return { success: false, error: error.message };
      }
  });

  ipcMain.handle('delete-mod', async (_event, mod: ModItem) => {
    log.info(`Received request to delete mod: ${mod.name} (${mod.id})`);
  
    if (mod.activePath && fs.existsSync(mod.activePath)) {
      log.info(`Mod is enabled. Disabling it first by removing: ${mod.activePath}`);
      try {
        await fs.promises.rm(mod.activePath, { recursive: true, force: true });
        log.info(`Successfully removed enabled mod directory: ${mod.activePath}`);
      } catch (err: any) {
        log.error(`Failed to remove enabled mod directory during delete: ${err.message}`);
        return { success: false, error: `Failed to disable the mod before deleting: ${err.message}` };
      }
    }
  
    try {
      const stagingPath = getStagingPath();
      const relativePath = nodePath.relative(stagingPath, mod.path);
  
      if (relativePath.startsWith('..') || nodePath.isAbsolute(relativePath)) {
        throw new Error('Mod path is outside the staging directory.');
      }
  
      const modDirName = relativePath.split(nodePath.sep)[0];
      const modStagingDir = nodePath.join(stagingPath, modDirName);
  
      if (!fs.existsSync(modStagingDir)) {
        log.warn(`Mod staging directory not found, assuming already deleted: ${modStagingDir}`);
        return { success: true };
      }
      
      log.info(`Deleting mod staging directory: ${modStagingDir}`);
      await fs.promises.rm(modStagingDir, { recursive: true, force: true });
      log.info(`Successfully deleted mod directory: ${modStagingDir}`);
      
      return { success: true };
    } catch (err: any) {
      log.error(`Error deleting mod from staging: ${err.message}`);
      return { success: false, error: `Failed to delete mod from staging area: ${err.message}` };
    }
  });

  ipcMain.handle(
    'get-mod-list',
    async (): Promise<{
      enabledMods: ModItem[];
      disabledMods: ModItem[];
    }> => {
      const stagingPath = getStagingPath();
      const enabledModConfigs = (store.get('enabledMods', []) as ModItem[]);
      const allStagedMods = await fsPromises.readdir(stagingPath, {
        withFileTypes: true,
      });

      const stagedModDirs = allStagedMods
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      const enabledModNames = new Set(
        enabledModConfigs.map((mod) =>
          mod.activePath
            ? nodePath.basename(mod.activePath).replace(/^\d+_/, '')
            : ''
        )
      );

      const disabledMods: ModItem[] = [];
      for (const dirName of stagedModDirs) {
        if (!enabledModNames.has(dirName)) {
          const modDir = nodePath.join(stagingPath, dirName);
          const paks = findPaksRecursive(modDir);
          if (paks.length > 0) {
            disabledMods.push({
              id: paks[0],
              name: dirName,
              path: paks[0],
            });
          }
        }
      }
      return { enabledMods: enabledModConfigs, disabledMods };
    }
  );

  ipcMain.handle('save-enabled-mods', (_event, enabledMods: ModItem[]) => {
    store.set('enabledMods', enabledMods);
  });
}
