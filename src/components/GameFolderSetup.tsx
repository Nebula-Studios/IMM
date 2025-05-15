import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Loader2 } from 'lucide-react';

interface GameFolderSetupProps {
  onSetupComplete: (path: string) => void;
}

const GameFolderSetup: React.FC<GameFolderSetupProps> = ({
  onSetupComplete,
}) => {
  const [isLoadingInitialCheck, setIsLoadingInitialCheck] =
    useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingInitialCheck(true);
    if (window.electronAPI && window.electronAPI.sendToMainLog) {
      window.electronAPI.sendToMainLog(
        'info',
        'GameFolderSetup modal mounted.'
      );
    } else {
      const errorMessage =
        'electronAPI is not available. Setup cannot proceed.';
      setError(errorMessage);
      console.error(errorMessage);
    }
    setIsLoadingInitialCheck(false);
  }, []);

  const handleSelectFolder = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.openFolderDialog();
        window.electronAPI.sendToMainLog(
          'info',
          'Folder dialog opened (from modal), result:',
          result
        );
        if (result) {
          window.electronAPI.sendToMainLog(
            'info',
            'Folder selected by user (from modal):',
            result
          );
          const saveResult =
            await window.electronAPI.saveGameFolderPath(result);
          if (saveResult.success && saveResult.path) {
            setError(null);
            window.electronAPI.sendToMainLog(
              'info',
              'Game folder path saved successfully (from modal):',
              saveResult.path
            );
            onSetupComplete(saveResult.path);
          } else {
            const saveError =
              saveResult?.error || 'Failed to save folder path.';
            setError(saveError);
            window.electronAPI.sendToMainLog(
              'error',
              'Failed to save game folder path (from modal):',
              saveError
            );
          }
        } else {
          window.electronAPI.sendToMainLog(
            'info',
            'Folder selection canceled by user (from modal).'
          );
        }
      } else {
        throw new Error('electronAPI is not available on window object.');
      }
    } catch (err: any) {
      const errorMessage =
        err.message || 'An error occurred during folder selection or saving.';
      setError(errorMessage);
      if (window.electronAPI && window.electronAPI.sendToMainLog) {
        window.electronAPI.sendToMainLog(
          'error',
          'Error in handleSelectFolder (modal):',
          errorMessage,
          err
        );
      } else {
        console.error(
          'Error in handleSelectFolder (modal, electronAPI not available):',
          errorMessage,
          err
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const modalOverlayStyle =
    'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm';
  const glassCardStyle =
    'p-8 bg-slate-800/60 backdrop-blur-lg rounded-xl shadow-2xl border border-slate-700/50 flex flex-col items-center text-center max-w-lg w-full mx-4';

  if (isLoadingInitialCheck) {
    return (
      <div className={modalOverlayStyle}>
        <div className={glassCardStyle}>
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-4" />
          <p className="text-slate-300 text-lg">Inizializzazione...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={modalOverlayStyle}>
        <div className={glassCardStyle}>
          <h2 className="text-2xl font-semibold text-red-400 mb-4">
            Errore di Configurazione Iniziale
          </h2>
          <p className="text-slate-300 mb-6">{error}</p>
          <Button
            onClick={handleSelectFolder}
            disabled={isProcessing}
            variant="destructive"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Attendere...
              </>
            ) : (
              'Riprova Selezione Cartella'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={modalOverlayStyle}>
      <div className={glassCardStyle}>
        <h2 className="text-2xl font-semibold text-slate-100 mb-3">
          Benvenuto in InZOI Mod Manager!
        </h2>
        <p className="text-slate-400 mb-8 max-w-md">
          Per iniziare, seleziona la cartella principale di installazione del
          gioco InZOI. Questo passaggio è necessario solo la prima volta.
        </p>
        <Button
          onClick={handleSelectFolder}
          disabled={isProcessing}
          size="lg"
          className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/50 transform transition-transform duration-150 hover:scale-105"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Selezione in
              corso...
            </>
          ) : (
            'Seleziona Cartella InZOI'
          )}
        </Button>
      </div>
    </div>
  );
};

export default GameFolderSetup;
