import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: '파일(&F)',
      submenu: [
        {
          label: '열기(&O)',
          accelerator: 'CmdOrCtrl+O',
          click: handleOpen,
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
    filters: [
      { name: '텍스트 파일', extensions: ['csv', 'tsv', 'txt'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) return

  const filePath = result.filePaths[0]
  const content = fs.readFileSync(filePath, 'utf-8')
  mainWindow.webContents.send('file-opened', content)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
