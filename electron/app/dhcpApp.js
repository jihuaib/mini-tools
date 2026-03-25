const path = require('path');
const { app } = require('electron');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const DhcpConst = require('../const/dhcpConst');
const EventDispatcher = require('../utils/eventDispatcher');

class DhcpApp {
    constructor(ipcMain, store) {
        this.ipcMain = ipcMain;
        this.store = store;
        this.dhcpConfigFileKey = 'dhcp-config';
        this.worker = null;
        this.isDev = !app.isPackaged;
        this.eventDispatcher = null;
        this.dhcpEvtHandler = null;

        this.registerIpcHandlers();
    }

    registerIpcHandlers() {
        this.ipcMain.handle('dhcp:saveDhcpConfig', this.handleSaveDhcpConfig.bind(this));
        this.ipcMain.handle('dhcp:getDhcpConfig', this.handleGetDhcpConfig.bind(this));
        this.ipcMain.handle('dhcp:startDhcp', this.handleStartDhcp.bind(this));
        this.ipcMain.handle('dhcp:stopDhcp', this.handleStopDhcp.bind(this));
        this.ipcMain.handle('dhcp:getLeaseList', this.handleGetLeaseList.bind(this));
        this.ipcMain.handle('dhcp:releaseLease', this.handleReleaseLease.bind(this));
    }

    async handleSaveDhcpConfig(event, config) {
        logger.info('handleSaveDhcpConfig', config);
        this.store.set(this.dhcpConfigFileKey, config);
        return successResponse(null, '配置保存成功');
    }

    async handleGetDhcpConfig() {
        const config = this.store.get(this.dhcpConfigFileKey);
        if (!config) {
            return successResponse(null, '配置不存在');
        }
        return successResponse(config, '配置获取成功');
    }

    async handleStartDhcp(event, config) {
        const webContents = event.sender;
        try {
            if (null !== this.worker) {
                logger.error('DHCP服务器已经启动');
                return errorResponse('DHCP服务器已经启动');
            }

            logger.info(`启动DHCP: ${JSON.stringify(config)}`);

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/dhcpWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/dhcpWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            this.eventDispatcher = new EventDispatcher();
            this.eventDispatcher.setWebContents(webContents);

            this.dhcpEvtHandler = data => {
                this.eventDispatcher.emit('dhcp:event', successResponse(data));
            };

            this.worker.addEventListener(DhcpConst.DHCP_EVT_TYPES.DHCP_EVT, this.dhcpEvtHandler);

            const result = await this.worker.sendRequest(DhcpConst.DHCP_REQ_TYPES.START_DHCP, config);

            if (result.status === 'success') {
                logger.info(`DHCP启动成功: ${result.msg}`);
                return successResponse(null, result.msg);
            } else {
                throw new Error(result.msg);
            }
        } catch (error) {
            if (this.worker) {
                this.worker.removeEventListener(DhcpConst.DHCP_EVT_TYPES.DHCP_EVT, this.dhcpEvtHandler);
                await this.worker.terminate();
                this.worker = null;
            }
            if (this.eventDispatcher) {
                this.eventDispatcher.cleanup();
                this.eventDispatcher = null;
            }
            logger.error('启动DHCP出错:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleStopDhcp() {
        try {
            if (null === this.worker) {
                logger.error('DHCP服务器未启动');
                return errorResponse('DHCP服务器未启动');
            }

            const result = await this.worker.sendRequest(DhcpConst.DHCP_REQ_TYPES.STOP_DHCP, null);
            logger.info(`DHCP停止成功: ${result.msg}`);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('停止DHCP出错:', error.message);
            return errorResponse(error.message);
        } finally {
            if (this.worker) {
                this.worker.removeEventListener(DhcpConst.DHCP_EVT_TYPES.DHCP_EVT, this.dhcpEvtHandler);
                await this.worker.terminate();
                this.worker = null;
            }
            if (this.eventDispatcher) {
                this.eventDispatcher.cleanup();
                this.eventDispatcher = null;
            }
        }
    }

    async handleGetLeaseList() {
        if (null === this.worker) {
            return successResponse([], 'DHCP服务器未启动');
        }
        try {
            const result = await this.worker.sendRequest(DhcpConst.DHCP_REQ_TYPES.GET_LEASE_LIST, null);
            return successResponse(result.data, '获取租约列表成功');
        } catch (error) {
            logger.error('获取租约列表出错:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleReleaseLease(event, macAddr) {
        if (null === this.worker) {
            return errorResponse('DHCP服务器未启动');
        }
        try {
            const result = await this.worker.sendRequest(DhcpConst.DHCP_REQ_TYPES.RELEASE_LEASE, macAddr);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('释放租约出错:', error.message);
            return errorResponse(error.message);
        }
    }

    getDhcpRunning() {
        return null !== this.worker;
    }
}

module.exports = DhcpApp;
