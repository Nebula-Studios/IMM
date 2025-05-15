'use client';

// Temporaneamente commentato per debuggare l'export default
import { useGameFolderPath } from '@/hooks/useGameFolderPath.ts';
import GameFolderSetup from '@/components/GameFolderSetup.tsx';
import UpdateElectron from '@/components/update/index.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ModEnablerStatusNotifier } from '@/components/ModEnablerStatusNotifier.tsx';

export default function AppContent() {
  const {
    gameFolderPath,
    showSetupModal,
    handleSetupComplete,
    handleDevClearFolder,
    isLoading,
  } = useGameFolderPath();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-lg text-slate-300">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <ModEnablerStatusNotifier />

      {gameFolderPath && (
        <div className="text-center p-4">
          <p className="text-lg">InZOI Mod Manager is ready!</p>
          <p className="text-sm text-slate-400">
            InZOI Path: <code>{gameFolderPath}</code>
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDevClearFolder}
            className="mt-4"
          >
            DEV: Reset Game Folder
          </Button>
        </div>
      )}

      {!gameFolderPath && !showSetupModal && (
        <div className="text-center p-4">
          <p className="text-lg text-orange-400">
            Game folder configuration has not been completed yet.
          </p>
          <p className="text-sm text-slate-500">
            Please wait or restart the application if the issue persists.
          </p>
        </div>
      )}

      <UpdateElectron />

      {showSetupModal && (
        <GameFolderSetup onSetupComplete={handleSetupComplete} />
      )}
    </>
  );
}
