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
}

const NEXUS_MODS_LINK = 'https://www.nexusmods.com/inzoi';
const GITHUB_ISSUES_LINK =
  'https://github.com/Nebula-Studios/IMM/issues/new/choose';

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

  const isDevelopment = !window.electronAPI || import.meta.env.DEV;

  const getUpdateStatusMessage = () => {
    if (isChecking) return t('statusBar.checkingForUpdates');
    if (updateError) return t('statusBar.updateError');
    if (isUpdateAvailable && versionInfo) {
      return t('statusBar.updateAvailable', {
        version: versionInfo.newVersion,
      });
    }
    return t('statusBar.noUpdates');
  };

  const handleCheckForUpdates = () => {
    toast.promise(
      new Promise((resolve) => {
        checkForUpdates();
        resolve(undefined);
      }),
      {
        loading: t('statusBar.checkingForUpdates'),
        success: () => '',
        error: t('statusBar.updateError'),
      }
    );
  };

  const handleDownloadUpdate = () => {
    downloadUpdate();
    const message = isDevelopment
      ? t('statusBar.viewOnGitHub')
      : t('statusBar.downloadUpdate');
    toast.info(message);
  };

  const getDownloadButtonText = () => {
    return isDevelopment
      ? t('statusBar.viewOnGitHub')
      : t('statusBar.downloadUpdate');
  };

  const handleNexusLinkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.electronAPI?.sendToMainLog) {
      window.electronAPI.sendToMainLog(
        'info',
        'Nexus Mods link clicked',
        NEXUS_MODS_LINK
      );
    }
    window.electronAPI.openExternalLink(NEXUS_MODS_LINK);
  };

  const handleOpenLink = (url: string) => {
    window.electronAPI.openExternalLink(url);
  };

  const getStatusIconAndColor = () => {
    if (updateError) {
      return {
        icon: <AlertCircle size={15} className="mr-1.5 text-red-400" />,
        textColor: 'text-red-400',
      };
    }
    if (isUpdateAvailable) {
      return {
        icon: <Info size={15} className="mr-1.5 text-blue-400" />,
        textColor: 'text-blue-400',
      };
    }
    if (isChecking) {
      return {
        icon: (
          <RefreshCw
            size={15}
            className="mr-1.5 text-yellow-400 animate-spin"
          />
        ),
        textColor: 'text-yellow-400',
      };
    }
    return {
      icon: <CheckCircle size={15} className="mr-1.5 text-green-400" />,
      textColor: 'text-green-400',
    };
  };

  const { icon: statusIcon, textColor: statusTextColor } =
    getStatusIconAndColor();
  const updateStatusMessage = getUpdateStatusMessage();

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
        onClick={() => handleOpenLink(GITHUB_ISSUES_LINK)}
        title={t('menuBar.reportBugTooltip')}
      >
        <HelpCircle className="h-4 w-4 mr-1" />
        {t('menuBar.reportBugButton')}
      </Button>
      <a
        href={NEXUS_MODS_LINK}
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
