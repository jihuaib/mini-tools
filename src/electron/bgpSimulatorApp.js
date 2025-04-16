const { app, BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const fs = require('fs');
const log = require('electron-log');

let bgpStart = false;
let worker;

async function handleGetNetworkInfo(event) {
    let interfaces;
    interfaces = os.networkInterfaces();
    return interfaces;
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
        return { status: 'success' };
    } catch (error) {
        console.error('Error saving config:', error);
        return { status: 'error', message: error.message };
    }
}

// 加载配置
async function handleLoadBgpConfig() {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return { status: 'success', data: null };
        }
        const data = await fs.promises.readFile(configPath, 'utf8');
        return { status: 'success', data: JSON.parse(data) };
    } catch (error) {
        console.error('Error loading config:', error);
        return { status: 'error', message: error.message };
    }
}

async function handleStopBgp() {
    if (!bgpStart) {
        return;
    }

    try {
        // 退出work
        await worker.terminate();
        bgpStart = false;
    } catch (error) {
        console.error('Error loading config:', error);
        return { status: 'error', message: error.message };
    }
}

async function handleSendRoute(event, config) {
    if (!bgpStart) {
        log.error('bgp协议没有运行');
        return { status: 'error', message: 'bgp协议没有运行' };
    }

    log.info('handleSendRoute config:', config);

    try {
        const msg = {
            op: 'send-route',
            data: config
        };

        worker.postMessage(msg);
    } catch (error) {
        console.error('Error loading config:', error);
        return { status: 'error', message: error.message };
    }
}

async function handleWithdrawRoute(event, config) {
    if (!bgpStart) {
        log.error('bgp协议没有运行');
        return { status: 'error', message: 'bgp协议没有运行' };
    }

    log.info('handleSendRoute config:', config);

    try {
        const msg = {
            op: 'withdraw-route',
            data: config
        };

        worker.postMessage(msg);
    } catch (error) {
        console.error('Error loading config:', error);
        return { status: 'error', message: error.message };
    }
}

function handleStartBgp(event, bgpData) {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);

    if (bgpStart) {
        webContents.send('update-bgp-data', {
            status: 'error',
            msg: 'bgp已经启动'
        });
        return;
    }

    console.log('[Main] handleStartBgp', bgpData);

    const workerPath = path.join(__dirname, './worker/bgpSimulatorWorker.js');
    worker = new Worker(workerPath);

    console.log(`[Worker ${worker.threadId}] 启动`);

    bgpStart = true;

    const msg = {
        op: 'start-bgp',
        data: bgpData
    };

    worker.postMessage(msg);

    // 持续接收 BGP 线程的消息
    worker.on('message', result => {
        console.log(`[Worker ${worker.threadId}] recv msg`, result);
        webContents.send('update-bgp-data', {
            status: 'success',
            msg: '',
            data: result
        });
    });

    worker.on('error', err => {
        console.error(`[Worker ${worker.threadId}] err:`, err);
        webContents.send('update-bgp-data', {
            status: 'error',
            msg: err.message
        });
    });

    worker.on('exit', code => {
        bgpStart = false;
        if (code !== 0) {
            console.error(`[Worker ${worker.threadId}] exit, exit code:`, code);
            webContents.send('update-bgp-data', {
                status: 'error',
                msg: `Worker stopped with exit code ${code}`
            });
        } else {
            console.log(`[Worker ${worker.threadId}] has completed successfully.`);
        }
    });
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
