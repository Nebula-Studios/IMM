/// <reference types="vite/client" />

// Define StagingPathConfig here if it's not globally available from another .d.ts file
// Questo tipo dovrebbe essere definito in un file .d.ts dedicato se usato globalmente
// o direttamente nel componente se specifico di esso.
export interface StagingPathConfig {
  path: string;
  name: string; // Aggiunto per coerenza con le attese di ModDropzone
}

// Commentata o rimossa la seguente dichiarazione globale se gestita da renderer.d.ts
/*
declare global {
  interface Window {
    electronAPI: {
      sendToMainLog: (level: string, message: string, ...args: unknown[]) => void;
      getFilePath: (file: File) => string;
      getGameFolderPath: () => Promise<string | undefined>;
      openFolderDialog: () => Promise<string | null>;
      saveGameFolderPath: (
        folderPath: string
      ) => Promise<{ success: boolean; path?: string; error?: string }>;
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
      openExternalLink: (url: string) => Promise<void>; // Aggiunto per coerenza con renderer.d.ts
      checkUpdate: () => Promise<any>; // Mantenuto per ora, da tipizzare meglio
      startDownload: () => Promise<any>; // Mantenuto per ora, da tipizzare meglio
      quitAndInstall: () => Promise<any>; // Mantenuto per ora, da tipizzare meglio
      ipcOn: (
        channel: string,
        listener: (event: any, ...args: any[]) => void
      ) => () => void;
      ipcOnce: (
        channel: string,
        listener: (event: any, ...args: any[]) => void
      ) => () => void;
      ipcRemoveAllListeners: (channel: string) => void;

      // --- Mod Enable/Disable Functions ---
      enableMod: (
        modPath: string,
        modName: string
      ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
      disableMod: (
        modName: string, // Assuming modName is sufficient to find it in the game's mod folder
        isVirtualMod?: boolean
      ) => Promise<{ success: boolean; error?: string }>;

      // --- Save/Load Mod Lists ---
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

      // --- Scan Staging Directory ---
      scanStagingDirectory: () => Promise<{
        success: boolean;
        mods?: ModItem[];
        error?: string;
      }>;
    };
  }
}
*/
