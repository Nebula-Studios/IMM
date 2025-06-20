'use client';

import React, { useRef, useCallback } from 'react';
import GameFolderSetup from '@/components/GameFolderSetup.tsx';
import ModManagerLayout from './ModManagerLayout.tsx';
import MenuBar from '@/components/layout/MenuBar.tsx';
import SettingsDialog from '@/components/settings/SettingsDialog.tsx';
import StatusBar from '@/components/layout/StatusBar.tsx';
import { toast } from 'sonner';

interface AppContentProps {
  hookGameFolderPath: string | null;
  hookShowSetupModal: boolean;
  hookIsLoading: boolean;
  onHookHandleSetupComplete: () => void;
  onHookHandleDevClearFolder: () => Promise<void>;
  onHookReloadPath: () => Promise<void>;
  showSettingsPage: boolean;
  onToggleSettingsPage: () => void;
}

type RefreshModListFunction = () => Promise<void>;

export default function AppContent({
  hookGameFolderPath: gameFolderPath,
  hookShowSetupModal: showSetupModal,
  hookIsLoading: isLoading,
  onHookHandleSetupComplete,
  onHookHandleDevClearFolder,
  onHookReloadPath,
  showSettingsPage,
  onToggleSettingsPage,
}: AppContentProps) {
  const refreshModListFnRef = useRef<RefreshModListFunction | null>(null);

  const exposeRefreshFunctionFromLayout = useCallback(
    (refreshFn: RefreshModListFunction) => {
      refreshModListFnRef.current = refreshFn;
    },
    []
  );

  const handleRefreshFromMenu = useCallback(async () => {
    if (refreshModListFnRef.current) {
      try {
        await refreshModListFnRef.current();
      } catch (error) {
        console.error('[AppContent] Error calling refresh function:', error);
        toast.error('An unexpected error occurred while trying to refresh.');
      }
    } else {
      toast.info(
        'Refresh functionality is not ready yet. Please wait a moment.'
      );
    }
  }, []);

  const handleLaunchGame = useCallback(async () => {
    if (!gameFolderPath) {
      toast.error('Game folder path not configured. Please set it up first.');
      return;
    }

    try {
      toast.loading('Launching InZOI...', { id: 'game-launch' });

      const result = await window.electronAPI.launchGame();

      if (result.success) {
        toast.success('InZOI launched successfully!', {
          id: 'game-launch',
          duration: 3000,
        });
      } else {
        toast.error(result.error || 'Failed to launch InZOI', {
          id: 'game-launch',
        });
      }
    } catch (error: any) {
      toast.error(`Error launching game: ${error.message}`, {
        id: 'game-launch',
      });
    }
  }, [gameFolderPath]);

  const renderLoadingScreen = () => (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-xl text-slate-300">Loading application data...</div>
      <p className="text-sm text-slate-500">
        Checking game folder configuration.
      </p>
    </div>
  );

  const renderMainContent = () => (
    <>
      <ModManagerLayout
        exposeRefreshFunction={exposeRefreshFunctionFromLayout}
      />
    </>
  );

  const menuBarGamePath = isLoading ? null : gameFolderPath;

  return (
    <div className="flex flex-col h-full">
      <MenuBar
        gameFolderPath={menuBarGamePath}
        onDevClearFolder={onHookHandleDevClearFolder}
        onSettingsClick={onToggleSettingsPage}
        onRefreshMods={handleRefreshFromMenu}
        onLaunchGame={handleLaunchGame}
      />

      <div className="flex-grow overflow-hidden min-h-0">
        {isLoading ? (
          renderLoadingScreen()
        ) : showSetupModal ? (
          <GameFolderSetup onSetupComplete={onHookHandleSetupComplete} />
        ) : (
          renderMainContent()
        )}
      </div>

      <SettingsDialog
        isOpen={showSettingsPage}
        onOpenChange={(isOpen) => !isOpen && onToggleSettingsPage()}
      />
      <StatusBar />
    </div>
  );
}
