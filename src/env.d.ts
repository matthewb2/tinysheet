declare module '*.css' {
  const content: string
  export default content
}

interface ElectronAPI {
  onFileOpen: (callback: (content: string) => void) => void
  onSaveRequested: (callback: (isSaveAs: boolean) => void) => void
  saveCsv: (content: string, isSaveAs?: boolean) => Promise<boolean>
}

interface Window {
  electronAPI?: ElectronAPI
}
