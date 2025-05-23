import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Loader2 } from 'lucide-react';

interface GameFolderSetupProps {
  onSetupComplete: () => void;
}

type SetupStep = 'gameFolder' | 'stagingFolder' | 'completed';

const GameFolderSetup: React.FC<GameFolderSetupProps> = ({
  onSetupComplete,
}) => {
  const [isLoadingInitialCheck, setIsLoadingInitialCheck] =
    useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<SetupStep>('gameFolder');
  const [selectedGameFolderPath, setSelectedGameFolderPath] = useState<
    string | null
  >(null);

  useEffect(() => {
    setIsLoadingInitialCheck(true);
    if (window.electronAPI && window.electronAPI.sendToMainLog) {
      window.electronAPI.sendToMainLog(
        'info',
        'GameFolderSetup modal mounted, current step:',
        currentStep
      );
    } else {
      const errorMessage =
        'electronAPI is not available. Setup cannot proceed.';
      setError(errorMessage);
      console.error(errorMessage);
    }
    setIsLoadingInitialCheck(false);
  }, []);

  const handleSelectGameFolder = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const selectedPath = await window.electronAPI.openFolderDialog();
        window.electronAPI.sendToMainLog(
          'info',
          '[GameFolderSetup] Folder dialog opened (game folder), result:',
          selectedPath
        );
        if (selectedPath) {
          window.electronAPI.sendToMainLog(
            'info',
            '[GameFolderSetup] Game folder selected by user:',
            selectedPath
          );
          const saveResult =
            await window.electronAPI.saveGameFolderPath(selectedPath);
          if (saveResult.success && saveResult.path) {
            setError(null);
            setSelectedGameFolderPath(saveResult.path);
            window.electronAPI.sendToMainLog(
              'info',
              '[GameFolderSetup] Game folder path saved successfully:',
              saveResult.path
            );
            setCurrentStep('stagingFolder');
          } else {
            const saveError =
              saveResult?.error || 'Failed to save game folder path.';
            setError(saveError);
            window.electronAPI.sendToMainLog(
              'error',
              '[GameFolderSetup] Failed to save game folder path:',
              saveError
            );
          }
        } else {
          window.electronAPI.sendToMainLog(
            'info',
            '[GameFolderSetup] Game folder selection canceled by user.'
          );
        }
      } else {
        throw new Error('electronAPI is not available on window object.');
      }
    } catch (err: any) {
      const errorMessage =
        err.message ||
        'An error occurred during game folder selection or saving.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectStagingFolder = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.setModStagingPath();
        window.electronAPI.sendToMainLog(
          'info',
          '[GameFolderSetup] Staging folder dialog result:',
          result
        );
        if (result.success && result.path) {
          setError(null);
          window.electronAPI.sendToMainLog(
            'info',
            '[GameFolderSetup] Custom staging folder path saved:',
            result.path
          );
          setCurrentStep('completed');
          onSetupComplete();
        } else if (
          result.error &&
          result.error !== 'Directory selection canceled.'
        ) {
          setError(result.error || 'Failed to set custom staging folder.');
        } else {
          window.electronAPI.sendToMainLog(
            'info',
            '[GameFolderSetup] Staging folder selection canceled by user.'
          );
        }
      } else {
        throw new Error('electronAPI is not available on window object.');
      }
    } catch (err: any) {
      const errorMessage =
        err.message ||
        'An error occurred during staging folder selection or saving.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseDefaultStagingPath = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.clearModStagingPath();
        window.electronAPI.sendToMainLog(
          'info',
          '[GameFolderSetup] Clear custom staging path result:',
          result
        );
        if (result.success) {
          setError(null);
          window.electronAPI.sendToMainLog(
            'info',
            '[GameFolderSetup] Custom staging path cleared (using default).'
          );
          setCurrentStep('completed');
          onSetupComplete();
        } else {
          setError(result.error || 'Failed to reset to default staging path.');
        }
      } else {
        throw new Error('electronAPI is not available on window object.');
      }
    } catch (err: any) {
      const errorMessage =
        err.message ||
        'An error occurred while resetting to default staging path.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const modalOverlayStyle =
    'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm';
  const glassCardStyle =
    'p-8 bg-neutral-800/60 backdrop-blur-lg rounded-xl shadow-2xl border border-neutral-700 flex flex-col items-center text-center max-w-lg w-full mx-4';

  if (isLoadingInitialCheck) {
    return (
      <div className={modalOverlayStyle}>
        <div className={glassCardStyle}>
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-4" />
          <p className="text-slate-300 text-lg">Initializing...</p>
        </div>
      </div>
    );
  }

  if (currentStep === 'gameFolder') {
    if (error) {
      return (
        <div className={modalOverlayStyle}>
          <div className={glassCardStyle}>
            <h2 className="text-2xl font-semibold text-red-400 mb-4">
              Game Folder Setup Error
            </h2>
            <p className="text-slate-300 mb-6">{error}</p>
            <Button
              onClick={handleSelectGameFolder}
              disabled={isProcessing}
              variant="destructive"
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
    }
    return (
      <div className={modalOverlayStyle}>
        <div className={glassCardStyle}>
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
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/50 transform transition-all duration-150"
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
  }

  if (currentStep === 'stagingFolder') {
    if (error) {
      return (
        <div className={modalOverlayStyle}>
          <div className={glassCardStyle}>
            <h2 className="text-2xl font-semibold text-red-400 mb-4">
              Mod Staging Folder Setup Error
            </h2>
            <p className="text-slate-300 mb-6">{error}</p>
            <div className="flex space-x-4">
              <Button
                onClick={handleSelectStagingFolder}
                disabled={isProcessing}
                variant="destructive"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                    Retrying...
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
    }
    return (
      <div className={modalOverlayStyle}>
        <div className={glassCardStyle}>
          <h2 className="text-2xl font-semibold text-neutral-100 mb-3">
            Mod Staging Directory Setup
          </h2>
          <p className="text-neutral-400 mb-6 max-w-md">
            Next, configure the directory where mod files will be temporarily
            stored (staged) before being enabled. You can choose a custom
            location or use the default path within the application's data
            folder.
          </p>
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-center">
            <Button
              onClick={handleSelectStagingFolder}
              disabled={isProcessing}
              size="lg"
              className="flex-1 bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/50 transform transition-all duration-150"
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
              className="flex-1 border-neutral-500 hover:bg-neutral-700 hover:border-neutral-400"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                  Processing...
                </>
              ) : (
                'Use Default Path'
              )}
            </Button>
          </div>
          <p className="text-xs text-neutral-500 mt-6 max-w-md">
            If you select a custom folder and later want to revert to the
            default, you can do so from the application settings.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default GameFolderSetup;
