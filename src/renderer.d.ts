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
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
