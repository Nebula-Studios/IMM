if (window.electronAPI && typeof window.electronAPI.ipcOn === 'function') {
  window.electronAPI.ipcOn('main-process-message', (_event, ...args) => {
    console.log(
      '[Receive Main-process message via electronAPI.ipcOn]:',
      ...args
    );
  });
} else {
  console.warn(
    'window.electronAPI.ipcOn is not available to set up main-process-message listener.'
  );
}
