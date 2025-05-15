import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

import './index.css';

// Global error handler for the renderer process
window.onerror = (message, source, lineno, colno, error) => {
  if (
    window.electronAPI &&
    typeof window.electronAPI.sendToMainLog === 'function'
  ) {
    window.electronAPI.sendToMainLog('error', 'Unhandled error in renderer:', {
      message,
      source,
      lineno,
      colno,
      error,
    });
  } else {
    // Fallback se electronAPI non è disponibile per qualche motivo (improbabile ma sicuro)
    console.error(
      'Unhandled error in renderer (electronAPI.sendToMainLog not available):',
      { message, source, lineno, colno, error }
    );
  }
  // Prevent default handling
  return true;
};

import './demos/ipc';
// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

postMessage({ payload: 'removeLoading' }, '*');
