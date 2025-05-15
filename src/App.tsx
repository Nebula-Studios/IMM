import { useState, useEffect } from 'react';
// Importa direttamente i componenti del layout
import MenuBar from '@/components/layout/MenuBar.tsx';
import StatusBar from '@/components/layout/StatusBar.tsx';

import UpdateElectron from '@/components/update/index.tsx';
import GameFolderSetup from '@/components/GameFolderSetup.tsx';
// Rimuovi gli import di logo e App.css se non sono più usati direttamente qui o se gli stili sono globali
// import logoVite from './assets/logo-vite.svg';
// import logoElectron from './assets/logo-electron.svg';
import { Button } from '@/components/ui/button.tsx'; // Assicurati che sia importato

function App() {
  const [gameFolderPath, setGameFolderPath] = useState<
    string | null | undefined
  >(
    undefined // undefined: non ancora controllato, null: controllato e non impostato, string: impostato
  );
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

  useEffect(() => {
    const checkGameFolder = async () => {
      if (window.electronAPI) {
        try {
          window.electronAPI.sendToMainLog(
            'info',
            'App: Checking for game folder path on mount.'
          );
          const path = await window.electronAPI.getGameFolderPath();
          if (path) {
            setGameFolderPath(path);
            setShowSetupModal(false); // Assicura che il modale sia nascosto se il percorso esiste
            window.electronAPI.sendToMainLog(
              'info',
              `App: Game folder path found: ${path}`
            );
          } else {
            setGameFolderPath(null); // Path non trovato
            setShowSetupModal(true);
            window.electronAPI.sendToMainLog(
              'info',
              'App: No game folder path found, showing setup modal.'
            );
          }
        } catch (error) {
          console.error('App: Error checking game folder path:', error);
          window.electronAPI.sendToMainLog(
            'error',
            'App: Error checking game folder path:',
            error
          );
          setGameFolderPath(null);
          setShowSetupModal(true);
        }
      } else {
        console.error(
          'App: electronAPI not available when checking game folder.'
        );
        setGameFolderPath(null);
        setShowSetupModal(true);
      }
    };

    checkGameFolder();

    if (
      window.electronAPI &&
      typeof window.electronAPI.sendToMainLog === 'function'
    ) {
      window.electronAPI.sendToMainLog(
        'info',
        'App component mounted and initial checks started.'
      );
    }
  }, []);

  const handleSetupComplete = (path: string) => {
    setGameFolderPath(path);
    setShowSetupModal(false);
    if (window.electronAPI && window.electronAPI.sendToMainLog) {
      window.electronAPI.sendToMainLog(
        'info',
        `App: Game folder setup complete. Path: ${path}`
      );
    }
  };

  const handleDevClearFolder = async () => {
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
      alert('DEV: clearGameFolderPath API not available.');
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden text-slate-100 bg-neutral-600/60">
      <img
        src="/bg.jpg"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover top-0 left-0 blur-md -z-10"
      />
      <MenuBar />
      <main className="flex-grow overflow-y-auto p-6">
        {gameFolderPath && gameFolderPath !== undefined && (
          <div className="text-center p-4">
            <p className="text-lg">InZOI Mod Manager è pronto!</p>
            <p className="text-sm text-slate-400">
              Percorso InZOI: <code>{gameFolderPath}</code>
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDevClearFolder}
              className="mt-4"
            >
              DEV: Reset Cartella Gioco
            </Button>
          </div>
        )}

        {!gameFolderPath && gameFolderPath !== undefined && !showSetupModal && (
          <div className="text-center p-4">
            <p className="text-lg text-orange-400">
              La configurazione della cartella di gioco non è ancora stata
              completata.
            </p>
            <p className="text-sm text-slate-500">
              Attendi o riavvia l'applicazione se il problema persiste.
            </p>
          </div>
        )}

        <UpdateElectron />
      </main>
      <StatusBar />

      {showSetupModal && (
        <GameFolderSetup onSetupComplete={handleSetupComplete} />
      )}
    </div>
  );
}

export default App;
