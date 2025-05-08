const { app } = require('electron');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const Logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');

class ToolsApp {
    constructor(ipc, store) {
        this.isDev = !app.isPackaged;
        this.logger = new Logger();
        this.stringGeneratorConfigFileKey = 'string-generator';
        this.packetParserConfigFileKey = 'packet-parser';
        this.registerHandlers(ipc);
        this.store = store;
    }

    registerHandlers(ipc) {
        // 字符串生成器
        ipc.handle('tools:generateString', async (event, templateData) =>
            this.handleGenerateString(event, templateData)
        );
        ipc.handle('tools:saveGenerateStringConfig', async (event, config) =>
            this.handleSaveGenerateStringConfig(event, config)
        );
        ipc.handle('tools:loadGenerateStringConfig', async () => this.handleLoadGenerateStringConfig());

        // 报文解析器
        ipc.handle('tools:parsePacket', async (event, packetData) => this.handleParsePacket(event, packetData));
        ipc.handle('tools:savePacketParserConfig', async (event, config) =>
            this.handleSavePacketParserConfig(event, config)
        );
        ipc.handle('tools:loadPacketParserConfig', async () => this.handleLoadPacketParserConfig());
    }

    // 保存配置 - 字符串生成器
    async handleSaveGenerateStringConfig(event, config) {
        try {
            this.store.set(this.stringGeneratorConfigFileKey, config);
            return successResponse(null, '配置文件保存成功');
        } catch (error) {
            this.logger.error('Error saving config:', error.message);
            return errorResponse(error.message);
        }
    }

    // 加载配置 - 字符串生成器
    async handleLoadGenerateStringConfig() {
        try {
            const config = this.store.get(this.stringGeneratorConfigFileKey);
            if (!config) {
                return successResponse(null, '配置文件不存在');
            }
            return successResponse(config, '配置文件加载成功');
        } catch (error) {
            this.logger.error('Error loading config:', error.message);
            return errorResponse(error.message);
        }
    }

    // 保存配置 - 报文解析器
    async handleSavePacketParserConfig(event, config) {
        try {
            this.store.set(this.packetParserConfigFileKey, config);
            return successResponse(null, '配置文件保存成功');
        } catch (error) {
            this.logger.error('Error saving packet parser config:', error.message);
            return errorResponse(error.message);
        }
    }

    // 加载配置 - 报文解析器
    async handleLoadPacketParserConfig() {
        try {
            const config = this.store.get(this.packetParserConfigFileKey);
            if (!config) {
                return successResponse(null, '配置文件不存在');
            }
            return successResponse(config, '配置文件加载成功');
        } catch (error) {
            this.logger.error('Error loading packet parser config:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGenerateString(event, templateData) {
        this.logger.info(`${JSON.stringify(templateData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/StringGeneratorWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/StringGeneratorWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), templateData);

            this.logger.info('Worker处理结果:', result);
            return successResponse(result, 'Worker处理成功');
        } catch (err) {
            this.logger.error('Worker处理错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async handleParsePacket(event, packetData) {
        this.logger.info(`解析报文: ${JSON.stringify(packetData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/packetParserWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/packetParserWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), packetData);

            this.logger.info('报文解析结果:', result);
            return successResponse(result, '报文解析成功');
        } catch (err) {
            this.logger.error('报文解析错误:', err.message);
            return errorResponse(err.message);
        }
    }
}

module.exports = ToolsApp;
