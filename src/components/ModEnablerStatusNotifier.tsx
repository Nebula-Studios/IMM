'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog.tsx';
import { Loader2 } from 'lucide-react';

interface ModEnablerStatusNotifierProps {
  gameFolderPath: string | null | undefined;
}

interface ModEnablerStatus {
  checked: boolean;
  dsoundExists?: boolean;
  bitfixFolderExists?: boolean;
  error?: string;
}

interface InstallResult {
  success: boolean;
  error?: string;
}

const MISSING_FILES_ERRORS = {
  BOTH: 'Both dsound.dll and the bitfix folder are missing.',
  DSOUND_ONLY: 'The dsound.dll file is missing.',
  BITFIX_ONLY: 'The bitfix folder is missing or incomplete.',
} as const;

export function ModEnablerStatusNotifier({
  gameFolderPath,
}: ModEnablerStatusNotifierProps) {
  const [isLoadingCheck, setIsLoadingCheck] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [hasStatusBeenChecked, setHasStatusBeenChecked] =
    useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getErrorMessage = (status: ModEnablerStatus): string => {
    if (!status.dsoundExists && !status.bitfixFolderExists) {
      return MISSING_FILES_ERRORS.BOTH;
    }
    if (!status.dsoundExists) {
      return MISSING_FILES_ERRORS.DSOUND_ONLY;
    }
    return MISSING_FILES_ERRORS.BITFIX_ONLY;
  };

  const resetState = () => {
    setHasStatusBeenChecked(false);
    setShowInstallModal(false);
    setIsLoadingCheck(false);
    setIsInstalling(false);
  };

  const handleSuccessfulCheck = (
    status: ModEnablerStatus,
    isRetry: boolean
  ) => {
    if (status.dsoundExists && status.bitfixFolderExists) {
      setShowInstallModal(false);
      if (isRetry) {
        toast.success('Mod Enabler Installed!', {
          description: 'The InZOI Mod Enabler is now active.',
        });
      }
    } else {
      setErrorMessage(getErrorMessage(status));
      setShowInstallModal(true);
    }
  };

  const checkStatus = useCallback(async (isRetry: boolean = false) => {
    if (isRetry) {
      setIsInstalling(true);
    }

    setErrorMessage(null);

    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI is not available on window object.');
      }

      const currentStoredGameFolderPath =
        await window.electronAPI.getGameFolderPath();
      if (!currentStoredGameFolderPath) {
        console.warn(
          '[ModEnabler] checkStatus called but game folder path from store is now null/undefined.'
        );
        resetState();
        return;
      }

      const logMessage = isRetry
        ? '[ModEnabler] Re-checking Mod Enabler status after install attempt...'
        : '[ModEnabler] Performing Mod Enabler check...';
      console.info(logMessage);

      const status: ModEnablerStatus =
        await window.electronAPI.checkModEnablerStatus();
      console.info('[ModEnabler] Mod Enabler Status:', status);

      if (status?.checked) {
        setHasStatusBeenChecked(true);
        handleSuccessfulCheck(status, isRetry);
      } else if (status && !status.checked && status.error) {
        setHasStatusBeenChecked(true);
        setErrorMessage(
          status.error || 'Could not complete Mod Enabler verification.'
        );
        setShowInstallModal(true);
      } else {
        throw new Error('Invalid Mod Enabler status received from IPC.');
      }
    } catch (error: any) {
      console.error('[ModEnabler] Failed to check Mod Enabler status:', error);
      const errorMsg = `Could not verify Mod Enabler status: ${error?.message || 'Unknown error'}`;
      setErrorMessage(errorMsg);
      toast.error('Critical Mod Enabler Check Error', {
        description: errorMsg,
      });
    } finally {
      setIsInstalling(false);
    }
  }, []);

  useEffect(() => {
    if (gameFolderPath && !hasStatusBeenChecked) {
      console.log(
        '[ModEnabler] useEffect: gameFolderPath valid and status not checked. Initializing check.'
      );
      setIsLoadingCheck(true);

      const timerId = setTimeout(() => {
        checkStatus(false).finally(() => {
          setIsLoadingCheck(false);
        });
      }, 50);

      return () => clearTimeout(timerId);
    } else if (!gameFolderPath) {
      console.log(
        '[ModEnabler] useEffect: gameFolderPath is null/undefined. Resetting state.'
      );
      setHasStatusBeenChecked(false);
      setShowInstallModal(false);
      setErrorMessage(null);
      setIsLoadingCheck(false);
    } else if (gameFolderPath && hasStatusBeenChecked) {
      console.log(
        '[ModEnabler] useEffect: gameFolderPath valid and status already checked. No action.'
      );
      setIsLoadingCheck(false);
    }
  }, [gameFolderPath, hasStatusBeenChecked, checkStatus]);

  const handleInstallModEnabler = async () => {
    setIsInstalling(true);
    setErrorMessage(null);

    try {
      if (!window.electronAPI?.installModEnabler) {
        throw new Error('installModEnabler API is not available.');
      }

      const result: InstallResult =
        await window.electronAPI.installModEnabler();

      if (result.success) {
        await checkStatus(true);
      } else {
        setErrorMessage(
          result.error || 'An unknown error occurred during installation.'
        );
      }
    } catch (error: any) {
      console.error('[ModEnabler] Error installing Mod Enabler:', error);
      setErrorMessage(
        `Installation failed: ${error?.message || 'Unknown error'}`
      );
    } finally {
      setIsInstalling(false);
    }
  };

  if (isLoadingCheck && !showInstallModal) {
    // Mostra loader solo se il modale non è già visibile
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-neutral-900/90 backdrop-blur-sm">
        <Loader2 className="h-12 w-12 animate-spin text-blue-400 mb-6" />
        <p className="text-slate-200 text-xl font-medium">
          Verifying InZOI Mod Support...
        </p>
        <p className="text-slate-400 text-sm">Please wait a moment.</p>
      </div>
    );
  }

  const renderInstallModal = () => (
    <Dialog
      open={showInstallModal}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
          setShowInstallModal(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md bg-neutral-850 border-neutral-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-2xl text-orange-400">
            Mod Support Required
          </DialogTitle>
          <DialogDescription className="text-neutral-400 pt-2">
            The InZOI Mod Enabler is necessary to use mods with the game. It
            appears to be missing or not correctly installed in your game
            folder.
            {errorMessage && (
              <p className="text-red-400 mt-2">Details: {errorMessage}</p>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-neutral-300">
            Click the button below to automatically install the Mod Enabler
            files (dsound.dll and the 'bitfix' folder) into the correct game
            directory.
          </p>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={handleInstallModEnabler}
            disabled={isInstalling}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white"
          >
            {isInstalling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Installing...
              </>
            ) : (
              'Install Mod Enabler'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowInstallModal(false)}
            disabled={isInstalling}
            className="w-full sm:w-auto mt-2 sm:mt-0 border-neutral-600 hover:bg-neutral-700"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (showInstallModal) {
    return renderInstallModal();
  }

  return null;
}
