import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null
let lastRendererMtime = 0

function watchRendererReload() {
  const target = path.join(__dirname, '../dist/renderer.js')
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    try {
      const m = fs.statSync(target).mtimeMs
      if (lastRendererMtime === 0) {
        lastRendererMtime = m
      } else if (m !== lastRendererMtime) {
        lastRendererMtime = m
        mainWindow.webContents.reload()
      }
    } catch {
      // ignore
    }
  }, 1000)
}

interface Settings {
  lastFolder: string | null
}

const DEFAULT_SETTINGS: Settings = { lastFolder: null }

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): Settings {
  try {
    const data = fs.readFileSync(getSettingsPath(), 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: Settings) {
  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true })
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    console.error('설정 저장 실패:', err)
  }
}

let settings: Settings = DEFAULT_SETTINGS

let currentFilePath: string | null = null

function setWindowTitle() {
  if (mainWindow) {
    mainWindow.setTitle(currentFilePath ? 'tinysheet - ' + path.basename(currentFilePath) : 'tinysheet')
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 700,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  watchRendererReload()

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: '파일(&F)',      
      submenu: [
        {
          label: '열기(&O)',
          accelerator: 'CmdOrCtrl+O',
          click: handleOpen,
        },
        {
          label: '저장(&S)',
          accelerator: 'CmdOrCtrl+S',
          click: handleSave,
        },
        {
          label: '다른 이름으로 저장(&A)',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: handleSaveAs,
        },
        { type: 'separator' },
        {
          label: '종료(&X)',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
}

async function handleOpen() {
  if (!mainWindow) return

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '파일 열기',
    defaultPath: settings.lastFolder || undefined,
    filters: [
      { name: '텍스트 파일', extensions: ['csv', 'tsv', 'txt'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) return

  const filePath = result.filePaths[0]
  console.log('[debug] file chosen:', filePath)
  settings.lastFolder = path.dirname(filePath)
  saveSettings(settings)
  currentFilePath = filePath
  setWindowTitle()

  const content = fs.readFileSync(filePath, 'utf-8')
  console.log('[debug] file content length:', content.length)
  mainWindow.webContents.send('file-opened', content)
  console.log('[debug] file-opened event sent')
}

async function handleSave() {
  if (!mainWindow) return
  mainWindow.webContents.send('save-requested')
  console.log('[debug] save-requested sent')
}

async function handleSaveAs() {
  if (!mainWindow) return
  mainWindow.webContents.send('save-requested', true)
  console.log('[debug] save-as-requested sent')
}

async function handleSaveCsv(
  _event: Electron.IpcMainInvokeEvent,
  content: string,
  isSaveAs: boolean
): Promise<boolean> {
  if (!mainWindow) return false

  if (!isSaveAs && currentFilePath) {
    try {
      fs.writeFileSync(currentFilePath, content, 'utf-8')
      console.log('[debug] csv saved (direct):', currentFilePath)
      return true
    } catch (err) {
      console.error('직접 저장 실패 - 대화상자로 전환:', err)
    }
  }

  const defaultPath =
    currentFilePath ||
    path.join(settings.lastFolder || app.getPath('documents'), 'sheet.csv')
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'CSV 저장',
    defaultPath,
    filters: [
      { name: 'CSV 파일', extensions: ['csv'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  })

  if (result.canceled || !result.filePath) return false

  try {
    fs.writeFileSync(result.filePath, content, 'utf-8')
  } catch (err) {
    console.error('CSV 저장 실패:', err)
    return false
  }

  currentFilePath = result.filePath
  settings.lastFolder = path.dirname(result.filePath)
  saveSettings(settings)
  setWindowTitle()
  console.log('[debug] csv saved:', result.filePath)
  return true
}

app.whenReady().then(() => {
  settings = loadSettings()
  ipcMain.handle('save-csv', handleSaveCsv)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
