const { app } = require('electron');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { getNetworkAddress } = require('../utils/ipUtils');
const RpkiConst = require('../const/rpkiConst');
const EventDispatcher = require('../utils/eventDispatcher');

class RpkiApp {
    constructor(ipcMain, store) {
        this.ipcMain = ipcMain;
        this.store = store;
        this.rpkiConfigFileKey = 'rpki-config';
        this.rpkiRoaFileKey = 'rpki-roa';
        this.isDev = !app.isPackaged;
        this.worker = null;
        this.eventDispatcher = null; // 添加事件发送器

        this.serverDeploymentConfig = null;

        this.logLevel = null;

        this.rpkiClientConnectionHandler = null;

        this.registerHandlers();
    }

    registerHandlers() {
        this.ipcMain.handle('rpki:saveRpkiConfig', this.handleSaveRpkiConfig.bind(this));
        this.ipcMain.handle('rpki:loadRpkiConfig', this.handleLoadRpkiConfig.bind(this));
        this.ipcMain.handle('rpki:startRpki', this.handleStartRpki.bind(this));
        this.ipcMain.handle('rpki:stopRpki', this.handleStopRpki.bind(this));
        this.ipcMain.handle('rpki:getClientList', this.handleGetClientList.bind(this));

        // roa
        this.ipcMain.handle('rpki:addRoa', this.handleAddRoa.bind(this));
        this.ipcMain.handle('rpki:deleteRoa', this.handleDeleteRoa.bind(this));
        this.ipcMain.handle('rpki:getRoaList', this.handleGetRoaList.bind(this));
    }

    async handleSaveRpkiConfig(event, config) {
        try {
            this.store.set(this.rpkiConfigFileKey, config);
            return successResponse(null, 'RPKI配置文件保存成功');
        } catch (error) {
            logger.error('Error saving RPKI config:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleLoadRpkiConfig() {
        try {
            const config = this.store.get(this.rpkiConfigFileKey);
            if (!config) {
                return successResponse(null, 'RPKI配置文件不存在');
            }
            return successResponse(config, 'RPKI配置文件加载成功');
        } catch (error) {
            logger.error('Error loading RPKI config:', error.message);
            return errorResponse(error.message);
        }
    }
    setServerDeploymentConfig(config) {
        this.serverDeploymentConfig = config;
    }

    async handleStartRpki(event, rpkiConfigData) {
        const webContents = event.sender;
        try {
            if (null !== this.worker) {
                logger.error(`rpki协议已经启动`);
                return errorResponse('rpki协议已经启动');
            }

            logger.info(`${JSON.stringify(rpkiConfigData)}`);

            // 获取日志级别配置
            if (this.logLevel) {
                rpkiConfigData.logLevel = this.logLevel;
            }

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/rpkiWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/rpkiWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            // 设置事件发送器的 webContents
            this.eventDispatcher = new EventDispatcher();
            this.eventDispatcher.setWebContents(webContents);

            // 注册事件监听
            this.rpkiClientConnectionHandler = data => {
                this.eventDispatcher.emit('rpki:clientConnection', successResponse(data));
            };

            this.worker.addEventListener(RpkiConst.RPKI_EVT_TYPES.CLIENT_CONNECTION, this.rpkiClientConnectionHandler);

            // 加载roa配置
            const roaList = await this.handleGetRoaList();
            if (roaList.status === 'success') {
                const roaListData = roaList.data;
                for (const roa of roaListData) {
                    const result = await this.worker.sendRequest(RpkiConst.RPKI_REQ_TYPES.ADD_ROA, roa);
                    if (result.status === 'success') {
                        logger.info(`worker RPKI ROA恢复成功: ${JSON.stringify(roa)}`);
                    } else {
                        logger.error(`worker RPKI ROA恢复失败: ${JSON.stringify(roa)} ${result.msg}`);
                    }
                }
            } else {
                logger.error(`RPKI ROA配置加载失败: ${roaList.msg}`);
            }

            if (rpkiConfigData.enableAuth) {
                // 设置 SSH 部署配置
                rpkiConfigData.serverAddress = this.serverDeploymentConfig.serverAddress;
                rpkiConfigData.sshUsername = this.serverDeploymentConfig.sshUsername;
                rpkiConfigData.sshPassword = this.serverDeploymentConfig.sshPassword;
            }

            const result = await this.worker.sendRequest(RpkiConst.RPKI_REQ_TYPES.START_RPKI, rpkiConfigData);

            // 这里肯定是启动成功了，如果失败，会抛出异常
            logger.info(`rpki启动成功 result: ${JSON.stringify(result)}`);
            return successResponse(null, result.msg);
        } catch (error) {
            this.worker.removeEventListener(
                RpkiConst.RPKI_EVT_TYPES.CLIENT_CONNECTION,
                this.rpkiClientConnectionHandler
            );
            await this.worker.terminate();
            this.worker = null;
            this.eventDispatcher.cleanup(); // 清理事件发送器
            this.eventDispatcher = null;
            logger.error('Error starting RPKI:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleStopRpki() {
        if (null === this.worker) {
            logger.error('RPKI未启动');
            return errorResponse('RPKI未启动');
        }

        try {
            const result = await this.worker.sendRequest(RpkiConst.RPKI_REQ_TYPES.STOP_RPKI, null);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error stopping RPKI:', error.message);
            return errorResponse(error.message);
        } finally {
            this.worker.removeEventListener(
                RpkiConst.RPKI_EVT_TYPES.CLIENT_CONNECTION,
                this.rpkiClientConnectionHandler
            );
            await this.worker.terminate();
            this.worker = null;
            this.eventDispatcher.cleanup(); // 清理事件发送器
            this.eventDispatcher = null;
        }
    }

    isRoaSame(roa1, roa2) {
        if (roa1.asn !== roa2.asn) {
            return false;
        }

        if (roa1.maxLength !== roa2.maxLength) {
            return false;
        }

        if (roa1.ipType !== roa2.ipType) {
            return false;
        }

        const net1 = getNetworkAddress(roa1.ip, roa1.mask);
        const net2 = getNetworkAddress(roa2.ip, roa2.mask);

        return net1 === net2;
    }

    async handleAddRoa(event, roa) {
        try {
            let currentRoaList = [];
            const config = this.store.get(this.rpkiRoaFileKey);
            if (config) {
                currentRoaList = config;
            }

            logger.info(`handleAddRoa: ${JSON.stringify(roa)}`);

            // 检查是否已经存在
            const index = currentRoaList.findIndex(
                item =>
                    item.asn === roa.asn &&
                    item.ip === roa.ip &&
                    item.mask === roa.mask &&
                    item.maxLength === roa.maxLength
            );
            if (index !== -1) {
                return errorResponse('RPKI ROA配置已经存在');
            }

            const isCovered = currentRoaList.some(item => this.isRoaSame(item, roa));
            if (isCovered) {
                return errorResponse('RPKI ROA配置已经存在');
            }

            if (this.worker) {
                const result = await this.worker.sendRequest(RpkiConst.RPKI_REQ_TYPES.ADD_ROA, roa);
                if (result.status === 'success') {
                    logger.info(`worker RPKI ROA配置添加成功`);
                } else {
                    logger.error(`worker RPKI ROA配置添加失败: ${result.msg}`);
                }
            }

            currentRoaList.push(roa);
            this.store.set(this.rpkiRoaFileKey, currentRoaList);
            return successResponse(null, 'RPKI ROA配置文件保存成功');
        } catch (error) {
            logger.error('Error adding ROA:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleDeleteRoa(event, roa) {
        try {
            let currentRoaList = [];
            const config = this.store.get(this.rpkiRoaFileKey);
            if (config) {
                currentRoaList = config;
            }

            logger.info(`handleDeleteRoa: ${JSON.stringify(roa)}`);

            // 找到roa，删除
            const index = currentRoaList.findIndex(
                item =>
                    item.asn === roa.asn &&
                    item.ip === roa.ip &&
                    item.mask === roa.mask &&
                    item.maxLength === roa.maxLength
            );
            if (index !== -1) {
                currentRoaList.splice(index, 1);
            }

            if (this.worker) {
                const result = await this.worker.sendRequest(RpkiConst.RPKI_REQ_TYPES.DELETE_ROA, roa);
                if (result.status === 'success') {
                    logger.info(`worker RPKI ROA删除成功`);
                } else {
                    logger.error(`worker RPKI ROA删除失败: ${result.msg}`);
                }
            }

            this.store.set(this.rpkiRoaFileKey, currentRoaList);
            return successResponse(null, 'RPKI ROA配置文件保存成功');
        } catch (error) {
            logger.error('Error deleting ROA:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGetRoaList() {
        try {
            let currentRoaList = [];
            const config = this.store.get(this.rpkiRoaFileKey);
            if (config) {
                currentRoaList = config;
            }
            return successResponse(currentRoaList, 'RPKI ROA配置文件加载成功');
        } catch (error) {
            logger.error('Error getting ROA list:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGetClientList() {
        if (null === this.worker) {
            return successResponse([], 'RPKI未启动');
        }

        try {
            const result = await this.worker.sendRequest(RpkiConst.RPKI_REQ_TYPES.GET_CLIENT_LIST, null);
            logger.info(`获取客户端列表成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取客户端列表成功');
        } catch (error) {
            logger.error('Error getting client list:', error.message);
            return errorResponse(error.message);
        }
    }

    getRpkiRunning() {
        return null !== this.worker;
    }
}

module.exports = RpkiApp;
