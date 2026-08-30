"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let mainWindow = null;
let lastRendererMtime = 0;
function watchRendererReload() {
    const target = path.join(__dirname, '../dist/renderer.js');
    setInterval(() => {
        if (!mainWindow || mainWindow.isDestroyed())
            return;
        try {
            const m = fs.statSync(target).mtimeMs;
            if (lastRendererMtime === 0) {
                lastRendererMtime = m;
            }
            else if (m !== lastRendererMtime) {
                lastRendererMtime = m;
                mainWindow.webContents.reload();
            }
        }
        catch {
            // ignore
        }
    }, 1000);
}
const DEFAULT_SETTINGS = { lastFolder: null };
function getSettingsPath() {
    return path.join(electron_1.app.getPath('userData'), 'settings.json');
}
function loadSettings() {
    try {
        const data = fs.readFileSync(getSettingsPath(), 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
    catch {
        return { ...DEFAULT_SETTINGS };
    }
}
function saveSettings(settings) {
    try {
        fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
        fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('설정 저장 실패:', err);
    }
}
let settings = DEFAULT_SETTINGS;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1024,
        height: 700,
        icon: path.join(__dirname, '../assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../src/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    watchRendererReload();
    const menuTemplate = [
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
                { type: 'separator' },
                {
                    label: '종료(&X)',
                    accelerator: 'Alt+F4',
                    click: () => electron_1.app.quit(),
                },
            ],
        },
    ];
    const menu = electron_1.Menu.buildFromTemplate(menuTemplate);
    electron_1.Menu.setApplicationMenu(menu);
}
async function handleOpen() {
    if (!mainWindow)
        return;
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: '파일 열기',
        defaultPath: settings.lastFolder || undefined,
        filters: [
            { name: '텍스트 파일', extensions: ['csv', 'tsv', 'txt'] },
            { name: '모든 파일', extensions: ['*'] },
        ],
        properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0)
        return;
    const filePath = result.filePaths[0];
    console.log('[debug] file chosen:', filePath);
    settings.lastFolder = path.dirname(filePath);
    saveSettings(settings);
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log('[debug] file content length:', content.length);
    mainWindow.webContents.send('file-opened', content);
    console.log('[debug] file-opened event sent');
}
async function handleSave() {
    if (!mainWindow)
        return;
    mainWindow.webContents.send('save-requested');
    console.log('[debug] save-requested sent');
}
async function handleSaveCsv(_event, content) {
    if (!mainWindow)
        return false;
    const defaultPath = path.join(settings.lastFolder || electron_1.app.getPath('documents'), 'sheet.csv');
    const result = await electron_1.dialog.showSaveDialog(mainWindow, {
        title: 'CSV 저장',
        defaultPath,
        filters: [
            { name: 'CSV 파일', extensions: ['csv'] },
            { name: '모든 파일', extensions: ['*'] },
        ],
    });
    if (result.canceled || !result.filePath)
        return false;
    try {
        fs.writeFileSync(result.filePath, content, 'utf-8');
    }
    catch (err) {
        console.error('CSV 저장 실패:', err);
        return false;
    }
    settings.lastFolder = path.dirname(result.filePath);
    saveSettings(settings);
    mainWindow.setTitle('tinysheet - ' + path.basename(result.filePath));
    console.log('[debug] csv saved:', result.filePath);
    return true;
}
electron_1.app.whenReady().then(() => {
    settings = loadSettings();
    electron_1.ipcMain.handle('save-csv', handleSaveCsv);
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
