import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExternalLink,
  Info,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Download,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { Button } from '../ui/button.tsx';
import { useUpdateStatus } from '@/hooks/useUpdateStatus.ts';
import { toast } from 'sonner';

interface StatusBarProps {
  className?: string;
  onTriggerUpdateCheck?: () => void; // Mantenuto per compatibilità, ma non più usato
}

const StatusBar: React.FC<StatusBarProps> = ({ className }) => {
  const { t } = useTranslation();
  const {
    isChecking,
    isUpdateAvailable,
    updateError,
    versionInfo,
    checkForUpdates,
    downloadUpdate,
  } = useUpdateStatus();

  const nexusModsLink = 'https://www.nexusmods.com/inzoi';

  // Determina il messaggio di stato
  const getUpdateStatusMessage = () => {
    if (isChecking) {
      return t('statusBar.checkingForUpdates');
    }
    if (updateError) {
      return t('statusBar.updateError');
    }
    if (isUpdateAvailable && versionInfo) {
      return t('statusBar.updateAvailable', {
        version: versionInfo.newVersion,
      });
    }
    return t('statusBar.noUpdates');
  };

  const updateStatusMessage = getUpdateStatusMessage();

  const handleCheckForUpdates = () => {
    toast.promise(
      new Promise((resolve) => {
        checkForUpdates();
        // Risolviamo subito la promise per evitare che il toast rimanga in loading
        resolve(undefined);
      }),
      {
        loading: t('statusBar.checkingForUpdates'),
        success: () => {
          // Il messaggio di successo sarà gestito dall'hook quando riceve la risposta
          return '';
        },
        error: t('statusBar.updateError'),
      }
    );
  };

  const handleDownloadUpdate = () => {
    const isDevelopment = !window.electronAPI || import.meta.env.DEV;
    downloadUpdate();

    if (isDevelopment) {
      toast.info(t('statusBar.viewOnGitHub'));
    } else {
      toast.info(t('statusBar.downloadUpdate'));
    }
  };

  // Determina il testo del pulsante in base alla modalità
  const getDownloadButtonText = () => {
    const isDevelopment = !window.electronAPI || import.meta.env.DEV;
    return isDevelopment
      ? t('statusBar.viewOnGitHub')
      : t('statusBar.downloadUpdate');
  };

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

  // Determina icona e colore in base allo stato
  let statusIcon;
  let statusTextColor = 'text-slate-400';

  if (updateError) {
    statusIcon = <AlertCircle size={15} className="mr-1.5 text-red-400" />;
    statusTextColor = 'text-red-400';
  } else if (isUpdateAvailable) {
    statusIcon = <Info size={15} className="mr-1.5 text-blue-400" />;
    statusTextColor = 'text-blue-400';
  } else if (isChecking) {
    statusIcon = (
      <RefreshCw size={15} className="mr-1.5 text-yellow-400 animate-spin" />
    );
    statusTextColor = 'text-yellow-400';
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

      <div className="flex items-center gap-2">
        {isUpdateAvailable ? (
          <Button
            variant="ghost"
            color="primary"
            size="sm"
            onClick={handleDownloadUpdate}
            title={getDownloadButtonText()}
          >
            <Download className="h-4 w-4 mr-1" />
            {getDownloadButtonText()}
          </Button>
        ) : (
          <Button
            variant="ghost"
            color="neutral"
            size="sm"
            onClick={handleCheckForUpdates}
            disabled={isChecking}
            title={t('statusBar.checkForUpdates')}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-1', isChecking && 'animate-spin')}
            />
            {t('statusBar.checkForUpdatesButton')}
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        color="warning"
        size="sm"
        onClick={() =>
          handleOpenLink(
            'https://github.com/Nebula-Studios/IMM/issues/new/choose'
          )
        }
        title={t('menuBar.reportBugTooltip')}
      >
        <HelpCircle className="h-4 w-4 mr-1" />
        {t('menuBar.reportBugButton')}
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
