const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const Logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');

class StringGeneratorApp {
    constructor(ipc) {
        this.isDev = !app.isPackaged;
        this.logger = new Logger();
        this.configName = 'string-generator-config.json';
        this.registerHandlers(ipc);
    }

    registerHandlers(ipc) {
        ipc.handle('string-generator:generateString', async (event, templateData) =>
            this.handleGenerateString(event, templateData)
        );
        ipc.handle('string-generator:saveConfig', async (event, config) => this.handleSaveConfig(event, config));
        ipc.handle('string-generator:loadConfig', async () => this.handleLoadConfig());
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
            return successResponse(null, '配置文件保存成功');
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
                return successResponse(null, '配置文件不存在');
            }
            const data = await fs.promises.readFile(configPath, 'utf8');
            return successResponse(JSON.parse(data), '配置文件加载成功');
        } catch (error) {
            this.logger.error('Error loading config:', error);
            return errorResponse(error.message);
        }
    }

    async handleGenerateString(event, templateData) {
        this.logger.info('handleGenerateTemplateString', templateData);

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
