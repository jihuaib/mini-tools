const { app, BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const fs = require('fs');
const log = require('electron-log');
const { successResponse, errorResponse } = require('./utils/responseUtils');
const BGP_OPERATIONS = require('./const/operations');

let bgpStart = false;
let worker;

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
async function handleSaveBgpConfig(event, config) {
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
async function handleLoadBgpConfig() {
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
        await worker.postMessage(msg);
        // 退出work
        await worker.terminate();
        bgpStart = false;

        return successResponse(null, 'BGP停止成功');
    } catch (error) {
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
        return successResponse(null, 'Route sent successfully');
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
        return successResponse(null, 'Route withdrawn successfully');
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

    const workerPath = path.join(__dirname, './worker/bgpSimulatorWorker.js');
    worker = new Worker(workerPath);

    log.info(`[Worker ${worker.threadId}] 启动`);

    bgpStart = true;

    const msg = {
        op: BGP_OPERATIONS.START_BGP,
        data: bgpData
    };

    worker.postMessage(msg);

    // 持续接收 BGP 线程的消息
    worker.on('message', result => {
        log.info(`[Main] recv msg from [Worker ${worker.threadId}]`, result);
        if (result.op === BGP_OPERATIONS.PEER_STATE) {
            webContents.send('update-peer-data', successResponse({ state: result.state }));
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

    log.info(`[Main] BGP启动成功 in ${worker.threadId}`);
    return successResponse(null, 'BGP启动成功');
}

function getBgpState() {
    return bgpStart;
}

module.exports = {
    handleStartBgp,
    handleGetNetworkInfo,
    handleSaveBgpConfig,
    handleLoadBgpConfig,
    handleStopBgp,
    getBgpState,
    handleSendRoute,
    handleWithdrawRoute
};
