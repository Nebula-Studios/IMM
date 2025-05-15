import type { ProgressInfo } from 'electron-updater';
import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/update/Modal/index.tsx';
import Progress from '@/components/update/Progress/index.tsx';
import './update.css';
import { Button } from '@/components/ui/button.tsx';

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

const Update = () => {
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
        // Assuming result structure based on original logic
        // You might need to adjust this based on the actual structure of 'result'
        if (result?.error) {
          setUpdateAvailable(false);
          setUpdateError(result?.error as ErrorType);
        } else if (result) {
          // If no error, assume result itself is or contains version info
          // This part needs to match how 'update-can-available' was triggered before
          // For now, we'll manually call the handler if data is present
          onUpdateCanAvailable(null, result as VersionInfo);
        }
      } catch (e: any) {
        setChecking(false);
        setModalOpen(true);
        setUpdateAvailable(false);
        setUpdateError(e as ErrorType);
      }
    } else {
      console.error('electronAPI.checkUpdate is not available');
      setChecking(false);
    }
  };

  const onUpdateCanAvailable = useCallback(
    (_event: Electron.IpcRendererEvent | null, arg1: VersionInfo) => {
      setVersionInfo(arg1);
      setUpdateError(undefined);
      if (arg1.update) {
        setModalBtn((state) => ({
          ...state,
          cancelText: 'Cancel',
          okText: 'Update',
          onOk: () => {
            if (window.electronAPI && window.electronAPI.startDownload) {
              window.electronAPI.startDownload();
            }
          },
        }));
        setUpdateAvailable(true);
      } else {
        setUpdateAvailable(false);
      }
    },
    []
  );

  const onUpdateError = useCallback(
    (_event: Electron.IpcRendererEvent | null, arg1: ErrorType) => {
      setUpdateAvailable(false);
      setUpdateError(arg1);
    },
    []
  );

  const onDownloadProgress = useCallback(
    (_event: Electron.IpcRendererEvent | null, arg1: ProgressInfo) => {
      setProgressInfo(arg1);
    },
    []
  );

  const onUpdateDownloaded = useCallback(
    (_event: Electron.IpcRendererEvent | null, ...args: any[]) => {
      setProgressInfo({ percent: 100 });
      setModalBtn((state) => ({
        ...state,
        cancelText: 'Later',
        okText: 'Install now',
        onOk: () => {
          if (window.electronAPI && window.electronAPI.quitAndInstall) {
            window.electronAPI.quitAndInstall();
          }
        },
      }));
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
          event: Electron.IpcRendererEvent,
          ...args: any[]
        ) => void
      );
      unsubscribeUpdateError = window.electronAPI.ipcOn(
        'update-error',
        onUpdateError as (
          event: Electron.IpcRendererEvent,
          ...args: any[]
        ) => void
      );
      unsubscribeDownloadProgress = window.electronAPI.ipcOn(
        'download-progress',
        onDownloadProgress as (
          event: Electron.IpcRendererEvent,
          ...args: any[]
        ) => void
      );
      unsubscribeUpdateDownloaded = window.electronAPI.ipcOn(
        'update-downloaded',
        onUpdateDownloaded as (
          event: Electron.IpcRendererEvent,
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

  return (
    <>
      <Modal
        open={modalOpen}
        cancelText={modalBtn?.cancelText}
        okText={modalBtn?.okText}
        onCancel={modalBtn?.onCancel}
        onOk={modalBtn?.onOk}
        footer={updateAvailable ? /* hide footer */ null : undefined}
      >
        <div className="modal-slot">
          {updateError ? (
            <div>
              <p>Error downloading the latest version.</p>
              <p>{updateError.message}</p>
            </div>
          ) : updateAvailable ? (
            <div>
              <div>The last version is: v{versionInfo?.newVersion}</div>
              <div className="new-version__target">
                v{versionInfo?.version} -&gt; v{versionInfo?.newVersion}
              </div>
              <div className="update__progress">
                <div className="progress__title">Update progress:</div>
                <div className="progress__bar">
                  <Progress percent={progressInfo?.percent}></Progress>
                </div>
              </div>
            </div>
          ) : (
            // Displaying versionInfo or a message if not updating and no error
            <div className="can-not-available">
              {versionInfo
                ? `Current version: v${versionInfo.version}. No update available at the moment.`
                : 'Checking for updates...'}
            </div>
          )}
        </div>
      </Modal>
      <Button variant="outline" disabled={checking} onClick={checkUpdate}>
        {checking ? 'Checking...' : 'Check update'}
      </Button>
    </>
  );
};

export default Update;
