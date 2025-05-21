'use client';

// Temporaneamente commentato per debuggare l'export default
import { useGameFolderPath } from '@/hooks/useGameFolderPath.ts';
import GameFolderSetup from '@/components/GameFolderSetup.tsx';
import UpdateElectron from '@/components/update/index.tsx';
// import { Button } from '@/components/ui/button.tsx'; // Non più usato direttamente qui
import { ModEnablerStatusNotifier } from '@/components/ModEnablerStatusNotifier.tsx';
import ModManagerLayout from './ModManagerLayout.tsx';
// import MenuBar from './MenuBar.tsx'; // Rimuovi l'importazione di MenuBar

export default function AppContent() {
  const {
    gameFolderPath, // Questa variabile è ancora usata qui per la logica condizionale
    showSetupModal,
    handleSetupComplete,
    // handleDevClearFolder, // Non più passato a MenuBar da qui
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
      {/* <MenuBar gameFolderPath={gameFolderPath} onDevClearFolder={handleDevClearFolder} /> Rimuovi l'istanza di MenuBar */}
      <ModEnablerStatusNotifier />

      {gameFolderPath && (
        <div className="flex flex-col h-full">
          <div className="flex-grow">
            <ModManagerLayout />
          </div>
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

      {/* <UpdateElectron /> */}

      {showSetupModal && (
        <GameFolderSetup onSetupComplete={handleSetupComplete} />
      )}
    </>
  );
}
