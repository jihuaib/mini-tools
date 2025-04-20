const { app, BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { successResponse, errorResponse } = require('./utils/responseUtils');
const { BMP_OPERATIONS } = require('./const/operations');

let bmpServerRunning = false;
let worker;
const isDev = !app.isPackaged;

async function handleGetNetworkInfo(event) {
    try {
        const interfaces = os.networkInterfaces();
        return successResponse(interfaces);
    } catch (err) {
        return errorResponse('Failed to get network interfaces', err);
    }
}

function getConfigPath() {
    return path.join(app.getPath('userData'), 'bmp-server-config.json');
}

async function handleSaveConfig(event, config) {
    try {
        const configPath = getConfigPath();
        const configDir = path.dirname(configPath);

        if (!fs.existsSync(configDir)) {
            await fs.promises.mkdir(configDir, { recursive: true });
        }

        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
        return successResponse(null, '');
    } catch (error) {
        log.error('[Main] Error saving BMP config:', error);
        return errorResponse(error.message);
    }
}

async function handleLoadConfig() {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return successResponse(null, 'BMP配置文件不存在');
        }

        const data = await fs.promises.readFile(configPath, 'utf8');
        return successResponse(JSON.parse(data), 'BMP配置文件加载成功');
    } catch (error) {
        log.error('[Main] Error loading BMP config:', error);
        return errorResponse(error.message);
    }
}

// Get server status
async function handleGetServerStatus() {
    try {
        if (!bmpServerRunning) {
            return successResponse({ running: false });
        }

        // Send a message to the worker to get the current configuration
        return successResponse({
            running: bmpServerRunning
            // You can add more information here if needed
        });
    } catch (error) {
        log.error('[Main] Error getting BMP server status:', error);
        return errorResponse(error.message);
    }
}

// Start BMP server
async function handleStartServer(event, config) {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);

    if (bmpServerRunning) {
        log.error('[Main] BMP服务器已经在运行');
        return errorResponse('BMP服务器已经在运行');
    }

    log.info('[Main] Starting BMP server with config:', config);

    const workerPath = isDev
        ? path.join(__dirname, './worker/bmpEmulatorWorker.js')
        : path.join(process.resourcesPath, 'app.asar.unpacked', 'electron/worker/bmpEmulatorWorker.js');

    try {
        worker = new Worker(workerPath);

        bmpServerRunning = true;

        const msg = {
            op: BMP_OPERATIONS.START_SERVER,
            data: config
        };

        worker.postMessage(msg);

        worker.on('message', async result => {
            log.info(`[Main] Received message from BMP worker ${worker.threadId}:`, result);

            if (result.status === 'success') {
                const { op, data } = result.data;

                switch (op) {
                    case BMP_OPERATIONS.PEER_CONNECTED:
                    case BMP_OPERATIONS.PEER_DISCONNECTED:
                        webContents.send('bmp-emulator:peerUpdate', data);
                        break;

                    case BMP_OPERATIONS.ROUTE_ANNOUNCED:
                    case BMP_OPERATIONS.ROUTE_WITHDRAWN:
                        webContents.send('bmp-emulator:routeUpdate', data);
                        break;

                    case BMP_OPERATIONS.SERVER_LOG:
                        webContents.send('bmp-emulator:serverLog', data);
                        break;

                    case BMP_OPERATIONS.INITIATION_RECEIVED:
                        webContents.send('bmp-emulator:initiationReceived', data);
                        break;

                    case BMP_OPERATIONS.STOP_SERVER:
                        await worker.terminate();
                        bmpServerRunning = false;
                        webContents.send('bmp-emulator:serverLog', {
                            type: 'warning',
                            message: 'BMP服务器已停止'
                        });
                        break;
                }
            } else {
                log.error(`[Main] Received error from BMP worker ${worker.threadId}:`, result);
                webContents.send('bmp-emulator:serverLog', {
                    type: 'error',
                    message: `服务器错误: ${result.msg || '未知错误'}`
                });
            }
        });

        worker.on('error', err => {
            log.error(`[Main] Error from BMP worker ${worker.threadId}:`, err);
        });

        worker.on('exit', code => {
            bmpServerRunning = false;
            if (code !== 0) {
                log.error(`[Main] BMP worker ${worker.threadId} exited with code ${code}`);
            } else {
                log.info(`[Main] BMP worker ${worker.threadId} exited successfully`);
            }
        });
    } catch (error) {
        log.error('[Main] Error starting BMP server:', error);
        bmpServerRunning = false;
        return errorResponse('BMP服务器启动失败: ' + error.message);
    }

    log.info(`[Main] BMP启动成功 in thread ${worker.threadId}`);
    return successResponse(null, '');
}

// Stop BMP server
async function handleStopServer() {
    if (!bmpServerRunning) {
        log.warn('[Main] Attempted to stop BMP server, but it was not running');
        return successResponse(null, 'BMP服务器未运行');
    }

    try {
        log.info('[Main] Stopping BMP server');

        const msg = {
            op: BMP_OPERATIONS.STOP_SERVER,
            data: null
        };

        worker.postMessage(msg);

        // Wait for server to stop (handled in message event)
        return successResponse(null, 'BMP服务器停止命令已发送');
    } catch (error) {
        log.error('[Main] Error stopping BMP server:', error);

        // Force terminate if sending message fails
        try {
            await worker.terminate();
        } catch (termError) {
            log.error('[Main] Error terminating BMP worker:', termError);
        }

        bmpServerRunning = false;
        return errorResponse('BMP服务器停止失败: ' + error.message);
    }
}

// Get peers list
async function handleGetPeers() {
    if (!bmpServerRunning) {
        return successResponse([]);
    }

    try {
        // Request peer list from worker
        worker.postMessage({
            op: 'get_peers',
            data: null
        });

        // This would normally wait for a response, but for simplicity we'll return an empty array
        // In a real implementation, you'd use a promise and resolve it when the worker responds
        return successResponse([]);
    } catch (error) {
        log.error('[Main] Error getting peers:', error);
        return errorResponse(error.message);
    }
}

// Get routes
async function handleGetRoutes(event, ipType) {
    if (!bmpServerRunning) {
        return successResponse([]);
    }

    try {
        // Request routes from worker
        worker.postMessage({
            op: 'get_routes',
            data: { ipType }
        });

        // Similarly, we'd wait for a response in a real implementation
        return successResponse([]);
    } catch (error) {
        log.error('[Main] Error getting routes:', error);
        return errorResponse(error.message);
    }
}

// Handle window close
async function handleWindowClose(win) {
    if (bmpServerRunning) {
        const { dialog } = require('electron');
        const { response } = await dialog.showMessageBox(win, {
            type: 'warning',
            title: '确认关闭',
            message: 'BMP 服务器正在运行，确定要关闭吗？',
            buttons: ['确定', '取消'],
            defaultId: 1,
            cancelId: 1
        });

        if (response === 1) {
            // Cancel closing
            return false;
        }

        // User confirmed, stop the server
        try {
            await handleStopServer();
        } catch (error) {
            log.error('[Main] Error stopping BMP server during window close:', error);
        }
    }

    return true;
}

// Register BMP Emulator IPC handlers
function registerHandlers(ipcMain) {
    ipcMain.handle('bmp-emulator:getNetworkInfo', handleGetNetworkInfo);
    ipcMain.handle('bmp-emulator:startServer', handleStartServer);
    ipcMain.handle('bmp-emulator:stopServer', handleStopServer);
    ipcMain.handle('bmp-emulator:getServerStatus', handleGetServerStatus);
    ipcMain.handle('bmp-emulator:saveConfig', handleSaveConfig);
    ipcMain.handle('bmp-emulator:loadConfig', handleLoadConfig);
    ipcMain.handle('bmp-emulator:getPeers', handleGetPeers);
    ipcMain.handle('bmp-emulator:getRoutes', handleGetRoutes);
}

module.exports = {
    registerHandlers,
    handleWindowClose
};
