const { app, BrowserWindow, ipcMain, dialog, Tray, Menu } = require('electron');
const path = require('path');
const log = require('electron-log');
const {
    handleStartBgp,
    handleGetNetworkInfo,
    handleSaveBgpConfig,
    handleLoadBgpConfig,
    handleStopBgp,
    getBgpState,
    handleSendRoute,
    handleWithdrawRoute
} = require('./bgpSimulatorApp');
const {
    handleGenerateTemplateString,
    handleSaveStringGeneratorConfig,
    handleLoadStringGeneratorConfig
} = require('./stringGeneratorApp');
const packageJson = require('../../package.json');

// 配置 electron-log
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.maxFiles = 3; // 最多保留3个日志文件
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

const isDev = !app.isPackaged;
let mainWindow = null;

function showAboutDialog() {
    const aboutMessage = `
MiniTools
Version: ${packageJson.version}
Author: ${packageJson.author.name}
Email: ${packageJson.author.email}
Environment: ${isDev ? 'Development' : 'Production'}
Electron: ${process.versions.electron}
Node.js: ${process.versions.node}
Chrome: ${process.versions.chrome}
    `.trim();

    dialog.showMessageBox({
        type: 'info',
        title: 'About MiniTools',
        message: aboutMessage,
        buttons: ['OK']
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 800,
        resizable: false, // 固定大小，不允许调整
        autoHideMenuBar: false, // 显示菜单栏
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

    // 创建菜单
    const template = [
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        showAboutDialog();
                    }
                },
                {
                    label: '开发者选项',
                    accelerator: process.platform === 'darwin' ? 'F12' : 'F12',
                    click: () => {
                        win.webContents.openDevTools();
                    }
                },
                {
                    label: '重新加载',
                    accelerator: process.platform === 'darwin' ? 'F5' : 'F5',
                    click: () => {
                        win.reload();
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    log.info(`Dev ${isDev} __dirname ${__dirname}`);
    const urlLocation = isDev ? 'http://127.0.0.1:3000' : `file://${path.join(__dirname, '../../dist/index.html')}`;
    win.loadURL(urlLocation);

    // 监听窗口关闭事件
    win.on('close', async event => {
        if (getBgpState()) {
            event.preventDefault();
            const { response } = await dialog.showMessageBox(win, {
                type: 'warning',
                title: '确认关闭',
                message: 'BGP 模拟器正在运行，确定要关闭吗？',
                buttons: ['确定', '取消'],
                defaultId: 1,
                cancelId: 1
            });

            if (response === 0) {
                // 用户点击确定，先停止 BGP 然后关闭窗口
                await handleStopBgp();
                win.destroy();
            }
        }
    });

    const tray = new Tray(path.join(__dirname, './assets/icon.ico'));

    mainWindow = win;
}

app.whenReady().then(() => {
    ipcMain.handle('generate-template-string', handleGenerateTemplateString);
    ipcMain.handle('start-bgp', handleStartBgp);
    ipcMain.handle('get-network-info', handleGetNetworkInfo);
    ipcMain.handle('save-bgp-config', handleSaveBgpConfig);
    ipcMain.handle('load-bgp-config', handleLoadBgpConfig);
    ipcMain.handle('save-string-generator-config', handleSaveStringGeneratorConfig);
    ipcMain.handle('load-string-generator-config', handleLoadStringGeneratorConfig);
    ipcMain.handle('stop-bgp', handleStopBgp);
    ipcMain.handle('send-route', handleSendRoute);
    ipcMain.handle('withdraw-route', handleWithdrawRoute);
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
