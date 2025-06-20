import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
import { ModItem } from '../../src/types/common.js';
import { ModItemForStore } from '../main/lib/mods.js';

// --------- Expose specific APIs to the Renderer process ---------
export const electronAPI = {
  // Logging function that sends to main process
  sendToMainLog: (level: string, message: string, ...args: unknown[]) =>
    ipcRenderer.send('log-from-renderer', level, message, ...args),

  // Store/config functions
  getGameFolderPath: (): Promise<string | undefined> =>
    ipcRenderer.invoke('get-game-folder-path'),
  openFolderDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('open-folder-dialog'),
  saveGameFolderPath: (
    folderPath: string
  ): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('save-game-folder-path', folderPath),
  // DEV ONLY: Function to clear the game folder path
  clearGameFolderPath: (): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> => ipcRenderer.invoke('clear-game-folder-path'),

  // Shell operations
  openExternalLink: (url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-external-link', url),

  // Update related IPC invocations
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  checkUpdateFromGitHub: () => ipcRenderer.invoke('check-update-from-github'),
  startDownload: () => ipcRenderer.invoke('start-download'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),

  // --- Mod Staging Path Functions ---
  getModStagingPathConfig: () =>
    ipcRenderer.invoke('get-mod-staging-path-config'),
  setModStagingPath: () => ipcRenderer.invoke('set-mod-staging-path'),
  clearModStagingPath: () => ipcRenderer.invoke('clear-mod-staging-path'),

  // --- Process Dropped Mods Functions ---
  // This must be called from the renderer for each file to preserve the object reference.
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  // This sends the sanitized paths to the main process.
  processDroppedModPaths: (filePaths: string[]) => {
    return ipcRenderer.invoke('process-dropped-mod-paths', filePaths);
  },

  // --- Mod Enable/Disable Functions ---
  enableMod: (
    modPath: string,
    modName: string
  ): Promise<{ success: boolean; activePath?: string; numericPrefix?: string; error?: string }> =>
    ipcRenderer.invoke('enable-mod', modPath, modName),
  disableMod: (
    modToDisable: ModItemForStore
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('disable-mod', modToDisable),

  // --- Save/Load Mod Lists ---
  loadModLists: (): Promise<{
    success: boolean;
    disabledMods?: ModItem[];
    enabledMods?: ModItem[];
    error?: string;
  }> => ipcRenderer.invoke('load-mod-lists'),
  saveModLists: (modLists: {
    disabledMods: ModItem[];
    enabledMods: ModItem[];
  }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-mod-lists', modLists),

  // --- Scan Staging Directory ---
  scanStagingDirectory: (): Promise<{
    success: boolean;
    mods?: ModItem[];
    error?: string;
  }> => ipcRenderer.invoke('scan-staging-directory'),

  // --- DEV ONLY: Get Current Staging Path ---
  getCurrentStagingPathDev: (): Promise<string> =>
    ipcRenderer.invoke('get-current-staging-path-dev'),

  // --- Synchronize Mod States ---
  syncModStates: () => ipcRenderer.invoke('sync-mod-states'),

  // --- Update Mod Order ---
  updateModOrder: (
    orderedMods: ModItem[]
  ): Promise<{ success: boolean; updatedMods: ModItem[]; error?: string }> =>
    ipcRenderer.invoke('update-mod-order', orderedMods),

  // --- Rename Mod Staging Directory ---
  renameModStagingDirectory: (
    oldModPakPath: string,
    newModNameRaw: string
  ): Promise<{
    success: boolean;
    newModPath?: string;
    newModName?: string;
    error?: string;
  }> => ipcRenderer.invoke('rename-mod-staging-directory', oldModPakPath, newModNameRaw),

  // --- Refresh Mod List ---
  refreshModList: (): Promise<{
    success: boolean;
    disabledMods?: ModItem[];
    enabledMods?: ModItem[];
    error?: string;
  }> => ipcRenderer.invoke('refresh-mod-list'),

  // --- Profile Management IPC ---
  getUserDataPath: (): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('get-user-data-path'),
  getProfilePaths: (): Promise<{
    success: boolean;
    paths?: { profilesDir: string; profilesFilePath: string };
    error?: string;
  }> => ipcRenderer.invoke('get-profile-paths'),
  profilesAccess: (
    filePath: string
  ): Promise<{ success: boolean; exists: boolean; error?: string }> =>
    ipcRenderer.invoke('profiles-access', filePath),
  profilesMkdir: (
    dirPath: string
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('profiles-mkdir', dirPath),
  profilesReadFile: (
    filePath: string
  ): Promise<{ success: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('profiles-read-file', filePath),
  profilesWriteFile: (
    filePath: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('profiles-write-file', filePath, content),
  // --- END Profile Management IPC ---

  // --- Generic File Operations (Import/Export Profiles) ---
  showSaveDialog: (options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> =>
    ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> =>
    ipcRenderer.invoke('show-open-dialog', options),
  readFileContent: (filePath: string): Promise<{ success: boolean; content?: string; error?: string; code?: string }> =>
    ipcRenderer.invoke('read-file-content', filePath),
  writeFileContent: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('write-file-content', filePath, content),
  // --- END Generic File Operations ---

  // Generic IPC for other cases if needed, though specific APIs are preferred
  ipcOn: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: any[]) => void
  ) => {
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  ipcOnce: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: any[]) => void
  ) => {
    ipcRenderer.once(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  ipcRemoveAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Theme functions
  getTheme: (): Promise<'light' | 'dark' | 'system'> =>
    ipcRenderer.invoke('get-theme'),
  setTheme: (
    themeValue: 'light' | 'dark' | 'system'
  ): Promise<{ success: boolean; theme?: 'light' | 'dark' | 'system'; error?: string }> =>
    ipcRenderer.invoke('set-theme', themeValue),

  // Game Launch function
  launchGame: (): Promise<{
    success: boolean;
    message?: string;
    pid?: number;
    error?: string;
  }> => ipcRenderer.invoke('launch-game'),

  onUpdateStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('update-status', (_event, status) => callback(status));
  },
  deleteMod: (mod: ModItem) => ipcRenderer.invoke('delete-mod', mod),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// --------- Preload scripts loading ---------
function domReady(
  condition: DocumentReadyState[] = ['complete', 'interactive']
) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((e) => e === child)) {
      return parent.appendChild(child);
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find((e) => e === child)) {
      return parent.removeChild(child);
    }
  },
};

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`;
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `;
  const oStyle = document.createElement('style');
  const oDiv = document.createElement('div');

  oStyle.id = 'app-loading-style';
  oStyle.innerHTML = styleContent;
  oDiv.className = 'app-loading-wrap';
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`;

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    },
  };
}

// ----------------------------------------------------------------------

// const { appendLoading, removeLoading } = useLoading();
// domReady().then(appendLoading);

// window.onmessage = (ev) => {
//   ev.data.payload === 'removeLoading' && removeLoading();
// };

// setTimeout(removeLoading, 4999);
