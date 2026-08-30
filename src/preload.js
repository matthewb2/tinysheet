"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    onFileOpen: (callback) => {
        electron_1.ipcRenderer.on('file-opened', (_event, content) => callback(content));
    },
    onSaveRequested: (callback) => {
        electron_1.ipcRenderer.on('save-requested', (_event, isSaveAs) => callback(!!isSaveAs));
    },
    saveCsv: (content, isSaveAs) => electron_1.ipcRenderer.invoke('save-csv', content, !!isSaveAs),
});
