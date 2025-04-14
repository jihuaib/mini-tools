const { BrowserWindow } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const os = require("os");

let bgpStart = false;

function sendBgpDataTime(webContents, channel, payload) {
    const now = new Date();
    const timeStr = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ` +
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;

    payload.data.message = payload.data.message ? `${timeStr} ${payload.data.message}` : timeStr;

    webContents.send(channel, payload);
}
async function handleGetNetworkInfo(event) {
    let interfaces;
    interfaces = os.networkInterfaces();
    return interfaces;
}

function handleStartBgp(event, bgpData){
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);

    if (bgpStart) {
        webContents.send('update-bgp-data', { status: 'error', msg: 'bgp已经启动'});
        return;
    }

    console.log('[Main] handleStartBgp', bgpData);

    const workerPath = path.join(__dirname, './worker/bgpSimulatorWorker.js');
    const worker = new Worker(workerPath);

    console.log(`[Worker ${worker.threadId}] 启动`);

    bgpStart = true;

    worker.postMessage(bgpData);

    // 持续接收 BGP 线程的消息
    worker.on('message', (result) => {
        console.log(`[Worker ${worker.threadId}] recv msg`, result);
        sendBgpDataTime(webContents, 'update-bgp-data', { status: 'success', msg: '', data:result });
    });

    worker.on('error', (err) => {
        console.error(`[Worker ${worker.threadId}] err:`, err);
        webContents.send('update-bgp-data', { status: 'error', msg: err.message });
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`[Worker ${worker.threadId}] exit, exit code:`, code);
            webContents.send('update-bgp-data', {
                status: 'error',
                msg: `Worker stopped with exit code ${code}`,
            });
        } else {
            console.log(`[Worker ${worker.threadId}] has completed successfully.`);
        }
    });
}

module.exports = {
    handleStartBgp,
    handleGetNetworkInfo
};