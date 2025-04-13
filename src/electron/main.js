const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os')
const {handleStartBgp, handleGetNetworkInfo } = require("./bgpSimulatorApp");
const {handleGenerateTemplateString} = require("./stringGeneratorApp");

const isDev = !app.isPackaged;

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 800,
        resizable: false, // 固定大小，不允许调整
        autoHideMenuBar: true, // 隐藏菜单栏
        frame: true, // 保持原生边框
        center: true, // 窗口居中显示
        backgroundColor: '#ffffff', // 设置背景色，避免加载时闪烁
        webPreferences: {
            nodeIntegration: false, // 禁用 nodeIntegration 提高安全性
            contextIsolation: true, // 启用 contextIsolation 更好地隔离上下文
            preload: path.join(__dirname, 'preload.js')
        },
    });

    if (isDev) {
        win.loadURL('http://127.0.0.1:3000');
    } else {
        win.loadFile(path.join(__dirname, 'dist/index.html'));
    }

    // 打开调试工具
    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    ipcMain.handle('generate-template-string', handleGenerateTemplateString);
    ipcMain.on('start-bgp', handleStartBgp);
    ipcMain.handle('get-network-info', handleGetNetworkInfo);
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});