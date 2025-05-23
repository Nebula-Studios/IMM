import { useState, useEffect, useCallback } from 'react';

export interface UseGameFolderPathReturn {
  gameFolderPath: string | null; // null se non impostato o non ancora caricato
  isLoading: boolean;
  showSetupModal: boolean; // Derivato da gameFolderPath e isLoading
  handleSetupComplete: () => void; // Chiamato dopo che il setup ha salvato il path
  handleDevClearFolder: () => Promise<void>;
  reloadPath: () => Promise<void>; // Funzione esplicita per ricaricare
}

export function useGameFolderPath(): UseGameFolderPathReturn {
  const [gameFolderPath, setGameFolderPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const _loadPath = useCallback(async () => {
    console.log('[useGameFolderPath_v2] _loadPath: Initiated.');
    setIsLoading(true);
    try {
      const storedPath = await window.electronAPI.getGameFolderPath();
      console.log(
        '[useGameFolderPath_v2] _loadPath: Path from IPC is:',
        storedPath
      );
      setGameFolderPath(storedPath || null); // Assicura null se undefined o stringa vuota
    } catch (error) {
      console.error(
        '[useGameFolderPath_v2] _loadPath: Error getting path from IPC:',
        error
      );
      setGameFolderPath(null); // In caso di errore, considera il path come non impostato
    } finally {
      setIsLoading(false);
      console.log(
        '[useGameFolderPath_v2] _loadPath: Finalizing. isLoading set to false.'
      );
    }
  }, []);

  // Caricamento iniziale
  useEffect(() => {
    console.log(
      '[useGameFolderPath_v2] Component did mount. Performing initial _loadPath.'
    );
    _loadPath();
  }, [_loadPath]);

  const handleSetupComplete = useCallback(() => {
    console.log(
      '[useGameFolderPath_v2] handleSetupComplete: Called. Reloading path...'
    );
    // Non c'è bisogno di await qui se non dobbiamo fare nulla dopo _loadPath specificamente in questa callback
    _loadPath();
  }, [_loadPath]);

  const handleDevClearFolder = useCallback(async () => {
    console.log(
      '[useGameFolderPath_v2] handleDevClearFolder: Attempting to clear game folder path via IPC.'
    );
    setIsLoading(true); // Visivamente indica che qualcosa sta accadendo
    try {
      await window.electronAPI.clearGameFolderPath();
      console.log(
        '[useGameFolderPath_v2] handleDevClearFolder: IPC clearGameFolderPath successful.'
      );
      setGameFolderPath(null); // Imposta direttamente il path a null
    } catch (error) {
      console.error(
        '[useGameFolderPath_v2] handleDevClearFolder: Error during IPC clear:',
        error
      );
      // Anche in caso di errore, tentiamo di resettare lo stato visivo
      setGameFolderPath(null);
    } finally {
      setIsLoading(false); // Fine operazione
      console.log(
        '[useGameFolderPath_v2] handleDevClearFolder: Operation finished.'
      );
    }
  }, []);

  // Valore derivato per showSetupModal
  const showSetupModal = gameFolderPath === null && !isLoading;

  // Log per quando showSetupModal cambierebbe valore (per debug)
  useEffect(() => {
    console.log(
      '[useGameFolderPath_v2] Derived state: showSetupModal is now:',
      showSetupModal,
      `(gameFolderPath: ${gameFolderPath}, isLoading: ${isLoading})`
    );
  }, [showSetupModal, gameFolderPath, isLoading]);

  return {
    gameFolderPath,
    isLoading,
    showSetupModal,
    handleSetupComplete,
    handleDevClearFolder,
    reloadPath: _loadPath, // Esponiamo _loadPath come reloadPath
  };
}
