import React from 'react';
import { Settings } from 'lucide-react'; // Importa l'icona Settings
import { Button } from '@/components/ui/button.tsx'; // Importa Button

const MenuBar: React.FC = () => {
  const appName = 'InZOI Mod Manager'; // O prenderlo da package.json o configurazione

  const handleSettingsClick = () => {
    // Logica per aprire le impostazioni
    if (window.electronAPI && window.electronAPI.sendToMainLog) {
      window.electronAPI.sendToMainLog('info', 'Settings icon clicked');
    }
    alert('Settings clicked! (Implementazione da fare)');
  };

  return (
    <header className="bg-slate-800/60 backdrop-blur-lg text-slate-100 flex items-center justify-between px-6 py-3 h-16 shadow-xl border-b border-slate-700/50 rounded-b-xl mx-4">
      <div className="text-xl font-semibold tracking-wide">{appName}</div>
      <Button
        onClick={handleSettingsClick}
        title="Settings"
        variant="ghost"
        size="icon"
        className="text-slate-300 hover:text-slate-100 focus:ring-blue-500 focus:ring-opacity-75 p-2 data-[state=open]:bg-slate-700/70 data-[state=closed]:bg-transparent"
      >
        <Settings size={22} />
      </Button>
    </header>
  );
};

export default MenuBar;
