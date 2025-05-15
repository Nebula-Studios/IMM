/// <reference types="vite/client" />

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
  };
}
