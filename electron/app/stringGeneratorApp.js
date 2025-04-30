const { app } = require('electron');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const Logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const Store = require('electron-store');
class StringGeneratorApp {
    constructor(ipc, store) {
        this.isDev = !app.isPackaged;
        this.logger = new Logger();
        this.configFileKey = 'string-generator';
        this.registerHandlers(ipc);
        this.store = store;
    }

    registerHandlers(ipc) {
        ipc.handle('string-generator:generateString', async (event, templateData) =>
            this.handleGenerateString(event, templateData)
        );
        ipc.handle('string-generator:saveConfig', async (event, config) => this.handleSaveConfig(event, config));
        ipc.handle('string-generator:loadConfig', async () => this.handleLoadConfig());
    }

    // 保存配置
    async handleSaveConfig(event, config) {
        try {
            this.store.set(this.configFileKey, config);
            return successResponse(null, '配置文件保存成功');
        } catch (error) {
            this.logger.error('Error saving config:', error);
            return errorResponse(error.message);
        }
    }

    // 加载配置
    async handleLoadConfig() {
        try {
            const config = this.store.get(this.configFileKey);
            if (!config) {
                return successResponse(null, '配置文件不存在');
            }
            return successResponse(config, '配置文件加载成功');
        } catch (error) {
            this.logger.error('Error loading config:', error);
            return errorResponse(error.message);
        }
    }

    async handleGenerateString(event, templateData) {
        this.logger.info(`${JSON.stringify(templateData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/StringGeneratorWorker.js')
                : path.join(process.resourcesPath, 'app.asar.unpacked', 'electron/worker/StringGeneratorWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), templateData);

            this.logger.info('Worker处理结果:', result);
            return successResponse(result, 'Worker处理结果');
        } catch (err) {
            this.logger.error('Worker处理结果:', err);
            return errorResponse(err.message);
        }
    }
}

module.exports = StringGeneratorApp;
