import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Update, { UpdateHandle } from '@/components/update/index.tsx';
import AppContent from '@/components/layout/AppContent.tsx';
import { Toaster } from '@/components/ui/sonner.tsx';
import { useGameFolderPath } from '@/hooks/useGameFolderPath.ts';
import { useTheme } from '@/hooks/useTheme.ts';
import backgroundImage from '/bg.jpg';

export default function App() {
  const {
    gameFolderPath,
    showSetupModal,
    isLoading,
    handleSetupComplete,
    handleDevClearFolder,
    reloadPath,
  } = useGameFolderPath();

  useTheme();
  const { t } = useTranslation();
  const updateRef = useRef<UpdateHandle>(null);

  const [showSettingsPage, setShowSettingsPage] = useState(false);

  const toggleSettingsPage = () => {
    setShowSettingsPage((prev) => !prev);
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex flex-col w-screen h-screen overflow-hidden text-slate-100 bg-neutral-900/80">
        <img
          src={backgroundImage}
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover top-0 left-0 -z-10 blur-sm"
        />
        <AppContent
          hookGameFolderPath={gameFolderPath}
          hookShowSetupModal={showSetupModal}
          hookIsLoading={isLoading}
          onHookHandleSetupComplete={handleSetupComplete}
          onHookHandleDevClearFolder={handleDevClearFolder}
          onHookReloadPath={reloadPath}
          showSettingsPage={showSettingsPage}
          onToggleSettingsPage={toggleSettingsPage}
        />
        <Update ref={updateRef} />
        <Toaster position="bottom-right" />
      </div>
    </Suspense>
  );
}
