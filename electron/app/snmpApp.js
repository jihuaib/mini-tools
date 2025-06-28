const path = require('path');
const { app } = require('electron');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const SnmpConst = require('../const/snmpConst');

class SnmpApp {
    constructor(ipcMain, store) {
        this.ipcMain = ipcMain;
        this.store = store;
        this.snmpConfigFileKey = 'snmp-config';
        this.snmpTrapHistoryKey = 'snmp-trap-history';
        this.worker = null;
        this.isDev = !app.isPackaged;
        this.maxTrapHistory = SnmpConst.DEFAULT_SNMP_SETTINGS.maxTrapHistory;
        this.trapHistory = [];

        this.snmpTrapEventHandler = null;

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
        this.ipcMain.handle('snmp:getServerStatus', this.handleGetServerStatus.bind(this));
        this.ipcMain.handle('snmp:getTrapList', this.handleGetTrapList.bind(this));
        this.ipcMain.handle('snmp:getTrapDetail', this.handleGetTrapDetail.bind(this));
        this.ipcMain.handle('snmp:clearTrapHistory', this.handleClearTrapHistory.bind(this));
    }

    /**
     * 保存SNMP配置
     */
    async handleSaveSnmpConfig(event, config) {
        try {
            logger.info('handleSaveSnmpConfig', config);
            this.store.set(this.snmpConfigFileKey, config);
            this.maxTrapHistory = config.maxTrapHistory || SnmpConst.DEFAULT_SNMP_SETTINGS.maxTrapHistory;
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
                // 返回默认配置
                const defaultConfig = {
                    port: SnmpConst.DEFAULT_SNMP_SETTINGS.port,
                    maxTrapHistory: SnmpConst.DEFAULT_SNMP_SETTINGS.maxTrapHistory,
                    supportedVersions: ['v2c'],
                    refreshInterval: 5,
                    community: 'public',
                    v3Username: '',
                    securityLevel: 'noAuthNoPriv',
                    authProtocol: 'SHA',
                    authPassword: '',
                    privProtocol: 'AES',
                    privPassword: ''
                };
                return successResponse(defaultConfig, '获取默认配置');
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

            // 注册事件监听
            this.snmpTrapEventHandler = data => {
                logger.info(`snmpTrapEventHandler data: ${JSON.stringify(data)}`);
                webContents.send('snmp:event', successResponse(data));
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
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
            }
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
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
            }
        }
    }

    /**
     * 获取服务器状态
     */
    async handleGetServerStatus() {
        try {
            const isRunning = this.worker !== null;
            const trapCount = this.trapHistory.length;

            return successResponse(
                {
                    running: isRunning,
                    trapCount: trapCount,
                    onlineAgents: this.getOnlineAgentsCount()
                },
                '获取状态成功'
            );
        } catch (error) {
            logger.error('获取服务器状态失败:', error);
            return errorResponse('获取服务器状态失败: ' + error.message);
        }
    }

    /**
     * 获取Trap列表
     */
    async handleGetTrapList(event, params) {
        try {
            const { page = 1, pageSize = 20 } = params || {};
            const start = (page - 1) * pageSize;
            const end = start + pageSize;

            const traps = this.trapHistory.slice(start, end);
            const total = this.trapHistory.length;

            // 统计数据
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            const todayTraps = this.trapHistory.filter(trap => new Date(trap.timestamp) >= todayStart).length;
            const recentTraps = this.trapHistory.filter(trap => new Date(trap.timestamp) >= oneHourAgo).length;

            return successResponse(
                {
                    traps: traps,
                    total: total,
                    stats: {
                        total: total,
                        today: todayTraps,
                        recent: recentTraps,
                        onlineAgents: this.getOnlineAgentsCount()
                    }
                },
                '获取Trap列表成功'
            );
        } catch (error) {
            logger.error('获取Trap列表失败:', error);
            return errorResponse('获取Trap列表失败: ' + error.message);
        }
    }

    /**
     * 获取Trap详情
     */
    async handleGetTrapDetail(event, trapId) {
        try {
            const trap = this.trapHistory.find(t => t.id === trapId);
            if (!trap) {
                return errorResponse('Trap不存在');
            }
            return successResponse(trap, '获取Trap详情成功');
        } catch (error) {
            logger.error('获取Trap详情失败:', error);
            return errorResponse('获取Trap详情失败: ' + error.message);
        }
    }

    /**
     * 清空Trap历史
     */
    async handleClearTrapHistory() {
        try {
            this.trapHistory = [];
            this.store.set(this.snmpTrapHistoryKey, []);
            return successResponse(null, 'Trap历史清空成功');
        } catch (error) {
            logger.error('清空Trap历史失败:', error);
            return errorResponse('清空Trap历史失败: ' + error.message);
        }
    }

    /**
     * 处理接收到的Trap
     */
    handleTrapReceived(trapData) {
        try {
            logger.info('接收到Trap:', trapData);

            // 添加到历史记录
            this.addTrapToHistory(trapData);

            // 通知前端
            this.notifyRenderer('snmp:trapReceived', {
                status: 'success',
                data: trapData
            });
        } catch (error) {
            logger.error('处理Trap失败:', error);
        }
    }

    /**
     * 处理代理连接
     */
    handleAgentConnection(agentInfo) {
        try {
            logger.info('代理连接:', agentInfo);
            this.notifyRenderer('snmp:agentConnection', {
                status: 'success',
                data: agentInfo
            });
        } catch (error) {
            logger.error('处理代理连接失败:', error);
        }
    }

    /**
     * 处理代理断开
     */
    handleAgentDisconnection(agentInfo) {
        try {
            logger.info('代理断开:', agentInfo);
            this.notifyRenderer('snmp:agentDisconnection', {
                status: 'success',
                data: agentInfo
            });
        } catch (error) {
            logger.error('处理代理断开失败:', error);
        }
    }

    /**
     * 处理服务器状态变化
     */
    handleServerStatus(statusInfo) {
        try {
            logger.info('服务器状态变化:', statusInfo);
            this.notifyRenderer('snmp:serverStatus', {
                status: 'success',
                data: statusInfo
            });
        } catch (error) {
            logger.error('处理服务器状态变化失败:', error);
        }
    }

    /**
     * 添加Trap到历史记录
     */
    addTrapToHistory(trapData) {
        // 确保历史记录不超过最大数量
        if (this.trapHistory.length >= this.maxTrapHistory) {
            this.trapHistory = this.trapHistory.slice(-(this.maxTrapHistory - 1));
        }

        // 添加新的Trap
        this.trapHistory.push(trapData);

        // 持久化存储
        this.store.set(this.snmpTrapHistoryKey, this.trapHistory);
    }

    /**
     * 获取在线代理数量
     */
    getOnlineAgentsCount() {
        // 这里可以根据实际需要统计在线代理数量
        // 暂时返回0
        return 0;
    }

    /**
     * 通知渲染进程
     */
    notifyRenderer(channel, data) {
        try {
            const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send(channel, data);
            }
        } catch (error) {
            logger.error('通知渲染进程失败:', error);
        }
    }

    /**
     * 设置最大Trap历史记录数
     */
    setMaxTrapHistory(maxTrapHistory) {
        this.maxTrapHistory = maxTrapHistory;
    }

    /**
     * 获取SNMP服务运行状态
     */
    getSnmpRunning() {
        return this.worker !== null;
    }

    /**
     * 初始化Trap历史记录
     */
    initTrapHistory() {
        try {
            const history = this.store.get(this.snmpTrapHistoryKey);
            if (history && Array.isArray(history)) {
                this.trapHistory = history;
            }
        } catch (error) {
            logger.error('初始化Trap历史记录失败:', error);
            this.trapHistory = [];
        }
    }
}

module.exports = SnmpApp;
