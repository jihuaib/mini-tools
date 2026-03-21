const { app } = require('electron');
const path = require('path');
const crypto = require('crypto');
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

        // TCP-AO MAC 计算器
        ipc.handle('tools:calculateTcpAoMac', async (event, data) => this.handleCalculateTcpAoMac(event, data));
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

    hexToBuffer(hex) {
        const cleaned = hex.replace(/\s+/g, '').replace(/:/g, '');
        if (cleaned.length === 0) return Buffer.alloc(0);
        if (cleaned.length % 2 !== 0) throw new Error(`十六进制字符串长度不合法: "${hex}"`);
        if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error(`十六进制字符串包含非法字符: "${hex}"`);
        return Buffer.from(cleaned, 'hex');
    }

    parseIpv4Packet(buf) {
        if (buf.length < 20) throw new Error('IP 报文长度不足（最少 20 字节）');
        const version = buf[0] >> 4;
        if (version !== 4) throw new Error(`仅支持 IPv4，当前版本号: ${version}`);

        const ihl = (buf[0] & 0x0f) * 4;
        if (ihl < 20) throw new Error(`IP 头部长度非法: ${ihl}`);

        const totalLength = buf.readUInt16BE(2);
        if (buf.length < totalLength)
            throw new Error(`报文实际长度 ${buf.length} 小于 Total Length 字段 ${totalLength}`);

        const protocol = buf[9];
        const srcIp = buf.subarray(12, 16);
        const dstIp = buf.subarray(16, 20);

        const tcpLength = totalLength - ihl;
        if (tcpLength < 20) throw new Error(`TCP 段长度不足（最少 20 字节）: ${tcpLength}`);

        // 复制 TCP 段并清零校验和字段（RFC 5925 Section 5.1 要求）
        const tcpSegment = Buffer.from(buf.subarray(ihl, totalLength));
        tcpSegment[16] = 0;
        tcpSegment[17] = 0;

        // IPv4 伪头部：源IP(4) + 目的IP(4) + 00(1) + 协议(1) + TCP段长度(2)
        const pseudoHeader = Buffer.alloc(12);
        srcIp.copy(pseudoHeader, 0);
        dstIp.copy(pseudoHeader, 4);
        pseudoHeader[8] = 0;
        pseudoHeader[9] = protocol;
        pseudoHeader.writeUInt16BE(tcpLength, 10);

        return { pseudoHeader, tcpSegment };
    }

    async handleCalculateTcpAoMac(_event, { key, sne, ipPacket }) {
        try {
            const keyBuf = Buffer.from(key, 'utf8');
            const sneBuf = this.hexToBuffer(sne);
            const ipBuf = this.hexToBuffer(ipPacket);

            const { pseudoHeader, tcpSegment } = this.parseIpv4Packet(ipBuf);

            // OpenSSL MD5_Update 风格：MD5(key || SNE || 伪头部 || TCP段)
            const msgBuf = Buffer.concat([sneBuf, pseudoHeader, tcpSegment]);

            const hash = crypto.createHash('md5');
            hash.update(keyBuf);
            hash.update(msgBuf);
            const macFull = hash.digest();

            return successResponse(
                {
                    pseudoHeaderHex: pseudoHeader.toString('hex').toUpperCase(),
                    messageHex: msgBuf.toString('hex').toUpperCase(),
                    mac: macFull.toString('hex').toUpperCase(),
                    mac96: macFull.subarray(0, 12).toString('hex').toUpperCase()
                },
                'TCP-AO MAC 计算成功'
            );
        } catch (err) {
            logger.error('TCP-AO MAC 计算错误:', err.message);
            return errorResponse(err.message);
        }
    }

    setMaxMessageHistory(maxMessageHistory) {
        this.maxMessageHistory = maxMessageHistory;
    }

    setMaxStringHistory(maxStringHistory) {
        this.maxStringHistory = maxStringHistory;
    }
}

module.exports = ToolsApp;
