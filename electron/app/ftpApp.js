const path = require('path');
const { app } = require('electron');
const { DEFAULT_TOOLS_SETTINGS } = require('../const/toolsConst');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { FTP_REQ_TYPES } = require('../const/ftpReqConst');
class FtpApp {
    constructor(ipcMain, store) {
        this.ipcMain = ipcMain;
        this.store = store;
        this.ftpConfigFileKey = 'ftp-config';
        this.ftpUserListFileKey = 'ftp-user-list';
        this.worker = null;
        this.isDev = !app.isPackaged;
        this.maxFtpUser = DEFAULT_TOOLS_SETTINGS.ftpServer.maxFtpUser;
        // 注册IPC处理程序
        this.registerIpcHandlers();
    }

    /**
     * 注册IPC处理程序
     */
    registerIpcHandlers() {
        this.ipcMain.handle('ftp:addFtpUser', this.handleAddFtpUser.bind(this));
        this.ipcMain.handle('ftp:getFtpUserList', this.handleGetFtpUserList.bind(this));
        this.ipcMain.handle('ftp:deleteFtpUser', this.handleDeleteFtpUser.bind(this));
        this.ipcMain.handle('ftp:saveFtpConfig', this.handleSaveFtpConfig.bind(this));
        this.ipcMain.handle('ftp:getFtpConfig', this.handleGetFtpConfig.bind(this));
        this.ipcMain.handle('ftp:startFtp', this.handleStartFtp.bind(this));
        this.ipcMain.handle('ftp:stopFtp', this.handleStopFtp.bind(this));
    }

    async handleAddFtpUser(event, user) {
        logger.info('handleAddFtpUser', user);
        let config = this.store.get(this.ftpUserListFileKey);
        if (!config) {
            config = [];
        }

        let isExist = false;
        let index = -1;
        config.forEach(element => {
            if (element.username === user.username) {
                isExist = true;
                index = config.indexOf(element);
            }
        });

        if (isExist) {
            // 更新用户
            config[index] = user;
            this.store.set(this.ftpUserListFileKey, config);
            return successResponse(null, '用户更新成功');
        }

        if (config.length >= this.maxFtpUser) {
            config.splice(0, 1);
        }

        config.push(user);
        this.store.set(this.ftpUserListFileKey, config);
        return successResponse(null, '用户添加成功');
    }

    async handleGetFtpUserList() {
        const config = this.store.get(this.ftpUserListFileKey);
        if (!config) {
            return successResponse([], '用户列表获取成功');
        }
        return successResponse(config, '用户列表获取成功');
    }

    async handleDeleteFtpUser(event, user) {
        logger.info('handleDeleteFtpUser', user);
        const config = this.store.get(this.ftpUserListFileKey);
        if (!config) {
            return successResponse([], '用户列表获取成功');
        }
        const index = config.findIndex(element => element.username === user.username);
        if (index !== -1) {
            config.splice(index, 1);
        }
        this.store.set(this.ftpUserListFileKey, config);
        return successResponse(null, '用户删除成功');
    }

    async handleSaveFtpConfig(event, config) {
        logger.info('handleSaveFtpConfig', config);
        this.store.set(this.ftpConfigFileKey, config);
        return successResponse(null, '配置保存成功');
    }

    async handleGetFtpConfig() {
        const config = this.store.get(this.ftpConfigFileKey);
        if (!config) {
            return successResponse(null, '配置不存在');
        }
        return successResponse(config, '配置获取成功');
    }

    /**
     * 处理启动FTP服务器
     * @param {object} event IPC事件
     * @param {object} config FTP配置
     * @returns {Promise<object>} 操作结果
     */
    async handleStartFtp(event, config, user) {
        try {
            if (null != this.worker) {
                logger.error(`ftp协议已经启动`);
                return errorResponse('ftp协议已经启动');
            }

            logger.info(`${JSON.stringify(config)}`);
            logger.info(`${JSON.stringify(user)}`);

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/ftpWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/ftpWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            const result = await this.worker.sendRequest(FTP_REQ_TYPES.START_FTP, {
                ftpConfig: config,
                userConfig: user
            });
            if (result.status === 'success') {
                logger.info(`worker FTP启动成功: ${JSON.stringify(result)}`);
            } else {
                logger.error(`worker FTP启动失败: ${JSON.stringify(result)} ${result.msg}`);
            }

            // 这里肯定是启动成功了，如果失败，会抛出异常
            logger.info(`ftp启动成功 result: ${JSON.stringify(result)}`);
            return successResponse(null, result.msg);
        } catch (error) {
            await this.worker.terminate();
            this.worker = null;
            logger.error('Error starting FTP:', error.message);
            return errorResponse(error.message);
        }
    }

    /**
     * 处理停止FTP服务器
     * @returns {Promise<object>} 操作结果
     */
    async handleStopFtp() {
        try {
            if (null == this.worker) {
                logger.error('FTP未启动');
                return errorResponse('FTP未启动');
            }

            const result = await this.worker.sendRequest(FTP_REQ_TYPES.STOP_FTP, null);
            logger.info(`ftp停止成功 result: ${JSON.stringify(result)}`);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error stopping FTP:', error.message);
            return errorResponse(error.message);
        } finally {
            await this.worker.terminate();
            this.worker = null;
        }
    }

    setMaxFtpUser(maxFtpUser) {
        this.maxFtpUser = maxFtpUser;
    }
}

module.exports = FtpApp;
