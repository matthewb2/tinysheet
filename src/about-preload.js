const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aboutAPI', {
  close: () => ipcRenderer.send('close-about')
});