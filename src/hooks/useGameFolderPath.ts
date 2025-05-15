import { useState, useEffect, useCallback } from 'react';

export function useGameFolderPath() {
  const [gameFolderPath, setGameFolderPath] = useState<
    string | null | undefined
  >(
    undefined // undefined: non ancora controllato, null: controllato e non impostato, string: impostato
  );
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

  const checkGameFolder = useCallback(async () => {
    if (window.electronAPI) {
      try {
        window.electronAPI.sendToMainLog(
          'info',
          'useGameFolderPath: Checking for game folder path on mount.'
        );
        const path = await window.electronAPI.getGameFolderPath();
        if (path) {
          setGameFolderPath(path);
          setShowSetupModal(false); // Assicura che il modale sia nascosto se il percorso esiste
          window.electronAPI.sendToMainLog(
            'info',
            `useGameFolderPath: Game folder path found: ${path}`
          );
        } else {
          setGameFolderPath(null); // Path non trovato
          setShowSetupModal(true);
          window.electronAPI.sendToMainLog(
            'info',
            'useGameFolderPath: No game folder path found, showing setup modal.'
          );
        }
      } catch (error) {
        console.error(
          'useGameFolderPath: Error checking game folder path:',
          error
        );
        window.electronAPI.sendToMainLog(
          'error',
          'useGameFolderPath: Error checking game folder path:',
          error
        );
        setGameFolderPath(null);
        setShowSetupModal(true);
      }
    } else {
      console.error(
        'useGameFolderPath: electronAPI not available when checking game folder.'
      );
      // In un contesto di hook, potremmo voler propagare questo errore o gestirlo diversamente
      // Per ora, replichiamo il comportamento di App.tsx
      setGameFolderPath(null);
      setShowSetupModal(true);
    }
  }, []);

  useEffect(() => {
    checkGameFolder();

    if (
      window.electronAPI &&
      typeof window.electronAPI.sendToMainLog === 'function'
    ) {
      window.electronAPI.sendToMainLog(
        'info',
        'useGameFolderPath: Hook mounted and initial checks started.'
      );
    }
  }, [checkGameFolder]);

  const handleSetupComplete = useCallback((path: string) => {
    setGameFolderPath(path);
    setShowSetupModal(false);
    if (window.electronAPI && window.electronAPI.sendToMainLog) {
      window.electronAPI.sendToMainLog(
        'info',
        `useGameFolderPath: Game folder setup complete. Path: ${path}`
      );
    }
  }, []);

  const handleDevClearFolder = useCallback(async () => {
    if (window.electronAPI && window.electronAPI.clearGameFolderPath) {
      try {
        const result = await window.electronAPI.clearGameFolderPath();
        if (result.success) {
          window.electronAPI.sendToMainLog(
            'info',
            'DEV: Game folder path cleared successfully. Reloading app state.'
          );
          // Forza il re-check per mostrare il modale di setup
          setGameFolderPath(undefined); // Resetta lo stato per far scattare useEffect
          setShowSetupModal(true); // Mostra direttamente il modale per reattività
          // Potrebbe essere utile richiamare checkGameFolder() qui se il reset a undefined
          // non è sufficiente a far ripartire il check desiderato in alcuni casi limite.
          // await checkGameFolder(); // Opzionale, per forzare il refresh dello stato dopo il clear
        } else {
          window.electronAPI.sendToMainLog(
            'error',
            'DEV: Failed to clear game folder path:',
            result.error
          );
          alert(`Error clearing folder: ${result.error}`);
        }
      } catch (error: any) {
        window.electronAPI.sendToMainLog(
          'error',
          'DEV: Exception while clearing game folder path:',
          error.message
        );
        alert(`Exception clearing folder: ${error.message}`);
      }
    } else {
      alert('DEV: clearGameFolderPath API is not available.');
    }
  }, []); // checkGameFolder non è una dipendenza qui, perché handleDevClearFolder non lo usa direttamente per il suo output principale

  return {
    gameFolderPath,
    showSetupModal,
    handleSetupComplete,
    handleDevClearFolder,
    isLoading: gameFolderPath === undefined, // Aggiungiamo uno stato di caricamento
  };
}
