# Workflow: Debugging Electron Application

## Obiettivo
Fornire un processo strutturato per il debugging di problemi nell'applicazione Electron

## Trigger
- Bug reports da utenti
- Comportamenti inaspettati
- Crash dell'applicazione
- Performance issues

## Steps

### 1. Identificazione del Problema
```typescript
// Categorizzare il problema:
// - Main process issue
// - Renderer process issue  
// - IPC communication issue
// - File system / path issue
// - Performance issue
```

### 2. Setup Debug Environment
```bash
# Avviare in modalità development
npm run dev

# Avviare con debugging abilitato
npm run electron:dev -- --inspect

# Per debug del main process
npm run electron:dev -- --inspect-brk=5858
```

### 3. Browser DevTools per Renderer
```typescript
// Nel main process, abilitare DevTools
if (isDev) {
  mainWindow.webContents.openDevTools();
}

// Oppure da menu: View > Toggle Developer Tools
```

### 4. Main Process Debugging
```typescript
// Aggiungere breakpoints nel codice
debugger;

// Usare console.log strategici
console.log('[MAIN]', 'Debug info:', data);

// Connettere Chrome DevTools:
// chrome://inspect in Chrome
// Cliccare su "Open dedicated DevTools for Node"
```

### 5. IPC Communication Debug
```typescript
// Nel main process
ipcMain.handle('debug-channel', (event, data) => {
  console.log('[IPC Main]', 'Received:', data);
  return { success: true, timestamp: Date.now() };
});

// Nel renderer
window.electronAPI.invoke('debug-channel', testData)
  .then(result => console.log('[IPC Renderer]', result));
```

### 6. File System Issues
```typescript
// Verificare path resolution
const path = require('path');
console.log('App path:', app.getAppPath());
console.log('User data:', app.getPath('userData'));
console.log('Resolved path:', path.resolve(relativePath));

// Verificare permessi
const fs = require('fs');
try {
  fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
  console.log('File accessible');
} catch (error) {
  console.error('File access error:', error);
}
```

### 7. Performance Profiling
```typescript
// Renderer process profiling
performance.mark('start-operation');
// ... operazione da misurare
performance.mark('end-operation');
performance.measure('operation-time', 'start-operation', 'end-operation');

// Main process profiling
const { performance } = require('perf_hooks');
const startTime = performance.now();
// ... operazione da misurare
const endTime = performance.now();
console.log(`Operation took ${endTime - startTime} milliseconds`);
```

### 8. Error Handling e Logging
```typescript
// Global error handling nel main process
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
});

// Error handling nel renderer
window.addEventListener('error', (event) => {
  console.error('[RENDERER ERROR]', event.error);
});

// Promise rejection handling
window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED PROMISE REJECTION]', event.reason);
});
```

### 9. Build Issues Debug
```bash
# Debug build process
npm run build -- --verbose

# Verificare bundle analyzer
npm install --save-dev webpack-bundle-analyzer
# Aggiungere script per analizzare bundle

# Test build locale
npm run electron:build
# Testare l'eseguibile generato
```

### 10. Auto-updater Debug
```typescript
// Nel main process
const { autoUpdater } = require('electron-updater');

autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'debug';

autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('error', (error) => {
  console.error('Auto-updater error:', error);
});
```

## Common Issues e Soluzioni

### Path Resolution Problems
```typescript
// Usare sempre path.join per costruire paths
const filePath = path.join(app.getPath('userData'), 'config.json');

// Per risorse app, usare app.getAppPath()
const resourcePath = path.join(app.getAppPath(), 'resources', 'file.txt');
```

### IPC Communication Fails
```typescript
// Verificare che il preload script sia caricato
// Verificare security settings
webSecurity: false, // Solo per development!

// Controllare che le API siano esposte correttamente nel preload
contextIsolation: true,
enableRemoteModule: false,
preload: path.join(__dirname, 'preload.js')
```

### Performance Issues
```typescript
// Evitare operazioni sincrone nel renderer
// Usare IPC per operazioni file system pesanti
// Implementare virtual scrolling per liste grandi
// Usare React.memo e useMemo appropriatamente
```

## Tools Utili
- Chrome DevTools (F12)
- Electron DevTools Extension
- React DevTools
- electron-log per logging avanzato
- electron-debug per helpers di debug

## Checklist Debug
- [ ] Problema categorizzato correttamente
- [ ] Environment di debug configurato
- [ ] DevTools aperti e configurati
- [ ] Logging appropriato aggiunto
- [ ] Steps per riprodurre il bug documentati
- [ ] Fix testato in development
- [ ] Fix testato in build
- [ ] Regression tests aggiunti
