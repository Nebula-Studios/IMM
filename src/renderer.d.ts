import type { ModItem } from '@/components/mod-management/ModCard';
import type { StagedModInfo } from '@/components/mod-management/ModDropzone';

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
  openExternalLink: (url: string) => Promise<void>;
  checkUpdate: () => Promise<any>;
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
  ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  disableMod: (
    modName: string,
    isVirtualMod?: boolean
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
  processDroppedMods: (filePaths: string[]) => Promise<{
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
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
