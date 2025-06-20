import type { StagedModInfo } from '@/components/mod-management/ModDropzone';
import { ModItem } from './types/common';

// Definizione temporanea se non esiste globalmente
interface StagingPathConfig {
  customPath: string | null;
  defaultPath: string;
  activePath: string;
}

export interface IElectronAPI {
  sendToMainLog: (level: string, message: string, ...args: unknown[]) => void;
  getFilePath: (file: File) => string;
  getGameFolderPath: () => Promise<string | undefined>;
  openFolderDialog: () => Promise<string | null>;
  saveGameFolderPath: (folderPath: string) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
  clearGameFolderPath: () => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  checkModEnablerStatus: () => Promise<{
    checked: boolean;
    dsoundExists?: boolean;
    bitfixFolderExists?: boolean;
    error?: string;
  }>;
  installModEnabler: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  openExternalLink: (url: string) => Promise<void>;
  checkUpdate: () => Promise<any>;
  checkUpdateFromGitHub: () => Promise<{
    success: boolean;
    hasUpdate?: boolean;
    currentVersion?: string;
    latestVersion?: string;
    releaseUrl?: string;
    error?: string;
  }>;
  startDownload: () => Promise<any>;
  quitAndInstall: () => Promise<any>;
  ipcOn: (
    channel: string,
    listener: (event: any, ...args: any[]) => void
  ) => () => void;
  ipcOnce: (
    channel: string,
    listener: (event: any, ...args: any[]) => void
  ) => () => void;
  ipcRemoveAllListeners: (channel: string) => void;
  enableMod: (
    modPath: string,
    modName: string
  ) => Promise<{
    success: boolean;
    activePath?: string;
    numericPrefix?: string;
    error?: string;
  }>;
  disableMod: (
    modToDisable: ModItem
  ) => Promise<{ success: boolean; error?: string }>;
  loadModLists: () => Promise<{
    success: boolean;
    disabledMods?: ModItem[];
    enabledMods?: ModItem[];
    error?: string;
  }>;
  saveModLists: (modLists: {
    disabledMods: ModItem[];
    enabledMods: ModItem[];
  }) => Promise<{ success: boolean; error?: string }>;
  scanStagingDirectory: () => Promise<{
    success: boolean;
    mods?: ModItem[];
    error?: string;
  }>;

  // --- Mod Staging Path Functions ---
  getModStagingPathConfig: () => Promise<StagingPathConfig>;
  setModStagingPath: () => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
  clearModStagingPath: () => Promise<{ success: boolean; error?: string }>;

  // --- DEV ONLY: Get Current Staging Path ---
  getCurrentStagingPathDev: () => Promise<string>;

  // --- Synchronize Mod States ---
  syncModStates: () => Promise<{
    success: boolean;
    disabledMods?: ModItem[];
    enabledMods?: ModItem[];
    error?: string;
  }>;

  // --- Process Dropped Mods Function ---
  processDroppedMods: (files: File[]) => Promise<{
    success: boolean;
    mods?: StagedModInfo[];
    error?: string;
  }>;

  // --- Update Mod Order ---
  updateModOrder: (
    orderedMods: ModItem[]
  ) => Promise<{ success: boolean; updatedMods: ModItem[]; error?: string }>;

  // --- Rename Mod Staging Directory ---
  renameModStagingDirectory: (
    oldModPakPath: string,
    newModNameRaw: string
  ) => Promise<{
    success: boolean;
    newModPath?: string;
    newModName?: string;
    error?: string;
  }>;
  refreshModList: () => Promise<{
    // Definizione per la nuova funzione di refresh
    success: boolean;
    disabledMods?: ModItem[];
    enabledMods?: ModItem[];
    error?: string;
  }>;

  // --- Profile Management IPC ---
  getUserDataPath: () => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
  getProfilePaths: () => Promise<{
    success: boolean;
    paths?: { profilesDir: string; profilesFilePath: string };
    error?: string;
  }>;
  profilesAccess: (
    filePath: string
  ) => Promise<{ success: boolean; exists: boolean; error?: string }>;
  profilesMkdir: (
    dirPath: string
  ) => Promise<{ success: boolean; error?: string }>;
  profilesReadFile: (
    filePath: string
  ) => Promise<{ success: boolean; content?: string; error?: string }>;
  profilesWriteFile: (
    filePath: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>;
  // --- END Profile Management IPC ---

  // --- Generic File Operations (Import/Export Profiles) ---
  showSaveDialog: (
    options: Electron.SaveDialogOptions
  ) => Promise<Electron.SaveDialogReturnValue>;
  showOpenDialog: (
    options: Electron.OpenDialogOptions
  ) => Promise<Electron.OpenDialogReturnValue>;
  readFileContent: (filePath: string) => Promise<{
    success: boolean;
    content?: string;
    error?: string;
    code?: string;
  }>;
  writeFileContent: (
    filePath: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>;
  // --- END Generic File Operations ---

  // Theme functions
  getTheme: () => Promise<'light' | 'dark' | 'system'>;
  setTheme: (themeValue: 'light' | 'dark' | 'system') => Promise<{
    success: boolean;
    theme?: 'light' | 'dark' | 'system';
    error?: string;
  }>;

  // Game Launch function
  launchGame: () => Promise<{
    success: boolean;
    message?: string;
    pid?: number;
    error?: string;
  }>;

  getAppVersion: () => Promise<string>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => void;
  deleteMod: (mod: ModItem) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
