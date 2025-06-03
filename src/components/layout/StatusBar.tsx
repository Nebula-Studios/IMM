import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExternalLink,
  Info,
  CheckCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react'; // Aggiunta RefreshCw
import { cn } from '@/lib/utils.ts'; // Importa cn
import { Button } from '../ui/button.tsx';

interface StatusBarProps {
  className?: string;
  onTriggerUpdateCheck?: () => void; // Aggiunta la prop per il controllo manuale
}

const StatusBar: React.FC<StatusBarProps> = ({
  className,
  onTriggerUpdateCheck,
}) => {
  const { t } = useTranslation();
  // Informazioni sugli aggiornamenti (potrebbero venire dallo stato dell'app)
  const updateStatusMessage = t('statusBar.noUpdates'); // Esempio
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

  function handleOpenLink(arg0: string): void {
    window.electronAPI.openExternalLink(arg0);
  }

  return (
    <footer
      className={cn(
        'bg-gradient-to-r from-neutral-900/90 to-neutral-800/90 backdrop-blur-sm text-slate-400 flex items-center justify-between px-6 py-2 h-10 border-t border-l border-r border-neutral-700/80 rounded-t-xl mx-4 text-xs shadow-2xl hover:shadow-neutral-900/50 transition-all duration-300',
        className
      )}
    >
      <div className={`flex items-center ${statusTextColor}`}>
        {statusIcon}
        <span>{updateStatusMessage}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onTriggerUpdateCheck}
        title={t('statusBar.checkForUpdates', 'Check for Updates')}
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        {t('statusBar.checkForUpdatesButton', 'Check for Updates')}
      </Button>
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
        Report Bug / Request a Feature
      </Button>
      <a
        href={nexusModsLink} // Manteniamo href per semantica e accessibilità
        onClick={handleNexusLinkClick}
        title={t('statusBar.visitNexusMods')}
        className="flex items-center text-slate-400 hover:text-blue-400 hover:underline transition-colors duration-150"
      >
        {t('statusBar.inzoiOnNexusMods')}
        <ExternalLink size={14} className="ml-1.5" />
      </a>
    </footer>
  );
};

export default StatusBar;
