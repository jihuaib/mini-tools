const { app, BrowserWindow, ipcMain, Tray } = require('electron');
const path = require('path');
const BgpApp = require('./app/bgpApp');
const ToolsApp = require('./app/toolsApp');
const BmpApp = require('./app/bmpApp');
const RpkiApp = require('./app/rpkiApp');
const SystemMenuApp = require('./app/systemMenuApp');
const Store = require('electron-store');
const logger = require('./log/logger');

const isDev = !app.isPackaged;
let mainWindow = null;

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

    logger.info(`Dev ${isDev} __dirname ${__dirname}`);
    const urlLocation = isDev ? 'http://127.0.0.1:3000' : `file://${path.join(__dirname, '../dist/index.html')}`;
    win.loadURL(urlLocation);

    // 监听窗口关闭事件
    win.on('close', async event => {
        event.preventDefault();
        // 关闭窗口前检查BGP和BMP服务器
        const closeBgpOk = await bgpApp.handleWindowClose(win);
        if (!closeBgpOk) return;

        // const closeBmpOk = await bmpEmulatorApp.handleWindowClose(win);
        // if (!closeBmpOk) return;

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

    const store = new Store({
        name: 'Program Data',
        fileExtension: 'json',
        cwd: app.getPath('userData')
    });

    bgpApp = new BgpApp(ipcMain, store);
    const toolsApp = new ToolsApp(ipcMain, store);
    new BmpApp(ipcMain, store);
    new RpkiApp(ipcMain, store);

    // 加载设置
    const systemMenuApp = new SystemMenuApp(ipcMain, mainWindow, toolsApp);
    systemMenuApp.loadSettings(toolsApp);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
