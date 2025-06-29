const path = require('path');
const { app } = require('electron');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const SnmpConst = require('../const/snmpConst');
const EventDispatcher = require('../utils/eventDispatcher');
class SnmpApp {
    constructor(ipcMain, store) {
        this.ipcMain = ipcMain;
        this.store = store;
        this.snmpConfigFileKey = 'snmp-config';
        this.worker = null;
        this.isDev = !app.isPackaged;

        this.snmpTrapEventHandler = null;
        this.eventDispatcher = null;

        // 注册IPC处理程序
        this.registerIpcHandlers();
    }

    /**
     * 注册IPC处理程序
     */
    registerIpcHandlers() {
        this.ipcMain.handle('snmp:saveSnmpConfig', this.handleSaveSnmpConfig.bind(this));
        this.ipcMain.handle('snmp:getSnmpConfig', this.handleGetSnmpConfig.bind(this));
        this.ipcMain.handle('snmp:startSnmp', this.handleStartSnmp.bind(this));
        this.ipcMain.handle('snmp:stopSnmp', this.handleStopSnmp.bind(this));
    }

    /**
     * 保存SNMP配置
     */
    async handleSaveSnmpConfig(_event, config) {
        try {
            logger.info('handleSaveSnmpConfig', config);
            this.store.set(this.snmpConfigFileKey, config);
            return successResponse(null, '配置保存成功');
        } catch (error) {
            logger.error('保存SNMP配置失败:', error);
            return errorResponse('配置保存失败: ' + error.message);
        }
    }

    /**
     * 获取SNMP配置
     */
    async handleGetSnmpConfig() {
        try {
            const config = this.store.get(this.snmpConfigFileKey);
            if (!config) {
                return successResponse(null, '获取默认配置');
            }
            return successResponse(config, '配置获取成功');
        } catch (error) {
            logger.error('获取SNMP配置失败:', error);
            return errorResponse('配置获取失败: ' + error.message);
        }
    }

    /**
     * 启动SNMP服务器
     */
    async handleStartSnmp(event, config) {
        const webContents = event.sender;
        try {
            if (this.worker !== null) {
                logger.error('SNMP协议已经启动');
                return errorResponse('SNMP协议已经启动');
            }

            logger.info(`启动SNMP服务器: ${JSON.stringify(config)}`);

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/snmpWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/snmpWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            this.eventDispatcher = new EventDispatcher();
            this.eventDispatcher.setWebContents(webContents);
            // 注册事件监听
            this.snmpTrapEventHandler = data => {
                this.eventDispatcher.emit('snmp:event', successResponse(data));
            };

            this.worker.addEventListener(SnmpConst.SNMP_EVT_TYPES.TRAP_EVT, this.snmpTrapEventHandler);

            const result = await this.worker.sendRequest(SnmpConst.SNMP_REQ_TYPES.START_SNMP, config);

            if (result.status === 'success') {
                logger.info(`SNMP服务器启动成功: ${JSON.stringify(result)}`);
                return successResponse(null, result.msg);
            } else {
                logger.error(`SNMP服务器启动失败: ${result.msg}`);
                await this.worker.terminate();
                this.worker = null;
                return errorResponse(result.msg);
            }
        } catch (error) {
            this.worker.removeEventListener(SnmpConst.SNMP_EVT_TYPES.TRAP_EVT, this.snmpTrapEventHandler);
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
            }
            this.eventDispatcher.cleanup(); // 清理事件发送器
            this.eventDispatcher = null;
            logger.error('启动SNMP服务器失败:', error);
            return errorResponse('启动SNMP服务器失败: ' + error.message);
        }
    }

    /**
     * 停止SNMP服务器
     */
    async handleStopSnmp() {
        try {
            if (this.worker === null) {
                logger.error('SNMP服务器未启动');
                return errorResponse('SNMP服务器未启动');
            }

            const result = await this.worker.sendRequest(SnmpConst.SNMP_REQ_TYPES.STOP_SNMP, null);
            logger.info(`SNMP服务器停止成功: ${JSON.stringify(result)}`);

            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('停止SNMP服务器失败:', error);
            return errorResponse('停止SNMP服务器失败: ' + error.message);
        } finally {
            this.worker.removeEventListener(SnmpConst.SNMP_EVT_TYPES.TRAP_EVT, this.snmpTrapEventHandler);
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
            }
            this.eventDispatcher.cleanup(); // 清理事件发送器
            this.eventDispatcher = null;
        }
    }

    /**
     * 获取SNMP服务运行状态
     */
    getSnmpRunning() {
        return this.worker !== null;
    }
}

module.exports = SnmpApp;
