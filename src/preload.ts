import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpen: (callback: (content: string) => void) => {
    ipcRenderer.on('file-opened', (_event, content) => callback(content))
  },
  onSaveRequested: (callback: () => void) => {
    ipcRenderer.on('save-requested', () => callback())
  },
  saveCsv: (content: string): Promise<boolean> => ipcRenderer.invoke('save-csv', content),
})
