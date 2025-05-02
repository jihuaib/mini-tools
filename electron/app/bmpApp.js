const { app } = require('electron');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const { BMP_REQ_TYPES } = require('../const/bmpReqConst');
const Logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { BMP_EVT_TYPES } = require('../const/bmpEvtConst');
class BmpApp {
    constructor(ipcMain, store) {
        this.ipcMain = ipcMain;
        this.store = store;
        this.bmpConfigFileKey = 'bmp-config';
        this.isDev = !app.isPackaged;
        this.logger = new Logger();
        this.worker = null;

        this.bmpInitiationHandler = null;

        this.registerHandlers();
    }

    registerHandlers() {
        this.ipcMain.handle('bmp:saveBmpConfig', this.handleSaveBmpConfig.bind(this));
        this.ipcMain.handle('bmp:loadBmpConfig', this.handleLoadBmpConfig.bind(this));
        this.ipcMain.handle('bmp:startBmp', this.handleStartBmp.bind(this));
        this.ipcMain.handle('bmp:stopBmp', this.handleStopBmp.bind(this));
        // this.ipcMain.handle('bmp:getServerStatus', handleGetServerStatus);
    }

    async handleSaveBmpConfig(event, config) {
        try {
            this.store.set(this.bmpConfigFileKey, config);
            return successResponse(null, 'BMP配置文件保存成功');
        } catch (error) {
            this.logger.error('Error saving BMP config:', error);
            return errorResponse(error.message);
        }
    }

    async handleLoadBmpConfig() {
        try {
            const config = this.store.get(this.bmpConfigFileKey);
            if (!config) {
                return successResponse(null, 'BMP配置文件不存在');
            }
            return successResponse(config, 'BMP配置文件加载成功');
        } catch (error) {
            this.logger.error('Error loading BMP config:', error);
            return errorResponse(error.message);
        }
    }

    async handleStartBmp(event, bmpConfigData) {
        const webContents = event.sender;
        try {
            if (null != this.worker) {
                this.logger.error(`bmp协议已经启动`);
                return errorResponse('bmp协议已经启动');
            }

            this.logger.info(`${JSON.stringify(bmpConfigData)}`);

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/bmpWorker.js')
                : path.join(process.resourcesPath, 'app.asar.unpacked', 'electron/worker/bmpWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            // 定义事件处理函数
            this.bmpInitiationHandler = data => {
                this.logger.info(`bmpInitiationHandler data: ${JSON.stringify(data)}`);
                webContents.send('bmp:initiation', successResponse(data.data));
            };

            // 注册事件监听器，处理来自worker的事件通知
            this.worker.addEventListener(BMP_EVT_TYPES.INITIATION, this.bmpInitiationHandler);

            const result = await this.worker.sendRequest(BMP_REQ_TYPES.START_BMP, bmpConfigData);

            // 这里肯定是启动成功了，如果失败，会抛出异常
            this.logger.info(`bmp启动成功 result: ${JSON.stringify(result)}`);
            return successResponse(null, result.msg);
        } catch (error) {
            this.logger.error('Error starting BMP:', error);
            return errorResponse(error.message);
        }
    }

    async handleStopBmp() {
        if (null == this.worker) {
            this.logger.error('BMP未启动');
            return errorResponse('BMP未启动');
        }

        try {
            const result = await this.worker.sendRequest(BMP_REQ_TYPES.STOP_BMP, null);
            return successResponse(null, result.msg);
        } catch (error) {
            this.logger.error('Error stopping BMP:', error);
            return errorResponse(error.message);
        } finally {
            // 移除事件监听器
            this.worker.removeEventListener(BMP_EVT_TYPES.INITIATION, this.bmpInitiationHandler);
            await this.worker.terminate();
            this.worker = null;
        }
    }
}

// // Get server status
// async function handleGetServerStatus() {
//     try {
//         if (!bmpServerRunning) {
//             return successResponse({ running: false });
//         }

//         // Send a message to the worker to get the current configuration
//         return successResponse({
//             running: bmpServerRunning
//             // You can add more information here if needed
//         });
//     } catch (error) {
//         log.error('[Main] Error getting BMP server status:', error);
//         return errorResponse(error.message);
//     }
// }

// // Start BMP server
// async function handleStartServer(event, config) {
//     const webContents = event.sender;
//     const win = BrowserWindow.fromWebContents(webContents);

//     if (bmpServerRunning) {
//         log.error('[Main] BMP服务器已经在运行');
//         return errorResponse('BMP服务器已经在运行');
//     }

//     log.info('[Main] Starting BMP server with config:', config);

//     const workerPath = isDev
//         ? path.join(__dirname, '../worker/bmpEmulatorWorker.js')
//         : path.join(process.resourcesPath, 'app.asar.unpacked', 'electron/worker/bmpEmulatorWorker.js');

//     try {
//         worker = new Worker(workerPath);

//         bmpServerRunning = true;

//         const msg = {
//             op: BMP_OPERATIONS.START_SERVER,
//             data: config
//         };

//         worker.postMessage(msg);

//         worker.on('message', async result => {
//             log.info(`[Main] Received message from BMP worker ${worker.threadId}:`, result);

//             if (result.status === 'success') {
//                 const { op, data } = result.data;

//                 switch (op) {
//                     case BMP_OPERATIONS.PEER_CONNECTED:
//                     case BMP_OPERATIONS.PEER_DISCONNECTED:
//                         webContents.send('bmp:peerUpdate', data);
//                         break;

//                     case BMP_OPERATIONS.ROUTE_ANNOUNCED:
//                     case BMP_OPERATIONS.ROUTE_WITHDRAWN:
//                         webContents.send('bmp:routeUpdate', data);
//                         break;

//                     case BMP_OPERATIONS.SERVER_LOG:
//                         webContents.send('bmp:serverLog', data);
//                         break;

//                     case BMP_OPERATIONS.INITIATION_RECEIVED:
//                         webContents.send('bmp:initiationReceived', data);
//                         break;

//                     case BMP_OPERATIONS.STOP_SERVER:
//                         await worker.terminate();
//                         bmpServerRunning = false;
//                         webContents.send('bmp:serverLog', {
//                             type: 'warning',
//                             message: 'BMP服务器已停止'
//                         });
//                         break;
//                 }
//             } else {
//                 log.error(`[Main] Received error from BMP worker ${worker.threadId}:`, result);
//                 webContents.send('bmp:serverLog', {
//                     type: 'error',
//                     message: `服务器错误: ${result.msg || '未知错误'}`
//                 });
//             }
//         });

//         worker.on('error', err => {
//             log.error(`[Main] Error from BMP worker ${worker.threadId}:`, err);
//         });

//         worker.on('exit', code => {
//             bmpServerRunning = false;
//             if (code !== 0) {
//                 log.error(`[Main] BMP worker ${worker.threadId} exited with code ${code}`);
//             } else {
//                 log.info(`[Main] BMP worker ${worker.threadId} exited successfully`);
//             }
//         });
//     } catch (error) {
//         log.error('[Main] Error starting BMP server:', error);
//         bmpServerRunning = false;
//         return errorResponse('BMP服务器启动失败: ' + error.message);
//     }

//     log.info(`[Main] BMP启动成功 in thread ${worker.threadId}`);
//     return successResponse(null, '');
// }

// // Stop BMP server
// async function handleStopServer() {
//     if (!bmpServerRunning) {
//         log.warn('[Main] Attempted to stop BMP server, but it was not running');
//         return successResponse(null, 'BMP服务器未运行');
//     }

//     try {
//         log.info('[Main] Stopping BMP server');

//         const msg = {
//             op: BMP_OPERATIONS.STOP_SERVER,
//             data: null
//         };

//         worker.postMessage(msg);

//         // Wait for server to stop (handled in message event)
//         return successResponse(null, 'BMP服务器停止命令已发送');
//     } catch (error) {
//         log.error('[Main] Error stopping BMP server:', error);

//         // Force terminate if sending message fails
//         try {
//             await worker.terminate();
//         } catch (termError) {
//             log.error('[Main] Error terminating BMP worker:', termError);
//         }

//         bmpServerRunning = false;
//         return errorResponse('BMP服务器停止失败: ' + error.message);
//     }
// }

// // Get peers list
// async function handleGetPeers() {
//     if (!bmpServerRunning) {
//         return successResponse([]);
//     }

//     try {
//         // Request peer list from worker
//         worker.postMessage({
//             op: 'get_peers',
//             data: null
//         });

//         // This would normally wait for a response, but for simplicity we'll return an empty array
//         // In a real implementation, you'd use a promise and resolve it when the worker responds
//         return successResponse([]);
//     } catch (error) {
//         log.error('[Main] Error getting peers:', error);
//         return errorResponse(error.message);
//     }
// }

// // Get routes
// async function handleGetRoutes(event, ipType) {
//     if (!bmpServerRunning) {
//         return successResponse([]);
//     }

//     try {
//         // Request routes from worker
//         worker.postMessage({
//             op: 'get_routes',
//             data: { ipType }
//         });

//         // Similarly, we'd wait for a response in a real implementation
//         return successResponse([]);
//     } catch (error) {
//         log.error('[Main] Error getting routes:', error);
//         return errorResponse(error.message);
//     }
// }

// // Handle window close
// async function handleWindowClose(win) {
//     if (bmpServerRunning) {
//         const { dialog } = require('electron');
//         const { response } = await dialog.showMessageBox(win, {
//             type: 'warning',
//             title: '确认关闭',
//             message: 'BMP 服务器正在运行，确定要关闭吗？',
//             buttons: ['确定', '取消'],
//             defaultId: 1,
//             cancelId: 1
//         });

//         if (response === 1) {
//             // Cancel closing
//             return false;
//         }

//         // User confirmed, stop the server
//         try {
//             await handleStopServer();
//         } catch (error) {
//             log.error('[Main] Error stopping BMP server during window close:', error);
//         }
//     }

//     return true;
// }

module.exports = BmpApp;
