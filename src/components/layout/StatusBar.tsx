import React from 'react';
import { ExternalLink, Info, CheckCircle } from 'lucide-react'; // Aggiunta CheckCircle

const StatusBar: React.FC = () => {
  // Informazioni sugli aggiornamenti (potrebbero venire dallo stato dell'app)
  const updateStatusMessage = 'Nessun aggiornamento disponibile.'; // Esempio
  const nexusModsLink = 'https://www.nexusmods.com/inzoi'; // Aggiorna se il link è diverso
  const isUpdateAvailable = false; // Esempio, dovrebbe venire dallo stato dell'app
  const isError = false; // Esempio per stato di errore

  const handleNexusLinkClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Previene il comportamento predefinito del link #
    if (window.electronAPI && window.electronAPI.sendToMainLog) {
      window.electronAPI.sendToMainLog(
        'info',
        'Nexus Mods link clicked',
        nexusModsLink
      );
    }
    window.electronAPI.openExternalLink(nexusModsLink);
  };

  let statusIcon;
  let statusTextColor = 'text-slate-400';
  if (isError) {
    statusIcon = <Info size={15} className="mr-1.5 text-red-400" />;
    statusTextColor = 'text-red-400';
  } else if (isUpdateAvailable) {
    statusIcon = <Info size={15} className="mr-1.5 text-blue-400" />;
    statusTextColor = 'text-blue-400';
  } else {
    statusIcon = <CheckCircle size={15} className="mr-1.5 text-green-400" />;
    statusTextColor = 'text-green-400';
  }

  return (
    <footer className="bg-neutral-800 text-slate-400 flex items-center justify-between px-6 py-2 h-10 border-t border-l border-r border-neutral-700 rounded-t-xl mx-4 text-xs shadow-xl">
      <div className={`flex items-center ${statusTextColor}`}>
        {statusIcon}
        <span>{updateStatusMessage}</span>
      </div>
      <a
        href={nexusModsLink} // Manteniamo href per semantica e accessibilità
        onClick={handleNexusLinkClick}
        title="Visita InZOI su Nexus Mods"
        className="flex items-center text-slate-400 hover:text-blue-400 hover:underline transition-colors duration-150"
      >
        InZOI su Nexus Mods
        <ExternalLink size={14} className="ml-1.5" />
      </a>
    </footer>
  );
};

export default StatusBar;
