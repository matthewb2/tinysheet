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
const http = __importStar(require("http"));
const DEV_SERVER_URL = 'http://localhost:8080';
function waitForDevServer(url, timeoutMs = 30000) {
    return new Promise((resolve) => {
        const deadline = Date.now() + timeoutMs;
        const attempt = () => {
            const req = http.get(url, (res) => {
                res.resume();
                resolve();
            });
            req.on('error', () => {
                if (Date.now() >= deadline) {
                    resolve();
                }
                else {
                    setTimeout(attempt, 500);
                }
            });
        };
        attempt();
    });
}
let mainWindow = undefined;
let aboutWin = undefined;
const DEFAULT_SETTINGS = { lastFolder: null, recentFiles: [] };
const MAX_RECENT_FILES = 5;
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
let currentFilePath = null;
function setWindowTitle() {
    if (mainWindow) {
        mainWindow.setTitle(currentFilePath ? '타이니시트 - ' + path.basename(currentFilePath) : '타이니시트');
    }
}
function addRecentFile(filePath) {
    settings.recentFiles = [
        filePath,
        ...settings.recentFiles.filter((p) => p !== filePath),
    ].slice(0, MAX_RECENT_FILES);
    saveSettings(settings);
}
function getRecentMenu() {
    if (settings.recentFiles.length === 0) {
        return {
            label: '최근 문서',
            submenu: [{ label: '(없음)', enabled: false }],
        };
    }
    return {
        label: '최근 문서',
        submenu: settings.recentFiles.map((filePath) => ({
            label: path.basename(filePath),
            sublabel: path.dirname(filePath),
            toolTip: filePath,
            click: () => openFileAtPath(filePath),
        })),
    };
}
function buildMenuTemplate() {
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
                    click: () => electron_1.app.quit(),
                },
            ],
        },
        {
            label: '도움말(&H)',
            submenu: [
                {
                    label: '정보(&I)',
                    click: () => {
                        showAboutDialog();
                    }
                }
            ]
        }
    ];
}
function rebuildApplicationMenu() {
    const menu = electron_1.Menu.buildFromTemplate(buildMenuTemplate());
    electron_1.Menu.setApplicationMenu(menu);
    if (process.env.TINY_MENU_DEBUG) {
        const firstMenu = menu.items[0];
        const dump = (firstMenu && firstMenu.submenu ? firstMenu.submenu.items : []).map((i) => i.type === 'separator'
            ? '---'
            : i.type === 'submenu' && i.submenu
                ? i.label + '[' + i.submenu.items.map((s) => s.label).join('|') + ']'
                : i.label);
        console.log('[menu-debug] ' + JSON.stringify(dump));
    }
}
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
    // HTML <title>이 윈도우 타이틀을 덮어쓰지 않도록 막고, 항상 앱 타이틀을 유지한다.
    mainWindow.on('page-title-updated', (event) => {
        event.preventDefault();
        setWindowTitle();
    });
    setWindowTitle();
    mainWindow.on('closed', () => {
        mainWindow = undefined;
    });
    // 개발 모드 여부 확인 후 웹팩 개발 서버 또는 빌드 파일 로드
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    if (isDev) {
        waitForDevServer(DEV_SERVER_URL).then(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.once('did-finish-load', () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.openDevTools(); // 본문 시트 로드 완료 후 개발자 도구 오픈
                    }
                });
                mainWindow.loadURL(DEV_SERVER_URL);
                process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
            }
        });
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
    }
    rebuildApplicationMenu();
}
async function openFileAtPath(filePath) {
    if (!mainWindow || mainWindow.isDestroyed())
        return;
    if (!fs.existsSync(filePath)) {
        settings.recentFiles = settings.recentFiles.filter((p) => p !== filePath);
        saveSettings(settings);
        rebuildApplicationMenu();
        await electron_1.dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: '타이니시트',
            message: '파일을 찾을 수 없습니다.',
            detail: filePath,
        });
        return;
    }
    settings.lastFolder = path.dirname(filePath);
    addRecentFile(filePath);
    currentFilePath = filePath;
    setWindowTitle();
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log('[debug] file content length:', content.length);
    mainWindow.webContents.send('file-opened', content);
    console.log('[debug] file-opened event sent');
    rebuildApplicationMenu();
}
function showAboutDialog() {
    aboutWin = new electron_1.BrowserWindow({
        width: 420,
        height: 400,
        resizable: false,
        icon: path.join(__dirname, '../assets/icon.png'),
        parent: mainWindow,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, '../src/about-preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    aboutWin.setMenuBarVisibility(false);
    aboutWin.loadFile(path.join(__dirname, '../about.html'));
    aboutWin.on('closed', () => {
        aboutWin = undefined;
    });
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
    await openFileAtPath(filePath);
}
async function handleSave() {
    if (!mainWindow)
        return;
    mainWindow.webContents.send('save-requested');
    console.log('[debug] save-requested sent');
}
async function handleSaveAs() {
    if (!mainWindow)
        return;
    mainWindow.webContents.send('save-requested', true);
    console.log('[debug] save-as-requested sent');
}
async function handleSaveCsv(_event, content, isSaveAs) {
    if (!mainWindow)
        return false;
    if (!isSaveAs && currentFilePath) {
        try {
            fs.writeFileSync(currentFilePath, content, 'utf-8');
            console.log('[debug] csv saved (direct):', currentFilePath);
            addRecentFile(currentFilePath);
            rebuildApplicationMenu();
            return true;
        }
        catch (err) {
            console.error('직접 저장 실패 - 대화상자로 전환:', err);
        }
    }
    const defaultPath = currentFilePath ||
        path.join(settings.lastFolder || electron_1.app.getPath('documents'), 'sheet.csv');
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
    currentFilePath = result.filePath;
    settings.lastFolder = path.dirname(result.filePath);
    saveSettings(settings);
    addRecentFile(result.filePath);
    setWindowTitle();
    rebuildApplicationMenu();
    console.log('[debug] csv saved:', result.filePath);
    return true;
}
electron_1.app.whenReady().then(() => {
    settings = loadSettings();
    electron_1.ipcMain.handle('save-csv', handleSaveCsv);
    electron_1.ipcMain.on('close-about', () => {
        if (aboutWin && !aboutWin.isDestroyed()) {
            aboutWin.close();
        }
    });
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
