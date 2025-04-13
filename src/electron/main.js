const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os')
const { Worker } = require('worker_threads');
const {runWorkerWithPromise} = require("./worker/runWorkerWithPromise");

const isDev = !app.isPackaged;

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 800,
        resizable: false, // 固定大小，不允许调整
        autoHideMenuBar: true, // 隐藏菜单栏
        frame: true, // 如果你想要一个原生边框，保留为 true；设置为 false 是无边框窗口
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

async function handleGenerateTemplateString(event, templateData) {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    console.log('[Main] handleGenerateTemplateString', templateData);

    try {
        const result = await runWorkerWithPromise(
            path.join(__dirname, './worker/StringGeneratorWorker.js'),
            templateData
        );
        console.log('[Main] Worker处理结果:', result);
        return result;
    } catch (err) {
        console.log('[Main] Worker处理结果:', err);
        return err;
    }
}

function handleStartBgp(event, bgpData){
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    console.log('[Main] handleStartBgp', bgpData);

    const workerPath = path.join(__dirname, './worker/bgpSimulatorWorker.js');
    const worker = new Worker(workerPath);

    console.log(`[Worker ${worker.threadId}] 启动`);

    worker.postMessage(bgpData);

    // 持续接收 BGP 线程的消息
    worker.on('message', (result) => {
        console.log(`[Worker ${worker.threadId}] 处理成功`, result);
        webContents.send('update-bgp-data', { status: 'success', msg: '', data:result }); // 直接转发给渲染进程
    });

    worker.on('error', (err) => {
        console.error(`[Worker ${worker.threadId}] 发生错误:`, err);
        webContents.send('update-bgp-data', { status: 'error', msg: err.message }); // 直接转发给渲染进程
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`[Worker ${worker.threadId}] 退出异常，退出码:`, code);
            webContents.send('update-bgp-data', {
                status: 'error',
                msg: `Worker stopped with exit code ${code}`,
            });
        } else {
            console.log(`[Worker ${worker.threadId}] has completed successfully.`);
        }
    });
}

app.whenReady().then(() => {
    ipcMain.handle('generate-template-string', handleGenerateTemplateString)
    ipcMain.on('start-bgp', handleStartBgp)
    const win = createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// 监听渲染进程请求网卡信息
ipcMain.handle('get-network-info', async () => {
    let interfaces;
    interfaces = os.networkInterfaces();
    return interfaces;
})