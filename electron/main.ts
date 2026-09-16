import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'

const DEV_SERVER_URL = 'http://localhost:8080'

function waitForDevServer(url: string, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() >= deadline) {
          resolve()
        } else {
          setTimeout(attempt, 500)
        }
      })
    }
    attempt()
  })
}

let mainWindow: BrowserWindow | null = null

interface Settings {
  lastFolder: string | null
  recentFiles: string[]
}

const DEFAULT_SETTINGS: Settings = { lastFolder: null, recentFiles: [] }
const MAX_RECENT_FILES = 5

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
    mainWindow.setTitle(currentFilePath ? '타이니시트 - ' + path.basename(currentFilePath) : '타이니시트')
  }
}

function addRecentFile(filePath: string) {
  settings.recentFiles = [
    filePath,
    ...settings.recentFiles.filter((p) => p !== filePath),
  ].slice(0, MAX_RECENT_FILES)
  saveSettings(settings)
}

function getRecentMenu(): Electron.MenuItemConstructorOptions {
  if (settings.recentFiles.length === 0) {
    return {
      label: '최근 문서',
      submenu: [{ label: '(없음)', enabled: false }],
    }
  }
  return {
    label: '최근 문서',
    submenu: settings.recentFiles.map((filePath) => ({
      label: path.basename(filePath),
      sublabel: path.dirname(filePath),
      toolTip: filePath,
      click: () => openFileAtPath(filePath),
    })),
  }
}

function buildMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  return [
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
        getRecentMenu(),
        { type: 'separator' },
        {
          label: '종료(&X)',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
  ]
}

function rebuildApplicationMenu() {
  const menu = Menu.buildFromTemplate(buildMenuTemplate())
  Menu.setApplicationMenu(menu)
  if (process.env.TINY_MENU_DEBUG) {
    const firstMenu = menu.items[0]
    const dump = (firstMenu && firstMenu.submenu ? firstMenu.submenu.items : []).map((i) =>
      i.type === 'separator'
        ? '---'
        : i.type === 'submenu' && i.submenu
          ? i.label + '[' + i.submenu.items.map((s) => s.label).join('|') + ']'
          : i.label
    )
    console.log('[menu-debug] ' + JSON.stringify(dump))
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

  // HTML <title>이 윈도우 타이틀을 덮어쓰지 않도록 막고, 항상 앱 타이틀을 유지한다.
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    setWindowTitle()
  })
  setWindowTitle()

  // 개발 모드 여부 확인 후 웹팩 개발 서버 또는 빌드 파일 로드
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    waitForDevServer(DEV_SERVER_URL).then(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.once('did-finish-load', () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.openDevTools() // 본문 시트 로드 완료 후 개발자 도구 오픈
          }
        })
        mainWindow.loadURL(DEV_SERVER_URL)
        process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
      }
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
  }

  rebuildApplicationMenu()
}

async function openFileAtPath(filePath: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return

  if (!fs.existsSync(filePath)) {
    settings.recentFiles = settings.recentFiles.filter((p) => p !== filePath)
    saveSettings(settings)
    rebuildApplicationMenu()
    await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '타이니시트',
      message: '파일을 찾을 수 없습니다.',
      detail: filePath,
    })
    return
  }

  settings.lastFolder = path.dirname(filePath)
  addRecentFile(filePath)
  currentFilePath = filePath
  setWindowTitle()

  const content = fs.readFileSync(filePath, 'utf-8')
  console.log('[debug] file content length:', content.length)
  mainWindow.webContents.send('file-opened', content)
  console.log('[debug] file-opened event sent')
  rebuildApplicationMenu()
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
  await openFileAtPath(filePath)
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
      addRecentFile(currentFilePath)
      rebuildApplicationMenu()
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
  addRecentFile(result.filePath)
  setWindowTitle()
  rebuildApplicationMenu()
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