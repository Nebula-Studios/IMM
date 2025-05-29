/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useRef, useCallback } from 'react';
import GameFolderSetup from '@/components/GameFolderSetup.tsx';
import { ModEnablerStatusNotifier } from '@/components/ModEnablerStatusNotifier.tsx';
import ModManagerLayout from './ModManagerLayout.tsx';
import MenuBar from '@/components/layout/MenuBar.tsx';
import SettingsPage from '@/components/settings/SettingsPage.tsx';
import StatusBar from '@/components/layout/StatusBar.tsx'; // Importa StatusBar
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
  onTriggerUpdateCheck: () => void; // Aggiunta la nuova prop
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
  onTriggerUpdateCheck, // Ricevi la nuova prop
}: AppContentProps) {
  const gameFolderPath = hookGameFolderPath;
  const showSetupModal = hookShowSetupModal;
  const isLoading = hookIsLoading;

  const refreshModListFnRef = useRef<(() => Promise<void>) | null>(null);

  const exposeRefreshFunctionFromLayout = useCallback(
    (refreshFn: () => Promise<void>) => {
      console.log(
        '[AppContent] Received refresh function from ModManagerLayout'
      );
      refreshModListFnRef.current = refreshFn;
    },
    []
  );

  const handleRefreshFromMenu = useCallback(async () => {
    console.log('[AppContent] Refresh mods requested via MenuBar');
    if (refreshModListFnRef.current) {
      try {
        await refreshModListFnRef.current();
        // Il toast di successo/errore è gestito all'interno di loadAndSyncData in ModManagerLayout
      } catch (error) {
        console.error('[AppContent] Error calling refresh function:', error);
        toast.error('An unexpected error occurred while trying to refresh.');
      }
    } else {
      console.warn(
        '[AppContent] Refresh function not available from ModManagerLayout yet.'
      );
      toast.info(
        'Refresh functionality is not ready yet. Please wait a moment.'
      );
    }
  }, []);

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
    <div className="flex flex-col h-full"> {/* Contenitore principale flex a colonna, altezza piena */}
      <MenuBar
        gameFolderPath={menuBarGamePath}
        onDevClearFolder={onHookHandleDevClearFolder}
        onSettingsClick={onToggleSettingsPage}
        onRefreshMods={handleRefreshFromMenu}
      />
      {/* Area di contenuto principale, scrollabile se necessario */}
      <div className="flex-grow overflow-hidden min-h-0"> {/* Modificato da overflow-y-auto a overflow-hidden */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full"> {/* h-full per centraggio verticale */}
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
            <ModManagerLayout
              exposeRefreshFunction={exposeRefreshFunctionFromLayout}
            />
          </>
        )}
      </div>
      <StatusBar onTriggerUpdateCheck={onTriggerUpdateCheck} /> {/* Passa la prop a StatusBar */}
    </div>
  );
}
