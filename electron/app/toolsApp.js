const { app } = require('electron');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { DEFAULT_TOOLS_SETTINGS } = require('../const/toolsConst');

class ToolsApp {
    constructor(ipc, store) {
        this.isDev = !app.isPackaged;
        this.stringGeneratorConfigFileKey = 'string-generator';
        this.packetParserConfigFileKey = 'packet-parser';
        this.registerHandlers(ipc);
        this.store = store;

        this.maxMessageHistory = DEFAULT_TOOLS_SETTINGS.packetParser.maxMessageHistory;
        this.maxStringHistory = DEFAULT_TOOLS_SETTINGS.stringGenerator.maxStringHistory;
    }

    registerHandlers(ipc) {
        // 字符串生成器
        ipc.handle('tools:generateString', async (event, templateData) =>
            this.handleGenerateString(event, templateData)
        );
        ipc.handle('tools:getGenerateStringHistory', async () => this.handleGetGenerateStringHistory());
        ipc.handle('tools:clearGenerateStringHistory', async () => this.handleClearGenerateStringHistory());

        // 报文解析器
        ipc.handle('tools:parsePacket', async (event, packetData) => this.handleParsePacket(event, packetData));
        ipc.handle('tools:parsePacketNoSaveHistory', async (event, packetData) =>
            this.handleParsePacketNoSaveHistory(event, packetData)
        );
        ipc.handle('tools:getPacketParserHistory', async () => this.handleGetPacketParserHistory());
        ipc.handle('tools:clearPacketParserHistory', async () => this.handleClearPacketParserHistory());
    }

    async handleGetGenerateStringHistory() {
        const config = this.store.get(this.stringGeneratorConfigFileKey);
        if (!config) {
            return successResponse([], '获取字符串生成历史记录成功');
        }
        return successResponse(config, '获取字符串生成历史记录成功');
    }

    async handleClearGenerateStringHistory() {
        this.store.set(this.stringGeneratorConfigFileKey, []);
        return successResponse(null, '清空字符串生成历史记录成功');
    }

    async handleGenerateString(event, templateData) {
        logger.info(`${JSON.stringify(templateData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/StringGeneratorWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/StringGeneratorWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), templateData);

            this.saveGenerateStringToHistory(templateData);

            logger.info('Worker处理结果:', result);
            return successResponse(result, 'Worker处理成功');
        } catch (err) {
            logger.error('Worker处理错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async saveGenerateStringToHistory(result) {
        let config = this.store.get(this.stringGeneratorConfigFileKey);
        if (!config) {
            config = [];
        }

        let isExist = false;
        config.forEach(element => {
            if (
                element.template === result.template &&
                element.placeholder === result.placeholder &&
                element.start === result.start &&
                element.end === result.end
            ) {
                isExist = true;
            }
        });

        if (isExist) {
            return;
        }

        if (config.length >= this.maxStringHistory) {
            config.splice(0, 1);
        }

        config.push(result);
        this.store.set(this.stringGeneratorConfigFileKey, config);
    }

    async saveToHistory(data) {
        let config = this.store.get(this.packetParserConfigFileKey);
        if (!config) {
            config = [];
        }

        let isExist = false;
        config.forEach(element => {
            if (
                element.packetData === data.packetData &&
                element.protocolPort === data.protocolPort &&
                element.protocolType === data.protocolType &&
                element.startLayer === data.startLayer
            ) {
                isExist = true;
            }
        });

        if (isExist) {
            return;
        }

        if (config.length >= this.maxMessageHistory) {
            config.splice(0, 1);
        }

        config.push(data);
        this.store.set(this.packetParserConfigFileKey, config);
    }

    async handleParsePacket(event, packetData) {
        logger.info(`解析报文: ${JSON.stringify(packetData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/packetParserWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/packetParserWorker.js');

            // 保存到历史记录
            this.saveToHistory(packetData);

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), packetData);

            logger.info('报文解析结果:', result);
            return successResponse(result, '报文解析成功');
        } catch (err) {
            logger.error('报文解析错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async handleParsePacketNoSaveHistory(event, packetData) {
        logger.info(`解析报文: ${JSON.stringify(packetData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/packetParserWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/packetParserWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), packetData);

            logger.info('报文解析结果:', result);
            return successResponse(result, '报文解析成功');
        } catch (err) {
            logger.error('报文解析错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async handleClearPacketParserHistory() {
        this.store.set(this.packetParserConfigFileKey, []);
        return successResponse(null, '清空报文解析历史记录成功');
    }

    async handleGetPacketParserHistory() {
        const config = this.store.get(this.packetParserConfigFileKey);
        if (!config) {
            return successResponse([], '获取报文解析历史记录成功');
        }

        return successResponse(config, '获取报文解析历史记录成功');
    }

    setMaxMessageHistory(maxMessageHistory) {
        this.maxMessageHistory = maxMessageHistory;
    }

    setMaxStringHistory(maxStringHistory) {
        this.maxStringHistory = maxStringHistory;
    }
}

module.exports = ToolsApp;
