import React, { useEffect } from 'react';
import { Settings, FolderX, HelpCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
// import { APP_VERSION } from '@/lib/constants.ts';

export interface MenuBarProps {
  gameFolderPath: string | null;
  onDevClearFolder: () => Promise<void>;
  onSettingsClick: () => void;
  onRefreshMods: () => void; // Nuova prop per l'aggiornamento
}

const MenuBar: React.FC<MenuBarProps> = ({
  gameFolderPath,
  onDevClearFolder,
  onSettingsClick,
  onRefreshMods, // Nuova prop
}) => {
  useEffect(() => {
    // Questo log è cruciale!
    console.log(
      '[MenuBar.SIMPLIFIED] Rendering with gameFolderPath:',
      gameFolderPath
    );
    // Forziamo un alert per vedere se il componente si renderizza con il nuovo path
    // ATTENZIONE: Questo sarà fastidioso, ma è per un test rapido.
    // Rimuovilo subito dopo il test.
    // alert(`[MenuBar.SIMPLIFIED] gameFolderPath: ${String(gameFolderPath)}`);
  }, [gameFolderPath]);

  const basePath = gameFolderPath ? gameFolderPath.split('\\inzoi')[0] : null;
  const displayPath = basePath ? `${basePath}\\...` : 'N/A';

  const handleOpenLink = (url: string) => {
    window.electronAPI.openExternalLink(url);
  };

  return (
    <div className="h-14 px-4 mx-4 mb-1 flex items-center justify-between bg-neutral-800 text-slate-100 border-b border-l border-r border-neutral-700 rounded-b-xl shadow-xl print:hidden">
      <div className="flex items-center space-x-2">
        <img src="/icon.svg" alt="App Icon" className="h-6 w-6" />
        <h1 className="text-lg font-semibold tracking-tight">
          InZOI Mod Manager{' '}
          {/* <span className="text-xs text-slate-400">v{APP_VERSION}</span> */}
        </h1>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            handleOpenLink(
              'https://github.com/Nebula-Studios/IMM/issues/new/choose'
            )
          }
          title="Report a Bug / Request a Feature"
        >
          <HelpCircle className="h-4 w-4 mr-1" />
          Report Bug
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefreshMods} // Chiama la nuova funzione
          title="Refresh Mod List"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh Mods
        </Button>

        {/* Pulsante per resettare il percorso - SOLO SVILUPPO */}
        {process.env.NODE_ENV === 'development' && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDevClearFolder}
            title="DEV ONLY: Reset Game Folder Path"
          >
            <FolderX className="h-4 w-4 mr-1" />
            DEV: Reset Path
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onSettingsClick}
          title="Open Settings"
        >
          <Settings className="h-4 w-4 mr-1" />
          Settings
        </Button>
      </div>
    </div>
  );
};

export default MenuBar;
