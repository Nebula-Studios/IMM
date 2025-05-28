import React, { useState, useEffect } from 'react';
// import MenuBar from '@/components/layout/MenuBar.tsx'; // Rimosso da qui
import StatusBar from '@/components/layout/StatusBar.tsx';
import AppContent from '@/components/layout/AppContent.tsx';
// SettingsPage non verrà più renderizzata direttamente qui
import { Toaster } from '@/components/ui/sonner.tsx';
import { useGameFolderPath } from '@/hooks/useGameFolderPath.ts';

export default function App() {
  const {
    gameFolderPath,
    showSetupModal, // Anche se AppContent lo prende dall'hook, lo passiamo per coerenza se MenuBar ne avesse bisogno tramite AppContent
    isLoading, // Come sopra
    handleSetupComplete,
    handleDevClearFolder,
    reloadPath, // Potrebbe servire passarlo giù
  } = useGameFolderPath();

  const [showSettingsPage, setShowSettingsPage] = useState(false);

  useEffect(() => {
    console.log('[App.tsx] gameFolderPath from hook (direct):', gameFolderPath);
    console.log('[App.tsx] showSettingsPage state:', showSettingsPage);
  }, [gameFolderPath, showSettingsPage]);

  const handleToggleSettingsPage = () => {
    setShowSettingsPage((prev) => !prev);
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden text-slate-100 bg-neutral-900/80">
      <img
        src="/bg_nebula.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-fill top-0 left-0 -z-10 blur-sm"
      />
      {/* MenuBar rimosso da qui */}
      <main className="flex-grow overflow-y-auto">
        {/* AppContent è sempre renderizzato. Gestirà la visualizzazione di SettingsPage internamente. */}
        <AppContent
          hookGameFolderPath={gameFolderPath}
          hookShowSetupModal={showSetupModal}
          hookIsLoading={isLoading}
          onHookHandleSetupComplete={handleSetupComplete}
          onHookHandleDevClearFolder={handleDevClearFolder}
          onHookReloadPath={reloadPath}
          showSettingsPage={showSettingsPage} // Passiamo lo stato di visibilità della pagina impostazioni
          onToggleSettingsPage={handleToggleSettingsPage} // Passiamo la callback per cambiare questo stato
          // La nuova funzione onRefreshMods verrà gestita all'interno di AppContent o ModManagerLayout
        />
      </main>
      <StatusBar />
      <Toaster position="bottom-right" />
    </div>
  );
}
