import React from 'react';
import { Settings } from 'lucide-react'; // Importa l'icona Settings
import { Button } from '@/components/ui/button.tsx'; // Importa Button

interface MenuBarProps {
  gameFolderPath: string | null | undefined;
  onDevClearFolder: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  gameFolderPath,
  onDevClearFolder,
}) => {
  const appName = 'InZOI Mod Manager'; // O prenderlo da package.json o configurazione

  const handleSettingsClick = () => {
    // Logica per aprire le impostazioni
    if (window.electronAPI && window.electronAPI.sendToMainLog) {
      window.electronAPI.sendToMainLog('info', 'Settings icon clicked');
    }
    alert('Settings clicked! (Implementazione da fare)');
  };

  return (
    <header className="bg-neutral-800 text-slate-100 flex items-center justify-between px-6 py-3 min-h-16 shadow-xl border-b border-l border-r border-neutral-700 rounded-b-xl mx-4">
      <div className="flex flex-col items-start">
        <div className="text-xl font-semibold tracking-wide">{appName}</div>
        {gameFolderPath && (
          <div className="mt-1 flex items-center">
            <p className="text-xs text-neutral-300">
              Game Path: <code>{gameFolderPath}</code>
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={onDevClearFolder}
              className="ml-2 text-orange-400 hover:text-orange-300 p-0 h-auto text-xs focus-visible:ring-offset-0 focus-visible:ring-0"
            >
              DEV: Reset Path
            </Button>
          </div>
        )}
      </div>
      <Button
        onClick={handleSettingsClick}
        title="Settings"
        variant="ghost"
        size="icon"
        className="text-slate-300 hover:text-slate-100 focus:ring-blue-500 focus:ring-opacity-75 p-2 data-[state=open]:bg-neutral-700 data-[state=closed]:bg-transparent"
      >
        <Settings size={22} />
      </Button>
    </header>
  );
};

export default MenuBar;
