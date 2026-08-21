import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpen: (callback: (content: string) => void) => {
    ipcRenderer.on('file-opened', (_event, content) => callback(content))
  },
})
