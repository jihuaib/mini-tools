const { app, BrowserWindow, ipcMain, Tray } = require('electron');
const path = require('path');
const SystemApp = require('./app/systemApp');
const logger = require('./log/logger');
const { getIconPath } = require('./utils/iconUtils');

const isDev = !app.isPackaged;
let mainWindow = null;
let splashWindow = null;
let systemApp = null;

app.commandLine.appendSwitch('lang', 'zh-CN');

function createSplashWindow() {
    const splash = new BrowserWindow({
        width: 600,
        height: 500,
        transparent: true,
        frame: false,
        resizable: false,
        center: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splash.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow = splash;
    return splash;
}

function createWindow() {
    const win = new BrowserWindow({
        minWidth: 1000, // 最小宽度
        minHeight: 800, // 最小高度
        resizable: true, // 允许调整大小
        maximizable: true, // 允许最大化
        fullscreen: false, // 取消全屏启动
        autoHideMenuBar: true, // 显示菜单栏
        frame: true, // 保持原生边框
        center: true, // 窗口居中显示
        backgroundColor: '#ffffff', // 设置背景色，避免加载时闪烁
        show: false, // 先隐藏窗口，等待启动完成
        icon: getIconPath(),
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

    new Tray(getIconPath());

    mainWindow = win;

    if (isDev) {
        win.webContents.openDevTools();
    }
}

// 更新启动进度
function updateSplashProgress(progress, text) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.executeJavaScript(`window.updateProgress(${progress}, '${text}')`);
    }
}

// 完成启动，显示主窗口
function finishStartup() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.maximize();
        mainWindow.show();

        // 延迟关闭启动窗口，确保主窗口已完全显示
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
                splashWindow = null;
            }
        }, 500);
    }
}

app.whenReady().then(async () => {
    // 创建启动窗口
    createSplashWindow();
    updateSplashProgress(10, '正在初始化应用...');

    // 延迟创建主窗口，让启动窗口先显示
    await new Promise(resolve => setTimeout(resolve, 1000));

    createWindow();
    updateSplashProgress(20, '正在加载主窗口...');

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // 启动应用
    systemApp = new SystemApp(ipcMain, mainWindow, updateSplashProgress);
    updateSplashProgress(30, '正在检查版本兼容性...');

    // 兼容性检查
    const checkVersionOk = systemApp.checkVersionCompatibility();
    if (!checkVersionOk) {
        if (splashWindow) splashWindow.close();
        app.quit();
        return;
    }

    updateSplashProgress(50, '正在加载设置...');
    // 加载设置
    systemApp.loadSettings();

    updateSplashProgress(80, '正在初始化服务...');
    // 等待主窗口内容加载完成
    await new Promise(resolve => setTimeout(resolve, 500));

    updateSplashProgress(100, '启动完成');
    // 延迟一下让用户看到100%
    await new Promise(resolve => setTimeout(resolve, 300));

    // 完成启动
    finishStartup();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
