import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpen: (callback: (content: string) => void) => {
    ipcRenderer.on('file-opened', (_event, content) => callback(content))
  },
  onSaveRequested: (callback: (isSaveAs: boolean) => void) => {
    ipcRenderer.on('save-requested', (_event, isSaveAs) => callback(!!isSaveAs))
  },
  saveCsv: (content: string, isSaveAs?: boolean): Promise<boolean> =>
    ipcRenderer.invoke('save-csv', content, !!isSaveAs),
})
