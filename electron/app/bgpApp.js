const { app } = require('electron');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const { BGP_REQ_TYPES } = require('../const/bgpReqConst');
const Logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { BGP_EVT_TYPES } = require('../const/BgpEvtConst');

class BgpApp {
    constructor(ipc, store) {
        this.bgpStart = false;
        this.worker = null;
        this.bgpConfigFileKey = 'bgp-config';
        this.peerConfigFileKey = 'peer-config';
        this.isDev = !app.isPackaged;
        this.logger = new Logger();
        this.peerChangeHandler = null;
        this.store = store;
        // 注册IPC处理程序
        this.registerHandlers(ipc);
    }

    registerHandlers(ipc) {
        // 配置相关
        ipc.handle('bgp:saveBgpConfig', async (event, config) => this.handleSaveBgpConfig(event, config));
        ipc.handle('bgp:loadBgpConfig', async () => this.handleLoadBgpConfig());
        ipc.handle('bgp:savePeerConfig', async (event, config) => this.handleSavePeerConfig(event, config));
        ipc.handle('bgp:loadPeerConfig', async () => this.handleLoadPeerConfig());

        // bgp
        ipc.handle('bgp:startBgp', async (event, bgpConfigData) => this.handleStartBgp(event, bgpConfigData));
        ipc.handle('bgp:stopBgp', async () => this.handleStopBgp());

        // peer
        ipc.handle('bgp:configPeer', async (event, peerConfigData) => this.handleConfigPeer(event, peerConfigData));
        ipc.handle('bgp:getPeerInfo', async () => this.handleGetPeerInfo());

        // route
        ipc.handle('bgp:sendRoute', async (event, config) => this.handleSendRoute(event, config));
        ipc.handle('bgp:withdrawRoute', async (event, config) => this.handleWithdrawRoute(event, config));
    }

    // 保存配置
    async handleSaveBgpConfig(event, config) {
        try {
            this.store.set(this.bgpConfigFileKey, config);
            return successResponse(null, 'BGP配置文件保存成功');
        } catch (error) {
            this.logger.error('Error saving config:', error);
            return errorResponse(error.message);
        }
    }

    // 加载配置
    async handleLoadBgpConfig() {
        try {
            const config = this.store.get(this.bgpConfigFileKey);
            if (!config) {
                return successResponse(null, 'BGP配置文件不存在');
            }
            return successResponse(config, 'BGP配置文件加载成功');
        } catch (error) {
            this.logger.error('Error loading config:', error);
            return errorResponse(error.message);
        }
    }

    // 保存配置
    async handleSavePeerConfig(event, config) {
        try {
            this.store.set(this.peerConfigFileKey, config);
            return successResponse(null, 'Peer配置文件保存成功');
        } catch (error) {
            this.logger.error('Error saving config:', error);
            return errorResponse(error.message);
        }
    }

    // 加载配置
    async handleLoadPeerConfig() {
        try {
            const config = this.store.get(this.peerConfigFileKey);
            if (!config) {
                return successResponse(null, 'Peer配置文件不存在');
            }
            return successResponse(config, 'Peer配置文件加载成功');
        } catch (error) {
            this.logger.error('Error loading config:', error);
            return errorResponse(error.message);
        }
    }

    async handleConfigPeer(event, peerConfigData) {
        const webContents = event.sender;
        try {
            if (this.bgpStart) {
            }

            this.logger.info(`${JSON.stringify(peerConfigData)}`);

            if (null == this.worker) {
                this.logger.error(`bgp协议没有启动`);
                return errorResponse('bgp协议没有启动');
            }

            const result = await this.worker.sendRequest(BGP_REQ_TYPES.CONFIG_PEER, peerConfigData);

            // 这里肯定是启动成功了，如果失败，会抛出异常
            this.logger.info(`config peer成功 result: ${JSON.stringify(result)}`);

            return successResponse(null, result.msg);
        } catch (error) {
            this.logger.error('Error config Peer:', error);
            return errorResponse(error.message);
        }
    }



    async handleStartBgp(event, bgpConfigData) {
        const webContents = event.sender;
        try {
            if (this.bgpStart) {
                this.logger.error(`bgp协议已经启动`);
                return errorResponse('bgp协议已经启动');
            }

            this.logger.info(`${JSON.stringify(bgpConfigData)}`);

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/bgpWorker.js')
                : path.join(process.resourcesPath, 'app.asar.unpacked', 'electron/worker/bgpWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            // 定义事件处理函数
            this.peerChangeHandler = data => {
                console.log(`peerChangeHandler data: ${JSON.stringify(data)}`);
                webContents.send('bgp:peerChange', successResponse(data.data));
            };

            // 注册事件监听器，处理来自worker的事件通知
            this.worker.addEventListener(BGP_EVT_TYPES.BGP_PEER_CHANGE, this.peerChangeHandler);

            const result = await this.worker.sendRequest(BGP_REQ_TYPES.START_BGP, bgpConfigData);

            // 这里肯定是启动成功了，如果失败，会抛出异常
            this.logger.info(`bgp启动成功 result: ${JSON.stringify(result)}`);

            this.bgpStart = true;
            return successResponse(null, result.msg);
        } catch (error) {
            this.logger.error('Error starting BGP:', error);
            return errorResponse(error.message);
        }
    }

    async handleStopBgp() {
        if (!this.bgpStart) {
            this.logger.error('BGP未启动');
            return errorResponse('BGP未启动');
        }

        try {
            const result = await this.worker.sendRequest(BGP_REQ_TYPES.STOP_BGP, null);
            this.bgpStart = false;
            return successResponse(null, result.msg);
        } catch (error) {
            this.logger.error('Error stopping BGP:', error);
            return errorResponse(error.message);
        } finally {
            // 移除事件监听器
            this.worker.removeEventListener(BGP_EVT_TYPES.BGP_PEER_CHANGE, this.peerChangeHandler);
            await this.worker.terminate();
        }
    }

    async handleGetPeerInfo() {
        if (!this.bgpStart) {
            this.logger.error('bgp协议没有运行');
            return errorResponse('bgp协议没有运行');
        }

        try {
            const result = await this.worker.sendRequest(BGP_REQ_TYPES.GET_PEER_INFO, null);
            this.logger.info(`获取Peer信息成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取Peer信息成功');
        } catch (error) {
            this.logger.error('Error getting peer info:', error);
            return errorResponse(error.message);
        }
    }

    async handleSendRoute(event, config) {
        if (!this.bgpStart) {
            this.logger.error('bgp协议没有运行');
            return errorResponse('bgp协议没有运行');
        }

        this.logger.info('handleSendRoute config:', config);

        try {
            const result = await this.worker.sendRequest(BGP_REQ_TYPES.SEND_ROUTE, config);
            return successResponse(null, result.msg);
        } catch (error) {
            this.logger.error('Error sending route:', error);
            return errorResponse(error.message);
        }
    }

    async handleWithdrawRoute(event, config) {
        if (!this.bgpStart) {
            this.logger.error('bgp协议没有运行');
            return errorResponse('bgp协议没有运行');
        }

        this.logger.info('handleWithdrawRoute config:', config);

        try {
            const result = await this.worker.sendRequest(BGP_REQ_TYPES.WITHDRAW_ROUTE, config);
            return successResponse(null, result.msg);
        } catch (error) {
            this.logger.error('Error withdrawing route:', error);
            return errorResponse(error.message);
        }
    }

    async handleWindowClose(win) {
        if (this.bgpStart) {
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
                await this.handleStopBgp();
                return true;
            }
            return false;
        }
        return true;
    }
}

module.exports = BgpApp;
