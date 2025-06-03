import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Loader2 } from 'lucide-react';

interface GameFolderSetupProps {
  onSetupComplete: () => void;
}

type SetupStep = 'gameFolder' | 'stagingFolder' | 'completed';

const MODAL_OVERLAY_STYLE =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md';
const GLASS_CARD_STYLE =
  'p-8 bg-gradient-to-br from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-neutral-700/80 flex flex-col items-center text-center max-w-lg w-full mx-4 transition-all duration-300 hover:shadow-neutral-900/50';

const ELECTRON_API_ERROR =
  'electronAPI is not available. Setup cannot proceed.';

const GameFolderSetup: React.FC<GameFolderSetupProps> = ({
  onSetupComplete,
}) => {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<SetupStep>('gameFolder');
  const [gameFolderPath, setGameFolderPath] = useState<string | null>(null);

  const logInfo = (message: string, ...args: any[]) => {
    if (window.electronAPI?.sendToMainLog) {
      window.electronAPI.sendToMainLog('info', message, ...args);
    }
  };

  const logError = (message: string, ...args: any[]) => {
    if (window.electronAPI?.sendToMainLog) {
      window.electronAPI.sendToMainLog('error', message, ...args);
    }
  };

  const validateElectronAPI = (): boolean => {
    return Boolean(window.electronAPI?.sendToMainLog);
  };

  useEffect(() => {
    setIsInitializing(true);

    if (validateElectronAPI()) {
      logInfo('GameFolderSetup modal mounted, current step:', currentStep);
    } else {
      setErrorMessage(ELECTRON_API_ERROR);
      console.error(ELECTRON_API_ERROR);
    }

    setIsInitializing(false);
  }, []);

  const handleSelectGameFolder = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI is not available on window object.');
      }

      const selectedPath = await window.electronAPI.openFolderDialog();
      logInfo(
        '[GameFolderSetup] Folder dialog opened (game folder), result:',
        selectedPath
      );

      if (!selectedPath) {
        logInfo('[GameFolderSetup] Game folder selection canceled by user.');
        return;
      }

      logInfo('[GameFolderSetup] Game folder selected by user:', selectedPath);
      const saveResult =
        await window.electronAPI.saveGameFolderPath(selectedPath);

      if (saveResult.success && saveResult.path) {
        setGameFolderPath(saveResult.path);
        logInfo(
          '[GameFolderSetup] Game folder path saved successfully:',
          saveResult.path
        );
        setCurrentStep('stagingFolder');
      } else {
        const saveError =
          saveResult?.error || 'Failed to save game folder path.';
        setErrorMessage(saveError);
        logError(
          '[GameFolderSetup] Failed to save game folder path:',
          saveError
        );
      }
    } catch (err: any) {
      const error =
        err.message ||
        'An error occurred during game folder selection or saving.';
      setErrorMessage(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectStagingFolder = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI is not available on window object.');
      }

      const result = await window.electronAPI.setModStagingPath();
      logInfo('[GameFolderSetup] Staging folder dialog result:', result);

      if (result.success && result.path) {
        logInfo(
          '[GameFolderSetup] Custom staging folder path saved:',
          result.path
        );
        setCurrentStep('completed');
        onSetupComplete();
      } else if (
        result.error &&
        result.error !== 'Directory selection canceled.'
      ) {
        setErrorMessage(result.error || 'Failed to set custom staging folder.');
      } else {
        logInfo('[GameFolderSetup] Staging folder selection canceled by user.');
      }
    } catch (err: any) {
      const error =
        err.message ||
        'An error occurred during staging folder selection or saving.';
      setErrorMessage(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseDefaultStagingPath = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI is not available on window object.');
      }

      const result = await window.electronAPI.clearModStagingPath();
      logInfo('[GameFolderSetup] Clear custom staging path result:', result);

      if (result.success) {
        logInfo(
          '[GameFolderSetup] Custom staging path cleared (using default).'
        );
        setCurrentStep('completed');
        onSetupComplete();
      } else {
        setErrorMessage(
          result.error || 'Failed to reset to default staging path.'
        );
      }
    } catch (err: any) {
      const error =
        err.message ||
        'An error occurred while resetting to default staging path.';
      setErrorMessage(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderLoadingScreen = () => (
    <div className={MODAL_OVERLAY_STYLE}>
      <div className={GLASS_CARD_STYLE}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-4" />
        <p className="text-slate-300 text-lg">Initializing...</p>
      </div>
    </div>
  );

  if (isInitializing) {
    return renderLoadingScreen();
  }

  const renderGameFolderError = () => (
    <div className={MODAL_OVERLAY_STYLE}>
      <div className={GLASS_CARD_STYLE}>
        <h2 className="text-2xl font-semibold text-red-400 mb-4">
          Game Folder Setup Error
        </h2>
        <p className="text-slate-300 mb-6">{errorMessage}</p>
        <Button
          onClick={handleSelectGameFolder}
          disabled={isProcessing}
          variant="outline"
          color="danger"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Retrying...
            </>
          ) : (
            'Retry Game Folder Selection'
          )}
        </Button>
      </div>
    </div>
  );

  const renderGameFolderSetup = () => (
    <div className={MODAL_OVERLAY_STYLE}>
      <div className={GLASS_CARD_STYLE}>
        <h2 className="text-2xl font-semibold text-neutral-100 mb-3">
          Welcome to InZOI Mod Manager!
        </h2>
        <p className="text-neutral-400 mb-8 max-w-md">
          To get started, please select your main InZOI game installation
          folder. This step is only required once.
        </p>
        <Button
          onClick={handleSelectGameFolder}
          disabled={isProcessing}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg hover:shadow-blue-500/50 active:scale-95 transition-all duration-300"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Selecting Game
              Folder...
            </>
          ) : (
            'Select InZOI Game Folder'
          )}
        </Button>
      </div>
    </div>
  );

  if (currentStep === 'gameFolder') {
    return errorMessage ? renderGameFolderError() : renderGameFolderSetup();
  }

  const renderStagingFolderError = () => (
    <div className={MODAL_OVERLAY_STYLE}>
      <div className={GLASS_CARD_STYLE}>
        <h2 className="text-2xl font-semibold text-red-400 mb-4">
          Mod Staging Folder Setup Error
        </h2>
        <p className="text-slate-300 mb-6">{errorMessage}</p>
        <div className="flex space-x-4">
          <Button
            onClick={handleSelectStagingFolder}
            disabled={isProcessing}
            variant="outline"
            color="danger"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Retrying...
              </>
            ) : (
              'Retry Select Custom Folder'
            )}
          </Button>
          <Button
            onClick={handleUseDefaultStagingPath}
            disabled={isProcessing}
            variant="outline"
            size="lg"
          >
            Retry Use Default
          </Button>
        </div>
      </div>
    </div>
  );

  const renderStagingFolderSetup = () => (
    <div className={MODAL_OVERLAY_STYLE}>
      <div className={GLASS_CARD_STYLE}>
        <h2 className="text-2xl font-semibold text-neutral-100 mb-3">
          Mod Staging Directory Setup
        </h2>
        <p className="text-neutral-400 mb-6 max-w-md">
          Next, configure the directory where mod files will be temporarily
          stored (staged) before being enabled. You can choose a custom location
          or use the default path within the application's data folder.
        </p>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-center">
          <Button
            onClick={handleSelectStagingFolder}
            disabled={isProcessing}
            size="lg"
            className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-lg hover:shadow-green-500/50 active:scale-95 transition-all duration-300"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Selecting...
              </>
            ) : (
              'Select Custom Staging Folder'
            )}
          </Button>
          <Button
            onClick={handleUseDefaultStagingPath}
            disabled={isProcessing}
            variant="outline"
            size="lg"
            className="flex-1 border-neutral-600 bg-gradient-to-r from-neutral-800/80 to-neutral-700/80 hover:from-neutral-700/90 hover:to-neutral-600/90 hover:border-neutral-500 transition-all duration-300"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
              </>
            ) : (
              'Use Default Path'
            )}
          </Button>
        </div>
        <p className="text-xs text-neutral-500 mt-6 max-w-md">
          If you select a custom folder and later want to revert to the default,
          you can do so from the application settings.
        </p>
      </div>
    </div>
  );

  if (currentStep === 'stagingFolder') {
    return errorMessage
      ? renderStagingFolderError()
      : renderStagingFolderSetup();
  }

  return null;
};

export default GameFolderSetup;
