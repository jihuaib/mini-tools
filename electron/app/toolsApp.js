const { app } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { DEFAULT_TOOLS_SETTINGS } = require('../const/toolsConst');

class ToolsApp {
    constructor(ipc, store) {
        this.isDev = !app.isPackaged;
        this.stringGeneratorConfigFileKey = 'string-generator';
        this.packetParserConfigFileKey = 'packet-parser';
        this.formatterConfigFileKey = 'formatter';
        this.registerHandlers(ipc);
        this.store = store;

        this.maxMessageHistory = DEFAULT_TOOLS_SETTINGS.packetParser.maxMessageHistory;
        this.maxStringHistory = DEFAULT_TOOLS_SETTINGS.stringGenerator.maxStringHistory;
        this.maxFormatterHistory = DEFAULT_TOOLS_SETTINGS.formatter?.maxFormatterHistory || 20;

        // 抓包相关
        this.captureProcess = null;
        this.capturedPackets = [];
        this.currentPacketData = {
            id: 0,
            hexData: '',
            timestamp: '',
            isComplete: false
        };
    }

    registerHandlers(ipc) {
        this.ipc = ipc; // 保存ipc引用，用于实时发送数据

        // 字符串生成器
        ipc.handle('tools:generateString', async (event, templateData) =>
            this.handleGenerateString(event, templateData)
        );
        ipc.handle('tools:getGenerateStringHistory', async () => this.handleGetGenerateStringHistory());
        ipc.handle('tools:clearGenerateStringHistory', async () => this.handleClearGenerateStringHistory());

        // 报文解析器
        ipc.handle('tools:parsePacket', async (event, packetData) => this.handleParsePacket(event, packetData));
        ipc.handle('tools:getPacketParserHistory', async () => this.handleGetPacketParserHistory());
        ipc.handle('tools:clearPacketParserHistory', async () => this.handleClearPacketParserHistory());

        // 格式化工具
        ipc.handle('tools:formatData', async (event, formatterData) => this.handleFormatData(event, formatterData));
        ipc.handle('tools:getFormatterHistory', async () => this.handleGetFormatterHistory());
        ipc.handle('tools:clearFormatterHistory', async () => this.handleClearFormatterHistory());

        // 抓包工具
        ipc.handle('tools:capturePackets', async (event, captureOptions) => this.handleCapturePackets(event, captureOptions));
        ipc.handle('tools:stopCapture', async () => this.handleStopCapture());
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

    async handleGetFormatterHistory() {
        const config = this.store.get(this.formatterConfigFileKey);
        if (!config) {
            return successResponse([], '获取格式化历史记录成功');
        }
        return successResponse(config, '获取格式化历史记录成功');
    }

    async handleClearFormatterHistory() {
        this.store.set(this.formatterConfigFileKey, []);
        return successResponse(null, '清空格式化历史记录成功');
    }

    async handleFormatData(event, formatterData) {
        logger.info(`格式化数据: ${JSON.stringify(formatterData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/FormatterWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/FormatterWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), formatterData);

            this.saveFormatterToHistory(formatterData);

            logger.info('格式化结果:', result);
            if (result.verify) {
                return successResponse(result.data, '格式化成功');
            } else {
                return errorResponse(result.msg, result.errors);
            }
        } catch (err) {
            logger.error('Worker处理错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async saveFormatterToHistory(data) {
        let config = this.store.get(this.formatterConfigFileKey);
        if (!config) {
            config = [];
        }

        let isExist = false;
        config.forEach(element => {
            if (element.type === data.type && element.content === data.content && element.indent === data.indent) {
                isExist = true;
            }
        });

        if (isExist) {
            return;
        }

        if (config.length >= this.maxFormatterHistory) {
            config.splice(0, 1);
        }

        config.push(data);
        this.store.set(this.formatterConfigFileKey, config);
    }

    setMaxFormatterHistory(maxFormatterHistory) {
        this.maxFormatterHistory = maxFormatterHistory;
    }

    // 处理抓包请求
    async handleCapturePackets(event, captureOptions) {
        logger.info(`开始抓包: ${JSON.stringify(captureOptions)}`);

        try {
            // 如果已经有抓包进程在运行，先停止它
            if (this.captureProcess) {
                await this.handleStopCapture();
            }

            // 清空之前的抓包结果
            this.capturedPackets = [];

            const {
                interface: networkInterface = 'any',
                count = 50,
                filter = '',
                timeout = 30
            } = captureOptions;

            // 构建tshark命令，只获取原始十六进制数据
            const args = [
                '-i', '\\Device\\NPF_{8D9E35F0-9EC1-4F7B-B9F5-99B301F30B6C}',    // 网络接口
                '-c', count.toString(),    // 抓包数量
                '-x'                      // 显示十六进制数据
            ];

            // 如果有过滤条件，添加到命令中
            if (filter && filter.trim()) {
                args.push(filter.trim());
            }

            // 启动抓包进程
            console.log('C:\\Program Files\\Wireshark\\tshark.exe', args);
            this.captureProcess = spawn('C:\\Program Files\\Wireshark\\tshark.exe', args);

                        // 初始化数据缓冲和报文计数器
            let dataBuffer = '';
            let packetCounter = 0;

            // 重置当前报文数据
            this.currentPacketData = {
                id: 0,
                hexData: '',
                timestamp: '',
                isComplete: false
            };

            // 设置超时
            const timeoutId = setTimeout(() => {
                if (this.captureProcess) {
                    logger.info('抓包超时，停止进程');
                    this.captureProcess.kill();
                }
            }, timeout * 1000);

            // 处理标准输出 - 实时解析和发送
            this.captureProcess.stdout.on('data', (data) => {
                dataBuffer += data.toString();

                // 按行处理数据
                const lines = dataBuffer.split('\n');
                dataBuffer = lines.pop() || ''; // 保留最后一行（可能不完整）

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    // 当遇到新报文开始时增加计数器
                    if (trimmedLine.match(/^0000\s+/)) {
                        packetCounter++;
                    }
                    this.processPacketLine(trimmedLine, packetCounter, event);
                }
            });

            // 处理错误输出
            this.captureProcess.stderr.on('data', (data) => {
                const errorOutput = data.toString();
                logger.warn('tshark stderr:', errorOutput);

                // 发送错误信息到前端
                if (this.ipc && event && event.sender) {
                    event.sender.send('packet-error', {
                        error: errorOutput,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            // 进程结束处理
            this.captureProcess.on('close', (code) => {
                clearTimeout(timeoutId);

                // 发送最后一个可能未完成的报文
                if (this.currentPacketData.hexData) {
                    this.sendPacketToFrontend(event);
                }

                this.captureProcess = null;

                // 发送抓包完成事件
                if (this.ipc && event && event.sender) {
                    event.sender.send('capture-complete', {
                        code: code,
                        timestamp: new Date().toISOString(),
                        totalPackets: this.capturedPackets.length
                    });
                }

                logger.info(`抓包进程结束，代码: ${code}，共抓取 ${this.capturedPackets.length} 个报文`);
            });

            // 进程错误处理
            this.captureProcess.on('error', (error) => {
                clearTimeout(timeoutId);
                this.captureProcess = null;
                logger.error('启动tshark失败:', error.message);

                // 发送错误到前端
                if (this.ipc && event && event.sender) {
                    let errorMsg = error.message;
                    if (error.code === 'ENOENT') {
                        errorMsg = '未找到tshark命令，请确保已安装Wireshark';
                    }

                    event.sender.send('capture-error', {
                        error: errorMsg,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            // 立即返回开始抓包的状态
            return successResponse(null, '抓包已开始，数据将实时发送');

        } catch (err) {
            logger.error('抓包错误:', err.message);
            return errorResponse(err.message);
        }
    }

    // 停止抓包
    async handleStopCapture() {
        try {
            if (this.captureProcess) {
                logger.info('停止抓包进程');
                this.captureProcess.kill();
                this.captureProcess = null;
                return successResponse(null, '抓包已停止');
            } else {
                return successResponse(null, '没有正在运行的抓包进程');
            }
        } catch (err) {
            logger.error('停止抓包错误:', err.message);
            return errorResponse(err.message);
        }
    }

    // 处理每一行tshark输出，实时解析和发送报文
    processPacketLine(line, packetId, event) {
        try {
            // 跳过空行
            if (!line) {
                // 空行表示当前报文结束
                if (this.currentPacketData.hexData) {
                    this.sendPacketToFrontend(event);
                }
                return;
            }

            // 检查是否是十六进制数据行 (格式: 0000  xx xx xx xx ...)
            const hexLineMatch = line.match(/^([0-9a-fA-F]{4})\s+([0-9a-fA-F\s]+?)(?:\s{2,}.*)?$/);

            if (hexLineMatch) {
                const offset = hexLineMatch[1];
                const hexBytes = hexLineMatch[2];

                // 如果是新报文的开始 (偏移量为0000)
                if (offset === '0000') {
                    // 如果有之前的报文数据，先发送
                    if (this.currentPacketData.hexData) {
                        this.sendPacketToFrontend(event);
                    }

                    // 开始新报文
                    this.currentPacketData = {
                        id: packetId,
                        hexData: this.cleanHexBytes(hexBytes),
                        timestamp: new Date().toISOString(),
                        isComplete: false
                    };
                } else {
                    // 继续当前报文的数据
                    if (this.currentPacketData.hexData) {
                        this.currentPacketData.hexData += ' ' + this.cleanHexBytes(hexBytes);
                    }
                }
            }
        } catch (error) {
            logger.warn('处理报文行数据失败:', error.message, 'line:', line);
        }
    }

    // 清理和格式化十六进制字节
    cleanHexBytes(hexString) {
        return hexString
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    // 发送报文到前端
    sendPacketToFrontend(event) {
        if (!this.currentPacketData.hexData || !event || !event.sender) {
            return;
        }

        try {
            const packetData = {
                id: this.currentPacketData.id,
                timestamp: this.currentPacketData.timestamp,
                hexData: this.currentPacketData.hexData,
                length: this.currentPacketData.hexData.replace(/\s/g, '').length / 2 // 字节长度
            };

            // 发送到前端
            event.sender.send('tools:packetCaptured', packetData);

            // 保存到历史记录
            this.capturedPackets.push(packetData);

            logger.info(`发送报文 ${packetData.id}，长度: ${packetData.length} 字节`);

            // 重置当前报文数据
            this.currentPacketData = {
                id: 0,
                hexData: '',
                timestamp: '',
                isComplete: false
            };
        } catch (error) {
            logger.error('发送报文到前端失败:', error.message);
        }
    }

    // 注意：原有的批量解析方法已被实时解析替代
    // 保留此方法以防向后兼容需要，但在新的实时抓包中不再使用
}

module.exports = ToolsApp;
