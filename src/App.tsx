import React, { useState, useEffect, Suspense, useRef } from 'react'; // Aggiunto Suspense e useRef
import { useTranslation } from 'react-i18next'; // Aggiunto per i18next
import Update, { UpdateHandle } from '@/components/update/index.tsx'; // Import per il componente Update, specificando index.tsx
// import MenuBar from '@/components/layout/MenuBar.tsx'; // Rimosso da qui
// StatusBar sarà importata e usata in AppContent
import AppContent from '@/components/layout/AppContent.tsx';
// SettingsPage non verrà più renderizzata direttamente qui
import { Toaster } from '@/components/ui/sonner.tsx';
import { useGameFolderPath } from '@/hooks/useGameFolderPath.ts';
import { useTheme } from '@/hooks/useTheme.ts'; // Aggiunto import per useTheme

export default function App() {
  const {
    gameFolderPath,
    showSetupModal, // Anche se AppContent lo prende dall'hook, lo passiamo per coerenza se MenuBar ne avesse bisogno tramite AppContent
    isLoading, // Come sopra
    handleSetupComplete,
    handleDevClearFolder,
    reloadPath, // Potrebbe servire passarlo giù
  } = useGameFolderPath();

  useTheme(); // Chiamata a useTheme per inizializzare e applicare il tema
  const { t } = useTranslation(); // Hook per le traduzioni
  const updateRef = useRef<UpdateHandle>(null);

  const handleTriggerUpdateCheck = () => {
    updateRef.current?.triggerUpdateCheck();
  };

  const [showSettingsPage, setShowSettingsPage] = useState(false);

  useEffect(() => {
    console.log('[App.tsx] gameFolderPath from hook (direct):', gameFolderPath);
    console.log('[App.tsx] showSettingsPage state:', showSettingsPage);
  }, [gameFolderPath, showSettingsPage]);

  const handleToggleSettingsPage = () => {
    setShowSettingsPage((prev) => !prev);
  };

  return (
    <Suspense fallback={<div>Loading...</div>}> {/* Fallback statico */}
      <div className="flex flex-col w-screen h-screen overflow-hidden text-slate-100 bg-neutral-900/80">
        {/* <h1>{t('greeting')}</h1> Esempio di stringa tradotta rimosso */}
        <img
          src="/bg_nebula.png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-fill top-0 left-0 -z-10 blur-sm"
      />
      {/* MenuBar e StatusBar saranno gestite da AppContent */}
      {/* AppContent ora occupa tutto lo spazio flex disponibile */}
      <AppContent
        hookGameFolderPath={gameFolderPath}
        hookShowSetupModal={showSetupModal}
        hookIsLoading={isLoading}
        onHookHandleSetupComplete={handleSetupComplete}
        onHookHandleDevClearFolder={handleDevClearFolder}
        onHookReloadPath={reloadPath}
        showSettingsPage={showSettingsPage} // Passiamo lo stato di visibilità della pagina impostazioni
        onToggleSettingsPage={handleToggleSettingsPage} // Passiamo la callback per cambiare questo stato
        onTriggerUpdateCheck={handleTriggerUpdateCheck} // Passiamo la callback per il controllo manuale degli aggiornamenti
        // La nuova funzione onRefreshMods verrà gestita all'interno di AppContent o ModManagerLayout
      />
      <Update ref={updateRef} /> {/* Componente Update aggiunto qui */}
      {/* StatusBar rimossa da qui, Toaster rimane */}
      <Toaster position="bottom-right" />
      </div>
    </Suspense>
  );
}
