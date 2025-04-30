const { app, BrowserWindow, ipcMain, Tray } = require('electron');
const path = require('path');
const log = require('electron-log');
const BgpApp = require('./app/bgpApp');
const StringGeneratorApp = require('./app/stringGeneratorApp');
const bmpEmulatorApp = require('./app/bmpEmulatorApp');
const SystemMenuApp = require('./app/systemMenuApp');
const Store = require('electron-store');
// 配置 electron-log
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.maxFiles = 3; // 最多保留3个日志文件
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

const isDev = !app.isPackaged;
let mainWindow = null;

let stringGeneratorApp = null;
let bgpApp = null;

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

    log.info(`Dev ${isDev} __dirname ${__dirname}`);
    const urlLocation = isDev ? 'http://127.0.0.1:3000' : `file://${path.join(__dirname, '../dist/index.html')}`;
    win.loadURL(urlLocation);

    // 监听窗口关闭事件
    win.on('close', async event => {
        event.preventDefault();
        // Check both BGP and BMP servers before closing
        const closeBgpOk = await bgpApp.handleWindowClose(win);
        if (!closeBgpOk) return;

        // const closeBmpOk = await bmpEmulatorApp.handleWindowClose(win);
        // if (!closeBmpOk) return;

        win.destroy();
    });

    const tray = new Tray(path.join(__dirname, './assets/icon.ico'));

    mainWindow = win;

    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    const store = new Store({
        name: 'Program Data',
        fileExtension: 'json',
        cwd: app.getPath('userData')
    });
    bgpApp = new BgpApp(ipcMain, store);
    stringGeneratorApp = new StringGeneratorApp(ipcMain, store);
    systemMenuApp = new SystemMenuApp(ipcMain, mainWindow);
    bmpEmulatorApp.registerHandlers(ipcMain);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
