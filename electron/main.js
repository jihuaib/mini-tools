const { app, BrowserWindow, ipcMain, Tray } = require('electron');
const path = require('path');
const SystemApp = require('./app/systemApp');
const logger = require('./log/logger');

const isDev = !app.isPackaged;
let mainWindow = null;
let systemApp = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 800,
        resizable: false, // 固定大小，不允许调整
        autoHideMenuBar: true, // 显示菜单栏
        frame: true, // 保持原生边框
        center: true, // 窗口居中显示
        backgroundColor: '#ffffff', // 设置背景色，避免加载时闪烁
        icon: path.join(__dirname, './assets/icon.ico'),
        webPreferences: {
            nodeIntegration: false, // 禁用 nodeIntegration 提高安全性
            contextIsolation: true, // 启用 contextIsolation 更好地隔离上下文
            preload: path.join(__dirname, 'preload.js')
        }
    });

    logger.info(`Dev ${isDev} __dirname ${__dirname}`);
    const urlLocation = isDev ? 'http://127.0.0.1:3000' : `file://${path.join(__dirname, '../dist/index.html')}`;
    win.loadURL(urlLocation);

    // 监听窗口关闭事件
    win.on('close', async event => {
        event.preventDefault();

        const closeOk = await systemApp.handleWindowClose();
        if (!closeOk) {
            return;
        }

        win.destroy();
    });

    new Tray(path.join(__dirname, './assets/icon.ico'));

    mainWindow = win;
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // 启动应用
    systemApp = new SystemApp(ipcMain, mainWindow);
    // 兼容性检查
    const checkVersionOk = systemApp.checkVersionCompatibility();
    if (!checkVersionOk) {
        app.quit();
        return;
    }
    // 加载设置
    systemApp.loadSettings();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
