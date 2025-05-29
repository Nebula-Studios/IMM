import type { ProgressInfo } from 'electron-updater';
import type { IpcRendererEvent } from 'electron';
import {
  useCallback,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import CustomModal from './Modal/index.tsx'; // Rinominato e percorso relativo
import Progress from './Progress/index.tsx'; // Percorso relativo
// import './update.css'; // Rimosso
// Button non è più usato qui
// import { Button } from '@/components/ui/button.tsx';

// Define specific types for clarity if not already available globally
interface VersionInfo {
  update: boolean;
  version: string;
  newVersion: string;
  // Add other properties if they exist
}

interface ErrorType extends Error {
  // Add specific error properties if they exist
}

export interface UpdateHandle {
  triggerUpdateCheck: () => void;
}

const Update = forwardRef<UpdateHandle>((_props: {}, ref) => {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo>();
  const [updateError, setUpdateError] = useState<ErrorType>();
  const [progressInfo, setProgressInfo] = useState<Partial<ProgressInfo>>();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalBtn, setModalBtn] = useState<{
    cancelText?: string;
    okText?: string;
    onCancel?: () => void;
    onOk?: () => void;
  }>({
    onCancel: () => setModalOpen(false),
    onOk: () => {
      if (window.electronAPI && window.electronAPI.startDownload) {
        window.electronAPI.startDownload();
      }
    },
  });

  const checkUpdate = async () => {
    setChecking(true);
    if (window.electronAPI && window.electronAPI.checkUpdate) {
      try {
        const result = await window.electronAPI.checkUpdate();
        setProgressInfo({ percent: 0 }); 
        setChecking(false);
        setModalOpen(true);
        if (result?.error) {
          setUpdateAvailable(false);
          setUpdateError(result?.error as ErrorType);
          setModalBtn({
            okText: 'OK',
            onOk: () => setModalOpen(false),
            cancelText: undefined,
            onCancel: undefined,
          });
        } else if (result) {
          onUpdateCanAvailable(null, result as VersionInfo);
        } else {
           setUpdateAvailable(false);
           setVersionInfo(undefined); 
           setModalBtn({
            okText: 'OK',
            onOk: () => setModalOpen(false),
            cancelText: undefined,
            onCancel: undefined,
          });
        }
      } catch (e: any) {
        setChecking(false);
        setModalOpen(true);
        setUpdateAvailable(false);
        setUpdateError(e as ErrorType);
        setModalBtn({
          okText: 'OK',
          onOk: () => setModalOpen(false),
          cancelText: undefined,
          onCancel: undefined,
        });
      }
    } else {
      console.error('electronAPI.checkUpdate is not available');
      setChecking(false);
      setUpdateError(new Error('Update check functionality is not available.'));
      setModalBtn({
        okText: 'OK',
        onOk: () => setModalOpen(false),
        cancelText: undefined,
        onCancel: undefined,
      });
      setModalOpen(true);
    }
  };

  const onUpdateCanAvailable = useCallback(
    (_event: IpcRendererEvent | null, arg1: VersionInfo) => {
      setVersionInfo(arg1);
      setUpdateError(undefined);
      if (arg1.update) {
        setModalBtn({
          cancelText: 'Cancel',
          okText: 'Update',
          onOk: () => {
            if (window.electronAPI && window.electronAPI.startDownload) {
              window.electronAPI.startDownload();
            }
          },
          onCancel: () => setModalOpen(false),
        });
        setUpdateAvailable(true);
      } else {
        setModalBtn({
          okText: 'OK',
          onOk: () => setModalOpen(false),
          cancelText: undefined, 
          onCancel: undefined,
        });
        setUpdateAvailable(false);
      }
      setModalOpen(true); 
    },
    []
  );

  const onUpdateError = useCallback(
    (_event: IpcRendererEvent | null, arg1: ErrorType) => {
      setUpdateAvailable(false);
      setUpdateError(arg1);
      setModalBtn({
        okText: 'OK',
        onOk: () => setModalOpen(false),
        cancelText: undefined,
        onCancel: undefined,
      });
      setModalOpen(true); 
    },
    []
  );

  const onDownloadProgress = useCallback(
    (_event: IpcRendererEvent | null, arg1: ProgressInfo) => {
      setProgressInfo(arg1);
      setModalOpen(true); 
    },
    []
  );

  const onUpdateDownloaded = useCallback(
    (_event: IpcRendererEvent | null, ...args: any[]) => {
      setProgressInfo({ percent: 100 });
      setModalBtn({
        cancelText: 'Later',
        okText: 'Install now',
        onOk: () => {
          if (window.electronAPI && window.electronAPI.quitAndInstall) {
            window.electronAPI.quitAndInstall();
          }
        },
        onCancel: () => setModalOpen(false),
      });
      setModalOpen(true); 
    },
    []
  );

  useEffect(() => {
    let unsubscribeUpdateCanAvailable: (() => void) | undefined;
    let unsubscribeUpdateError: (() => void) | undefined;
    let unsubscribeDownloadProgress: (() => void) | undefined;
    let unsubscribeUpdateDownloaded: (() => void) | undefined;

    if (window.electronAPI && window.electronAPI.ipcOn) {
      unsubscribeUpdateCanAvailable = window.electronAPI.ipcOn(
        'update-can-available',
        onUpdateCanAvailable as (
          event: IpcRendererEvent,
          ...args: any[]
        ) => void
      );
      unsubscribeUpdateError = window.electronAPI.ipcOn(
        'update-error',
        onUpdateError as (
          event: IpcRendererEvent,
          ...args: any[]
        ) => void
      );
      unsubscribeDownloadProgress = window.electronAPI.ipcOn(
        'download-progress',
        onDownloadProgress as (
          event: IpcRendererEvent,
          ...args: any[]
        ) => void
      );
      unsubscribeUpdateDownloaded = window.electronAPI.ipcOn(
        'update-downloaded',
        onUpdateDownloaded as (
          event: IpcRendererEvent,
          ...args: any[]
        ) => void
      );
    }

    return () => {
      unsubscribeUpdateCanAvailable?.();
      unsubscribeUpdateError?.();
      unsubscribeDownloadProgress?.();
      unsubscribeUpdateDownloaded?.();
    };
  }, [
    onUpdateCanAvailable,
    onUpdateError,
    onDownloadProgress,
    onUpdateDownloaded,
  ]);

  useEffect(() => {
    if (!checking) { 
        checkUpdate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useImperativeHandle(ref, () => ({
    triggerUpdateCheck: () => {
      if (!checking) {
        setModalOpen(true); 
      }
      checkUpdate();
    },
  }));

  return (
    <CustomModal
      open={modalOpen}
      cancelText={modalBtn?.cancelText}
      okText={modalBtn?.okText}
      onCancel={modalBtn?.onCancel}
      onOk={modalBtn?.onOk}
      footer={
        updateAvailable ||
        (progressInfo?.percent && progressInfo.percent > 0 && progressInfo.percent < 100) ||
        updateError ||
        (versionInfo && !checking && !updateError)
          ? undefined // Lascia che CustomModal gestisca i pulsanti di default
          : null // Nasconde il footer se nessuna delle condizioni sopra è vera
      }
      // Passiamo un titolo alla modale se necessario, altrimenti CustomModal non lo mostrerà
      title={
        updateError
          ? 'Update Error'
          : updateAvailable
          ? 'Update Available'
          : (versionInfo && !versionInfo.update && !checking)
          ? 'Up to Date'
          : 'Checking for Updates'
      }
    >
      <div className="p-4 space-y-4">
        {updateError ? (
          <div className="text-center">
            <p className="text-destructive font-semibold">Error checking for updates.</p>
            <p className="text-sm text-muted-foreground">{updateError.message}</p>
          </div>
        ) : checking && (!progressInfo || progressInfo.percent === 0) && !updateAvailable && !versionInfo ? (
          <div className="text-center text-muted-foreground py-4">
            Checking for updates...
          </div>
        ) : updateAvailable ? (
          <div className="space-y-2">
            <div className="text-lg font-semibold">The latest version is: v{versionInfo?.newVersion}</div>
            <div className="text-sm text-muted-foreground">
              Current version: v{versionInfo?.version}
            </div>
            <div className="mt-4">
              <div className="text-sm font-medium mb-1">Update progress:</div>
              <Progress percent={progressInfo?.percent}></Progress>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            {versionInfo && !versionInfo.update && !checking
              ? `Current version: v${versionInfo.version}. You are up-to-date.`
              : 'Checking for updates...'}
          </div>
        )}
      </div>
    </CustomModal>
  );
});

export default Update;
