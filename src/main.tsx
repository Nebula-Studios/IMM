import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import './index.css';

const handleGlobalError = (
  message: any,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error
) => {
  const errorData = { message, source, lineno, colno, error };

  if (window.electronAPI?.sendToMainLog) {
    window.electronAPI.sendToMainLog(
      'error',
      'Unhandled error in renderer:',
      errorData
    );
  } else {
    console.error(
      'Unhandled error in renderer (electronAPI.sendToMainLog not available):',
      errorData
    );
  }

  return true;
};

window.onerror = handleGlobalError;

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

postMessage({ payload: 'removeLoading' }, '*');
