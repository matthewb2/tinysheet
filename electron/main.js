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
function waitForDevServer(url) {
    return new Promise((resolve) => {
        let connected = false;
        const attempt = () => {
            const req = http.get(url, (res) => {
                res.resume();
                connected = true;
                resolve(connected);
            });
            req.on('error', () => {
                if (connected) {
                    resolve(connected);
                }
                else {
                    setTimeout(attempt, 1000);
                }
            });
            req.setTimeout(3000, () => {
                req.destroy();
                setTimeout(attempt, 1000);
            });
        };
        attempt();
    });
}
async function loadDevServer(win, url) {
    const connected = await waitForDevServer(url);
    if (!connected) {
        console.warn('[dev] 웹팩 개발 서버 미기동 - 그래도 로드 시도');
    }
    // 로드 실패(ERR_CONNECTION_REFUSED 등) 시 최대 60회 재시도
    for (let attempt = 0; attempt < 60; attempt++) {
        try {
            await win.webContents.loadURL(url);
            return true;
        }
        catch (err) {
            console.warn(`[dev] loadURL 실패(${attempt + 1}회): ${err.message}`);
            await new Promise((r) => setTimeout(r, 1000));
        }
    }
    return false;
}
// 본문이 뜨기 전(개발 서버 대기·번들 초기화)에는 창이 비어 보이므로 스피너를 띄운다.
// 배포 파일 목록에 추가하지 않아도 되도록 data URL 로 그린다.
function loadingScreenHtml(message, isError) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>타이니시트</title>
<style>
  html, body { height: 100%; margin: 0; background: #fff; }
  .loading {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    font-family: "Malgun Gothic", "맑은 고딕", sans-serif; color: #555;
  }
  .spinner {
    width: 34px; height: 34px; border: 3px solid #e4e4e4; border-top-color: #4a90d9;
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  .spinner.is-error { animation: none; border-top-color: #d9534f; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .message { font-size: 13px; }
</style>
</head>
<body>
  <div class="loading">
    <div class="spinner${isError ? ' is-error' : ''}"></div>
    <div class="message">${message}</div>
  </div>
</body>
</html>`;
}
function showLoadingScreen(win, message, isError = false) {
    const html = loadingScreenHtml(message, isError);
    return win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
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
            label: '편집(&E)',
            submenu: [
                {
                    label: '실행취소(&U)',
                    accelerator: 'CmdOrCtrl+Z',
                    click: () => {
                        //showAboutDialog();
                    }
                },
                {
                    label: '잘라내기(&I)',
                    accelerator: 'CmdOrCtrl+X',
                    click: () => {
                        //showAboutDialog();
                    }
                },
                {
                    label: '복사(&C)',
                    accelerator: 'CmdOrCtrl+C',
                    click: () => {
                        //showAboutDialog();
                    }
                },
                {
                    label: '붙여넣기(&P)',
                    accelerator: 'CmdOrCtrl+V',
                    click: () => {
                        //showAboutDialog();
                    }
                }
            ]
        },
        {
            label: '도움말(&H)',
            submenu: [
                {
                    label: '정보(&I)',
                    accelerator: 'F1',
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
    const win = mainWindow;
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
    // 본문이 뜨기 전에 스피너를 띄운다. 개발 서버 대기 중 창이 비어 보이지 않도록
    // 스피너 로드가 끝난 뒤 본문을 로드한다.
    showLoadingScreen(win, isDev ? '개발 서버에 연결하는 중...' : '시트를 불러오는 중...')
        .then(async () => {
        if (win.isDestroyed())
            return;
        if (isDev) {
            win.webContents.once('did-finish-load', () => {
                if (!win.isDestroyed())
                    win.webContents.openDevTools(); // 본문 시트 로드 완료 후 개발자 도구 오픈
            });
            const loaded = await loadDevServer(win, DEV_SERVER_URL);
            if (!loaded && !win.isDestroyed()) {
                await showLoadingScreen(win, '개발 서버에 연결하지 못했습니다. npm run dev:renderer 를 실행해 주세요.', true);
            }
        }
        else {
            await win.loadFile(path.join(__dirname, '../dist/index.html'));
        }
    })
        .catch((err) => console.error('[load] 초기 로드 실패:', err));
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
