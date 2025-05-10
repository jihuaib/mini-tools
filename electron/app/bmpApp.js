const { app } = require('electron');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const { BMP_REQ_TYPES } = require('../const/bmpReqConst');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { BMP_EVT_TYPES } = require('../const/bmpEvtConst');
const logger = require('../log/logger');
class BmpApp {
    constructor(ipcMain, store) {
        this.ipcMain = ipcMain;
        this.store = store;
        this.bmpConfigFileKey = 'bmp-config';
        this.isDev = !app.isPackaged;
        this.worker = null;

        this.bmpInitiationHandler = null;
        this.bmpPeerUpdateHandler = null;
        this.bmpRouteUpdateHandler = null;
        this.bmpTerminationHandler = null;

        this.registerHandlers();
    }

    registerHandlers() {
        this.ipcMain.handle('bmp:saveBmpConfig', this.handleSaveBmpConfig.bind(this));
        this.ipcMain.handle('bmp:loadBmpConfig', this.handleLoadBmpConfig.bind(this));
        this.ipcMain.handle('bmp:startBmp', this.handleStartBmp.bind(this));
        this.ipcMain.handle('bmp:stopBmp', this.handleStopBmp.bind(this));
        this.ipcMain.handle('bmp:getClientList', this.handleGetClientList.bind(this));
        this.ipcMain.handle('bmp:getPeers', this.handleGetPeers.bind(this));
        this.ipcMain.handle('bmp:getRoutes', this.handleGetRoutes.bind(this));
        this.ipcMain.handle('bmp:getClient', this.handleGetClient.bind(this));
        this.ipcMain.handle('bmp:getPeer', this.handleGetPeer.bind(this));
    }

    async handleSaveBmpConfig(event, config) {
        try {
            this.store.set(this.bmpConfigFileKey, config);
            return successResponse(null, 'BMP配置文件保存成功');
        } catch (error) {
            logger.error('Error saving BMP config:', error.message);
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
            logger.error('Error loading BMP config:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleStartBmp(event, bmpConfigData) {
        const webContents = event.sender;
        try {
            if (null != this.worker) {
                logger.error(`bmp协议已经启动`);
                return errorResponse('bmp协议已经启动');
            }

            logger.info(`${JSON.stringify(bmpConfigData)}`);

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/bmpWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/bmpWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            // 定义事件处理函数
            this.bmpInitiationHandler = data => {
                logger.info(`bmpInitiationHandler data: ${JSON.stringify(data)}`);
                webContents.send('bmp:initiation', successResponse(data.data));
            };

            this.bmpPeerUpdateHandler = data => {
                logger.info(`bmpPeerUpdateHandler data: ${JSON.stringify(data)}`);
                webContents.send('bmp:peerUpdate', successResponse(data.data));
            };

            this.bmpRouteUpdateHandler = data => {
                logger.info(`bmpRouteUpdateHandler data: ${JSON.stringify(data)}`);
                webContents.send('bmp:routeUpdate', successResponse(data.data));
            };

            this.bmpTerminationHandler = data => {
                logger.info(`bmpTerminationHandler data: ${JSON.stringify(data)}`);
                webContents.send('bmp:termination', successResponse(data.data));
            };

            // 注册事件监听器，处理来自worker的事件通知
            this.worker.addEventListener(BMP_EVT_TYPES.INITIATION, this.bmpInitiationHandler);
            this.worker.addEventListener(BMP_EVT_TYPES.PEER_UPDATE, this.bmpPeerUpdateHandler);
            this.worker.addEventListener(BMP_EVT_TYPES.ROUTE_UPDATE, this.bmpRouteUpdateHandler);
            this.worker.addEventListener(BMP_EVT_TYPES.TERMINATION, this.bmpTerminationHandler);

            const result = await this.worker.sendRequest(BMP_REQ_TYPES.START_BMP, bmpConfigData);

            // 这里肯定是启动成功了，如果失败，会抛出异常
            logger.info(`bmp启动成功 result: ${JSON.stringify(result)}`);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error starting BMP:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleStopBmp() {
        if (null == this.worker) {
            logger.error('BMP未启动');
            return errorResponse('BMP未启动');
        }

        try {
            const result = await this.worker.sendRequest(BMP_REQ_TYPES.STOP_BMP, null);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error stopping BMP:', error.message);
            return errorResponse(error.message);
        } finally {
            // 移除事件监听器
            this.worker.removeEventListener(BMP_EVT_TYPES.INITIATION, this.bmpInitiationHandler);
            this.worker.removeEventListener(BMP_EVT_TYPES.PEER_UPDATE, this.bmpPeerUpdateHandler);
            this.worker.removeEventListener(BMP_EVT_TYPES.ROUTE_UPDATE, this.bmpRouteUpdateHandler);
            this.worker.removeEventListener(BMP_EVT_TYPES.TERMINATION, this.bmpTerminationHandler);
            await this.worker.terminate();
            this.worker = null;
        }
    }

    async handleGetClientList() {
        if (null == this.worker) {
            return successResponse([], 'BMP未启动');
        }

        try {
            const result = await this.worker.sendRequest(BMP_REQ_TYPES.GET_CLIENT_LIST, null);
            logger.info(`获取客户端列表成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取客户端列表成功');
        } catch (error) {
            logger.error('Error getting client list:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGetPeers(event, client) {
        if (null == this.worker) {
            return successResponse([], 'BMP未启动');
        }

        logger.info(`获取对等体列表 client: ${JSON.stringify(client)}`);

        try {
            const result = await this.worker.sendRequest(BMP_REQ_TYPES.GET_PEERS, client);
            logger.info(`获取对等体列表成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取对等体列表成功');
        } catch (error) {
            logger.error('Error getting peers:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGetRoutes(event, client, peer, ribType) {
        if (null == this.worker) {
            return successResponse([], 'BMP未启动');
        }

        logger.info(`获取路由列表 client: ${JSON.stringify(client)}`);
        logger.info(`获取路由列表 peer: ${JSON.stringify(peer)}`);
        logger.info(`获取路由列表 ribType: ${JSON.stringify(ribType)}`);

        try {
            const result = await this.worker.sendRequest(BMP_REQ_TYPES.GET_ROUTES, { client, peer, ribType });
            logger.info(`获取路由列表成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取路由列表成功');
        } catch (error) {
            logger.error('Error getting routes:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGetClient(event, client) {
        if (null == this.worker) {
            return successResponse([], 'BMP未启动');
        }

        logger.info(`获取客户端信息 client: ${JSON.stringify(client)}`);

        try {
            const result = await this.worker.sendRequest(BMP_REQ_TYPES.GET_CLIENT, client);
            logger.info(`获取客户端信息成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取客户端信息成功');
        } catch (error) {
            logger.error('Error getting client:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGetPeer(event, client, peer) {
        if (null == this.worker) {
            return successResponse([], 'BMP未启动');
        }

        logger.info(`获取对等体信息 client: ${JSON.stringify(client)}`);
        logger.info(`获取对等体信息 peer: ${JSON.stringify(peer)}`);

        try {
            const result = await this.worker.sendRequest(BMP_REQ_TYPES.GET_PEER, { client, peer });
            logger.info(`获取对等体信息成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取对等体信息成功');
        } catch (error) {
            logger.error('Error getting peer:', error.message);
            return errorResponse(error.message);
        }
    }
}

module.exports = BmpApp;
