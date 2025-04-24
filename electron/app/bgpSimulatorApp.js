const { app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const { BGP_REQ_TYPES } = require('../const/bgpReqConst');
const Logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { BGP_EVT_TYPES } = require('../const/BgpEvtConst');

class BgpSimulatorApp {
    constructor(ipc) {
        this.bgpStart = false;
        this.worker = null;
        this.configName = 'bgp-simulator-config.json';
        this.isDev = !app.isPackaged;
        this.logger = new Logger();
        this.stateChangeHandler = null;

        // 注册IPC处理程序
        this.registerHandlers(ipc);
    }

    registerHandlers(ipc) {
        ipc.handle('bgp-emulator:getNetworkInfo', async () => this.handleGetNetworkInfo());
        ipc.handle('bgp-emulator:saveConfig', async (event, config) => this.handleSaveConfig(event, config));
        ipc.handle('bgp-emulator:loadConfig', async () => this.handleLoadConfig());
        ipc.handle('bgp-emulator:startBgp', async (event, config) => this.handleStartBgp(event, config));
        ipc.handle('bgp-emulator:stopBgp', async () => this.handleStopBgp());
        ipc.handle('bgp-emulator:sendRoute', async (event, config) => this.handleSendRoute(event, config));
        ipc.handle('bgp-emulator:withdrawRoute', async (event, config) => this.handleWithdrawRoute(event, config));
    }

    async handleGetNetworkInfo(event) {
        try {
            const interfaces = os.networkInterfaces();
            return successResponse(interfaces);
        } catch (err) {
            return errorResponse('Failed to get network interfaces', err);
        }
    }

    // 获取配置文件路径
    getConfigPath() {
        return path.join(app.getPath('userData'), this.configName);
    }

    // 保存配置
    async handleSaveConfig(event, config) {
        try {
            const configPath = this.getConfigPath();
            const configDir = path.dirname(configPath);
            // 确保目录存在
            if (!fs.existsSync(configDir)) {
                await fs.promises.mkdir(configDir, { recursive: true });
            }
            await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
            return successResponse(null, '');
        } catch (error) {
            this.logger.error('Error saving config:', error);
            return errorResponse(error.message);
        }
    }

    // 加载配置
    async handleLoadConfig() {
        try {
            const configPath = this.getConfigPath();
            if (!fs.existsSync(configPath)) {
                return successResponse(null, 'BGP配置文件不存在');
            }
            const data = await fs.promises.readFile(configPath, 'utf8');
            return successResponse(JSON.parse(data), 'BGP配置文件加载成功');
        } catch (error) {
            this.logger.error('Error loading config:', error);
            return errorResponse(error.message);
        }
    }

    async handleStartBgp(event, bgpData) {
        const webContents = event.sender;
        try {
            if (this.bgpStart) {
                await this.worker.sendRequest(BGP_REQ_TYPES.STOP_BGP, null);

                const result = await this.worker.sendRequest(BGP_REQ_TYPES.START_BGP, bgpData);

                // 这里肯定是启动成功了，如果失败，会抛出异常
                this.logger.info(`bgp重启成功 result: ${JSON.stringify(result)}`);

                this.bgpStart = true;
                return successResponse(null, 'bgp协议重启成功');
            }

            this.logger.info('handleStartBgp', bgpData);

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/bgpSimulatorWorker.js')
                : path.join(process.resourcesPath, 'app.asar.unpacked', 'electron/worker/bgpSimulatorWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            // 定义事件处理函数
            this.stateChangeHandler = data => {
                webContents.send('bgp-emulator:updatePeerState', successResponse({ state: data.state }));
            };

            // 注册事件监听器，处理来自worker的事件通知
            this.worker.addEventListener(BGP_EVT_TYPES.BGP_STATE_CHANGE, this.stateChangeHandler);

            const result = await this.worker.sendRequest(BGP_REQ_TYPES.START_BGP, bgpData);

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
            this.worker.removeEventListener(BGP_EVT_TYPES.BGP_STATE_CHANGE, this.stateChangeHandler);
            await this.worker.terminate();
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

module.exports = BgpSimulatorApp;
