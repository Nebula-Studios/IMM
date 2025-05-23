/// <reference types="vite/client" />

// Define StagingPathConfig here if it's not globally available from another .d.ts file
// If it IS defined elsewhere globally (e.g. in a types/ folder included in tsconfig),
// then this specific definition might be redundant or could be imported.
interface StagingPathConfig {
  customPath: string | null;
  defaultPath: string;
  activePath: string;
}

interface Window {
  // // expose in the `electron/preload/index.ts`
  // ipcRenderer: import('electron').IpcRenderer;
  // // expose electron-log functions
  // log: {
  //   info: (...params: unknown[]) => void;
  //   warn: (...params: unknown[]) => void;
  //   error: (...params: unknown[]) => void;
  //   debug: (...params: unknown[]) => void;
  //   verbose: (...params: unknown[]) => void;
  // };
  electronAPI: {
    // Logging function that sends to main process
    sendToMainLog: (level: string, message: string, ...args: unknown[]) => void;

    // Store/config functions
    getGameFolderPath: () => Promise<string | undefined>;
    openFolderDialog: () => Promise<string | null>;
    saveGameFolderPath: (
      folderPath: string
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    // DEV ONLY: Function to clear the game folder path
    clearGameFolderPath: () => Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }>;

    // Mod Enabler Status
    checkModEnablerStatus: () => Promise<{
      checked: boolean;
      dsoundExists?: boolean;
      bitfixFolderExists?: boolean;
      error?: string;
    }>;

    // Shell operations
    openExternalLink: (
      url: string
    ) => Promise<{ success: boolean; error?: string }>;

    // Update related IPC invocations
    checkUpdate: () => Promise<any>; // Consider defining a more specific return type if known
    startDownload: () => Promise<void>; // Or a more specific type if it returns something
    quitAndInstall: () => Promise<void>; // Or a more specific type

    // Generic IPC
    ipcOn: (
      channel: string,
      listener: (
        event: import('electron').IpcRendererEvent,
        ...args: any[]
      ) => void
    ) => () => void; // Returns an unsubscribe function
    ipcOnce: (
      channel: string,
      listener: (
        event: import('electron').IpcRendererEvent,
        ...args: any[]
      ) => void
    ) => () => void; // Returns an unsubscribe function
    ipcRemoveAllListeners: (channel: string) => void;

    // Added for Mod Staging Path settings
    getModStagingPathConfig: () => Promise<StagingPathConfig>;
    setModStagingPath: () => Promise<{
      success: boolean;
      path?: string;
      error?: string;
    }>;
    clearModStagingPath: () => Promise<{ success: boolean; error?: string }>;

    // Added for processing dropped mods (assuming it's exposed via preload)
    processDroppedMods: (filePaths: string[]) => Promise<{
      success: boolean;
      mods?: Array<{
        name: string;
        pakPath: string;
        ucasPath: string | null;
        utocPath: string | null;
        originalPath: string;
      }>;
      error?: string;
    }>;

    // Funzione aggiunta per installare il Mod Enabler
    installModEnabler: () => Promise<{ success: boolean; error?: string }>;
  };
}
