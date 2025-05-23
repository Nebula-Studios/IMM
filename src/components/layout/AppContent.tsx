/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React from 'react';
import GameFolderSetup from '@/components/GameFolderSetup.tsx';
import { ModEnablerStatusNotifier } from '@/components/ModEnablerStatusNotifier.tsx';
import ModManagerLayout from './ModManagerLayout.tsx';
import MenuBar from '@/components/layout/MenuBar.tsx';
import SettingsPage from '@/components/settings/SettingsPage.tsx';

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

export default function AppContent({
  hookGameFolderPath,
  hookShowSetupModal,
  hookIsLoading,
  onHookHandleSetupComplete,
  onHookHandleDevClearFolder,
  onHookReloadPath,
  showSettingsPage,
  onToggleSettingsPage,
}: AppContentProps) {
  const gameFolderPath = hookGameFolderPath;
  const showSetupModal = hookShowSetupModal;
  const isLoading = hookIsLoading;

  console.log(
    '[AppContent.tsx] Props: gameFolderPath:',
    gameFolderPath,
    ', showSetupModal:',
    showSetupModal,
    ', isLoading:',
    isLoading,
    ', showSettingsPage:',
    showSettingsPage
  );

  const menuBarGamePath = isLoading ? null : gameFolderPath;

  return (
    <div>
      <MenuBar
        gameFolderPath={menuBarGamePath}
        onDevClearFolder={onHookHandleDevClearFolder}
        onSettingsClick={onToggleSettingsPage}
      />
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[calc(100%-theme(space.14)-theme(space.8))]">
          <div className="text-xl text-slate-300">
            Loading application data...
          </div>
          <p className="text-sm text-slate-500">
            Checking game folder configuration.
          </p>
        </div>
      ) : showSettingsPage ? (
        <SettingsPage onClose={() => onToggleSettingsPage()} />
      ) : showSetupModal ? (
        <GameFolderSetup onSetupComplete={onHookHandleSetupComplete} />
      ) : (
        <>
          {gameFolderPath && (
            <ModEnablerStatusNotifier gameFolderPath={gameFolderPath} />
          )}
          <ModManagerLayout />
        </>
      )}
    </div>
  );
}
