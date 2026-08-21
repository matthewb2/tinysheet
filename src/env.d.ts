declare module '*.css' {
  const content: string
  export default content
}

interface ElectronAPI {
  onFileOpen: (callback: (content: string) => void) => void
}

interface Window {
  electronAPI?: ElectronAPI
}
