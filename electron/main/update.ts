import { app, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import type {
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from 'electron-updater'

const { autoUpdater } = createRequire(import.meta.url)('electron-updater');

export function update(win: Electron.BrowserWindow) {

  // When set to false, the update download will be triggered through the API
  autoUpdater.autoDownload = false
  autoUpdater.disableWebInstaller = false
  autoUpdater.allowDowngrade = false
  autoUpdater.autoInstallOnAppQuit = false // Impedisce l'installazione automatica all'uscita

  // Gestore di errori globale per autoUpdater
  autoUpdater.on('error', (error: Error) => {
    win.webContents.send('update-error', { message: `Update error: ${error.message}`, error });
  });

  // start check
  autoUpdater.on('checking-for-update', function () { })
  // update available
  autoUpdater.on('update-available', (arg: UpdateInfo) => {
    win.webContents.send('update-can-available', { update: true, version: app.getVersion(), newVersion: arg?.version })
  })
  // update not available
  autoUpdater.on('update-not-available', (arg: UpdateInfo) => {
    win.webContents.send('update-can-available', { update: false, version: app.getVersion(), newVersion: arg?.version })
  })

  // Checking for updates
  ipcMain.handle('check-update', async () => {
    if (!app.isPackaged) {
      const error = new Error('The update feature is only available after the package.')
      return { message: error.message, error }
    }

    try {
      return await autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      return { message: 'Network error', error }
    }
  })

  // GitHub update check for development
  ipcMain.handle('check-update-from-github', async () => {
    try {
      const response = await fetch('https://api.github.com/repos/Nebula-Studios/IMM/releases/latest');
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, ''); // Rimuove il 'v' se presente
      const currentVersion = app.getVersion();
      
      // Confronta le versioni (semplice confronto stringa, può essere migliorato)
      const hasUpdate = latestVersion !== currentVersion;
      
      return {
        success: true,
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to check GitHub releases',
      };
    }
  })

  // Start downloading and feedback on progress
  ipcMain.handle('start-download', (event: Electron.IpcMainInvokeEvent) => {
    startDownload(
      (error, progressInfo) => {
        if (error) {
          // feedback download error message
          event.sender.send('update-error', { message: error.message, error })
        } else {
          // feedback update progress message
          event.sender.send('download-progress', progressInfo)
        }
      },
      () => {
        // feedback update downloaded message
        event.sender.send('update-downloaded')
      }
    )
  })

  // Install now
  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

function startDownload(
  callback: (error: Error | null, info: ProgressInfo | null) => void,
  complete: (event: UpdateDownloadedEvent) => void,
) {
  autoUpdater.on('download-progress', (info: ProgressInfo) => callback(null, info))
  autoUpdater.on('error', (error: Error) => callback(error, null))
  autoUpdater.on('update-downloaded', complete)
  autoUpdater.downloadUpdate()
}
