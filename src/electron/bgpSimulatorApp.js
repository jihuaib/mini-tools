const { app, BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const fs = require('fs');
const log = require('electron-log');
const { successResponse, errorResponse } = require('./utils/responseUtils');
const { BGP_OPERATIONS } = require('./const/operations');

let bgpStart = false;
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

// 获取配置文件路径
function getConfigPath() {
    return path.join(app.getPath('userData'), 'bgp-simulator-config.json');
}

// 保存配置
async function handleSaveConfig(event, config) {
    try {
        const configPath = getConfigPath();
        const configDir = path.dirname(configPath);
        // 确保目录存在
        if (!fs.existsSync(configDir)) {
            await fs.promises.mkdir(configDir, { recursive: true });
        }
        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
        return successResponse(null, '');
    } catch (error) {
        log.error('[Main] Error saving config:', error);
        return errorResponse(error.message);
    }
}

// 加载配置
async function handleLoadConfig() {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return successResponse(null, 'BGP配置文件不存在');
        }
        const data = await fs.promises.readFile(configPath, 'utf8');
        return successResponse(JSON.parse(data), 'BGP配置文件加载成功');
    } catch (error) {
        log.error('[Main] Error loading config:', error);
        return errorResponse(error.message);
    }
}

async function handleStopBgp() {
    if (!bgpStart) {
        log.error('[Main] BGP未启动');
        return errorResponse('BGP未启动');
    }

    try {
        const msg = {
            op: BGP_OPERATIONS.STOP_BGP,
            data: null
        };
        worker.postMessage(msg);
        return successResponse(null, '');
    } catch (error) {
        await worker.terminate();
        bgpStart = false;
        log.error('[Main] Error stopping BGP:', error);
        return errorResponse(error.message);
    }
}

async function handleSendRoute(event, config) {
    if (!bgpStart) {
        log.error('[Main] bgp协议没有运行');
        return errorResponse('bgp协议没有运行');
    }

    log.info('[Main] handleSendRoute config:', config);

    try {
        const msg = {
            op: BGP_OPERATIONS.SEND_ROUTE,
            data: config
        };

        worker.postMessage(msg);
        return successResponse(null, '');
    } catch (error) {
        log.error('[Main] Error sending route:', error);
        return errorResponse(error.message);
    }
}

async function handleWithdrawRoute(event, config) {
    if (!bgpStart) {
        log.error('[Main] bgp协议没有运行');
        return errorResponse('bgp协议没有运行');
    }

    log.info('[Main] handleWithdrawRoute config:', config);

    try {
        const msg = {
            op: BGP_OPERATIONS.WITHDRAW_ROUTE,
            data: config
        };

        worker.postMessage(msg);
        return successResponse(null, '');
    } catch (error) {
        log.error('[Main] Error withdrawing route:', error);
        return errorResponse(error.message);
    }
}

async function handleStartBgp(event, bgpData) {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);

    if (bgpStart) {
        log.error('[Main] bgp已经启动');
        return errorResponse('bgp已经启动');
    }

    log.info('[Main] handleStartBgp', bgpData);

    const workerPath = isDev
        ? path.join(__dirname, './worker/bgpSimulatorWorker.js')
        : path.join(process.resourcesPath, 'app.asar.unpacked', 'src/electron/worker/bgpSimulatorWorker.js');
    worker = new Worker(workerPath);

    log.info(`[Worker ${worker.threadId}] 启动`);

    bgpStart = true;

    const msg = {
        op: BGP_OPERATIONS.START_BGP,
        data: bgpData
    };

    worker.postMessage(msg);

    // 持续接收 BGP 线程的消息
    worker.on('message', async result => {
        log.info(`[Main] recv msg from [Worker ${worker.threadId}]`, result);
        if (result.status === 'success') {
            if (result.data.op === BGP_OPERATIONS.PEER_STATE) {
                webContents.send('bgp-emulator:updatePeerState', successResponse({ state: result.data.state }));
            } else if (result.data.op === BGP_OPERATIONS.PUSH_MSG) {
                if (result.data.status === 'success') {
                    webContents.send('bgp-emulator:pushMsg', successResponse(null, result.data.msg));
                } else {
                    webContents.send('bgp-emulator:pushMsg', errorResponse(result.data.msg));
                }
            } else if (result.data.op === BGP_OPERATIONS.STOP_BGP) {
                // BGP停止成功
                await worker.terminate();
                bgpStart = false;
                webContents.send('bgp-emulator:pushMsg', successResponse(null, result.data.msg));
            }
        } else {
            log.error(`[Main] recv error msg from [Worker ${worker.threadId}]`, result);
        }
    });

    worker.on('error', err => {
        log.error(`[Main] recv err from [Worker ${worker.threadId}]`, err);
    });

    worker.on('exit', code => {
        bgpStart = false;
        if (code !== 0) {
            log.error(`[Main] recv exit from [Worker ${worker.threadId}]`, code);
        } else {
            log.info(`[Main] [Worker ${worker.threadId}] has completed successfully.`);
        }
    });

    log.info(`[Main] BGP启动成功 in thread ${worker.threadId}`);
    return successResponse(null, '');
}

async function handleWindowClose(win) {
    if (bgpStart) {
        const { dialog } = require('electron');
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

            // 等待 bgpStart 变为 false
            const waitForBgpStop = () => {
                return new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (!bgpStart) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });
            };

            await waitForBgpStop();
            return true;
        }
        return false;
    }
    return true;
}

// Register IPC handlers
const registerHandlers = ipc => {
    ipc.handle('bgp-emulator:getNetworkInfo', async () => handleGetNetworkInfo());
    ipc.handle('bgp-emulator:saveConfig', async (event, config) => handleSaveConfig(event, config));
    ipc.handle('bgp-emulator:loadConfig', async () => handleLoadConfig());
    ipc.handle('bgp-emulator:startBgp', async (event, config) => handleStartBgp(event, config));
    ipc.handle('bgp-emulator:stopBgp', async () => handleStopBgp());
    ipc.handle('bgp-emulator:sendRoute', async (event, config) => handleSendRoute(event, config));
    ipc.handle('bgp-emulator:withdrawRoute', async (event, config) => handleWithdrawRoute(event, config));
};

module.exports = {
    registerHandlers,
    handleWindowClose
};
