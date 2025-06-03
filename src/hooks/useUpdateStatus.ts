import { useState, useEffect, useCallback } from 'react';
import type { IpcRendererEvent } from 'electron';

interface VersionInfo {
  update: boolean;
  version: string;
  newVersion: string;
}

interface UpdateError {
  message: string;
}

export interface UpdateStatus {
  isChecking: boolean;
  isUpdateAvailable: boolean;
  updateError: UpdateError | null;
  versionInfo: VersionInfo | null;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
}

export function useUpdateStatus(): UpdateStatus {
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [updateError, setUpdateError] = useState<UpdateError | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  const checkForUpdates = useCallback(async () => {
    // Verifica se siamo in modalità sviluppo
    const isDevelopment = !window.electronAPI || import.meta.env.DEV;
    
    if (isDevelopment && window.electronAPI?.checkUpdateFromGitHub) {
      // Modalità sviluppo: usa GitHub API
      setIsChecking(true);
      setUpdateError(null);
      
      try {
        const result = await window.electronAPI.checkUpdateFromGitHub();
        setIsChecking(false);
        
        if (result.success && result.hasUpdate !== undefined) {
          const versionInfo: VersionInfo = {
            update: result.hasUpdate,
            version: result.currentVersion || '1.0.0',
            newVersion: result.latestVersion || '1.0.0',
          };
          setVersionInfo(versionInfo);
          setIsUpdateAvailable(result.hasUpdate);
          setUpdateError(null);
        } else {
          setUpdateError({ message: result.error || 'GitHub update check failed' });
          setIsUpdateAvailable(false);
          setVersionInfo(null);
        }
      } catch (error: any) {
        setIsChecking(false);
        setUpdateError({ message: error.message || 'GitHub update check failed' });
        setIsUpdateAvailable(false);
        setVersionInfo(null);
      }
    } else if (window.electronAPI?.checkUpdate) {
      // Modalità produzione: usa electron-updater
      setIsChecking(true);
      setUpdateError(null);
      
      try {
        const result = await window.electronAPI.checkUpdate();
        setIsChecking(false);
        
        if (result?.error) {
          setUpdateError(result.error);
          setIsUpdateAvailable(false);
          setVersionInfo(null);
        }
      } catch (error: any) {
        setIsChecking(false);
        setUpdateError({ message: error.message || 'Update check failed' });
        setIsUpdateAvailable(false);
        setVersionInfo(null);
      }
    } else {
      console.error('No update check method available');
      setUpdateError({ message: 'Update check functionality is not available' });
    }
  }, []);

  const downloadUpdate = useCallback(() => {
    const isDevelopment = !window.electronAPI || import.meta.env.DEV;
    
    if (isDevelopment) {
      // In modalità sviluppo, apri la pagina delle release invece di scaricare
      if (window.electronAPI?.openExternalLink) {
        window.electronAPI.openExternalLink('https://github.com/Nebula-Studios/IMM/releases/latest');
      }
    } else if (window.electronAPI?.startDownload) {
      // In modalità produzione, scarica l'aggiornamento
      window.electronAPI.startDownload();
    }
  }, []);

  const onUpdateCanAvailable = useCallback(
    (_event: IpcRendererEvent, arg1: VersionInfo) => {
      setVersionInfo(arg1);
      setUpdateError(null);
      setIsUpdateAvailable(arg1.update);
      setIsChecking(false);
    },
    []
  );

  const onUpdateError = useCallback(
    (_event: IpcRendererEvent, arg1: UpdateError) => {
      setIsUpdateAvailable(false);
      setUpdateError(arg1);
      setIsChecking(false);
    },
    []
  );

  useEffect(() => {
    if (!window.electronAPI?.ipcOn) return;

    const unsubscribeUpdateCanAvailable = window.electronAPI.ipcOn(
      'update-can-available',
      onUpdateCanAvailable as (event: IpcRendererEvent, ...args: any[]) => void
    );

    const unsubscribeUpdateError = window.electronAPI.ipcOn(
      'update-error',
      onUpdateError as (event: IpcRendererEvent, ...args: any[]) => void
    );

    // Controllo automatico all'avvio, ma silenzioso (senza popup)
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 2000); // Attende 2 secondi dopo l'avvio per non interferire con il caricamento

    return () => {
      unsubscribeUpdateCanAvailable?.();
      unsubscribeUpdateError?.();
      clearTimeout(timer);
    };
  }, [onUpdateCanAvailable, onUpdateError, checkForUpdates]);

  return {
    isChecking,
    isUpdateAvailable,
    updateError,
    versionInfo,
    checkForUpdates,
    downloadUpdate,
  };
}