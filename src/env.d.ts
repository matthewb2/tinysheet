declare module '*.css' {
  const content: string
  export default content
}

interface ElectronAPI {
  onFileOpen: (callback: (content: string) => void) => void
  onSaveRequested: (callback: () => void) => void
  saveCsv: (content: string) => Promise<boolean>
}

interface Window {
  electronAPI?: ElectronAPI
}
