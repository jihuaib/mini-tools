const { app, dialog } = require('electron');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const fs = require('fs');
const os = require('os');
const { DEFAULT_TOOLS_SETTINGS } = require('../const/toolsConst');
const iconv = require('iconv-lite');
const EventDispatcher = require('../utils/eventDispatcher');

class NativeApp {
    constructor(ipc, store) {
        this.isDev = !app.isPackaged;
        this.registerHandlers(ipc);

        // 抓包相关变量初始化 - 移到主进程
        this.capSession = null;
        this.isCapturing = false;

        this.formatterConfigFileKey = 'formatter';
        this.maxFormatterHistory = DEFAULT_TOOLS_SETTINGS.formatter.maxFormatterHistory;

        this.store = store;

        // 动态加载本地依赖
        this.Cap = null;
        this.libxmljs = null;
        this.initNativeDependencies();

        this.eventDispatcher = null;
    }

    initNativeDependencies() {
        // 加载 Cap 模块
        try {
            // 清除 Windows UNC 路径前缀 \\?\
            const cleanCapPath = require.resolve('cap').replace(/^\\\\\?\\/, '');
            const capModule = require(cleanCapPath);
            this.Cap = capModule.Cap;
            logger.info('Cap 模块加载成功');
        } catch (error) {
            logger.warn('Cap 模块加载失败，网络抓包功能将不可用:', error.message);
            this.Cap = null;
        }

        // 加载 libxmljs2 模块
        try {
            const cleanXmlPath = require.resolve('libxmljs2').replace(/^\\\\\?\\/, '');
            this.libxmljs = require(cleanXmlPath);
            logger.info('libxmljs2 模块加载成功');
        } catch (error) {
            logger.warn('libxmljs2 模块加载失败，XML格式化功能将不可用:', error.message);
            this.libxmljs = null;
        }
    }

    registerHandlers(ipc) {
        // 抓包工具
        ipc.handle('native:getNetworkInterfaces', async event => this.handleGetNetworkInterfaces(event));
        ipc.handle('native:startPacketCapture', async (event, config) => this.handleStartPacketCapture(event, config));
        ipc.handle('native:stopPacketCapture', async () => this.handleStopPacketCapture());
        ipc.handle('native:exportPacketsToPcap', async (event, packets) =>
            this.handleExportPacketsToPcap(event, packets)
        );

        // 格式化工具
        ipc.handle('native:formatData', async (event, data) => this.handleFormatData(event, data));
        ipc.handle('native:getFormatterHistory', async () => this.handleGetFormatterHistory());
        ipc.handle('native:clearFormatterHistory', async () => this.handleClearFormatterHistory());
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

    async handleFormatData(_event, formatterData) {
        logger.info(`格式化数据: ${JSON.stringify(formatterData)}`);

        try {
            let result;
            if (formatterData.type === 'json') {
                result = this.formatJSON(formatterData.content, formatterData.indent);
            } else if (formatterData.type === 'xml') {
                // 对于 XML 格式化，先检查依赖是否可用
                if (!this.libxmljs) {
                    return errorResponse('XML格式化功能不可用，请检查 libxmljs2 模块是否正确安装');
                }
                result = this.formatXML(formatterData.content, formatterData.indent);
            } else {
                return errorResponse('不支持的格式化类型');
            }

            if (result.status === 'success') {
                this.saveFormatterToHistory(formatterData);
                return successResponse(result.data, '格式化成功');
            } else {
                // 检验失败
                return errorResponse(result.msg, result.errors || []);
            }
        } catch (err) {
            logger.error('格式化处理错误:', err.message);
            return errorResponse(`格式化失败: ${err.message}`);
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

    // 抓包相关方法 - 重构为主进程实现
    async handleGetNetworkInterfaces(_event) {
        // 检查 Cap 模块是否可用
        if (!this.Cap) {
            logger.error('Cap 模块不可用，网络抓包功能无法使用');
            return errorResponse('网络抓包功能不可用，请检查 Cap 模块是否正确安装', { code: 'NPCAP_MISSING' });
        }

        try {
            // 获取底层抓包接口
            const capDevices = this.Cap.deviceList();

            // 获取系统网络接口信息
            const osInterfaces = os.networkInterfaces();

            // 合并接口信息，提供用户友好的显示
            const friendlyInterfaces = [];

            // 添加系统接口信息
            for (const [interfaceName, addresses] of Object.entries(osInterfaces)) {
                // 过滤掉内部回环接口和无效接口
                const validAddresses = addresses.filter(
                    addr => !addr.internal && (addr.family === 'IPv4' || addr.family === 'IPv6')
                );

                if (validAddresses.length > 0) {
                    const primaryAddress = validAddresses.find(addr => addr.family === 'IPv4') || validAddresses[0];

                    // 尝试找到对应的抓包设备
                    let capDevice = null;
                    for (const device of capDevices) {
                        // 通过接口名称或地址匹配
                        if (
                            device.name &&
                            (device.name.includes(interfaceName) ||
                                device.addresses?.some(addr => addr.addr === primaryAddress.address) ||
                                device.description?.includes(interfaceName))
                        ) {
                            capDevice = device;
                            break;
                        }
                    }

                    friendlyInterfaces.push({
                        name: interfaceName,
                        displayName: interfaceName,
                        description: capDevice?.description || interfaceName,
                        address: primaryAddress.address,
                        family: primaryAddress.family,
                        mac: primaryAddress.mac,
                        capDevice: capDevice?.name || null,
                        addresses: validAddresses
                    });
                }
            }

            // 如果没有找到友好接口，则回退到原始抓包设备列表
            if (friendlyInterfaces.length === 0) {
                for (const device of capDevices) {
                    friendlyInterfaces.push({
                        name: device.name,
                        displayName: device.description || device.name,
                        description: device.description || device.name,
                        address: device.addresses?.[0]?.addr || 'Unknown',
                        capDevice: device.name,
                        addresses: device.addresses || []
                    });
                }
            }

            logger.info('获取网络接口列表:', friendlyInterfaces);
            return successResponse(friendlyInterfaces, '获取网卡列表成功');
        } catch (err) {
            logger.error('获取网卡列表错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async handleStartPacketCapture(event, config) {
        // 检查 Cap 模块是否可用
        if (!this.Cap) {
            logger.error('Cap 模块不可用，无法启动网络抓包');
            return errorResponse('网络抓包功能不可用，请检查 Cap 模块是否正确安装', { code: 'NPCAP_MISSING' });
        }

        if (this.isCapturing) {
            logger.error('抓包已在进行中');
            return errorResponse('抓包已在进行中');
        }

        const webContents = event.sender;

        try {
            const { deviceName, filter, _snaplen = 65535 } = config;

            this.capSession = new this.Cap();

            // 如果指定了设备名称，需要将友好名称映射到底层设备名称
            let actualDeviceName = deviceName;
            if (deviceName) {
                // 获取接口列表来进行映射
                const capDevices = this.Cap.deviceList();
                const osInterfaces = os.networkInterfaces();

                // 首先检查是否是友好接口名称
                if (osInterfaces[deviceName]) {
                    // 查找对应的抓包设备
                    const interfaceAddresses = osInterfaces[deviceName].filter(
                        addr => !addr.internal && (addr.family === 'IPv4' || addr.family === 'IPv6')
                    );

                    if (interfaceAddresses.length > 0) {
                        const primaryAddress =
                            interfaceAddresses.find(addr => addr.family === 'IPv4') || interfaceAddresses[0];

                        for (const device of capDevices) {
                            if (
                                device.name &&
                                (device.name.includes(deviceName) ||
                                    device.addresses?.some(addr => addr.addr === primaryAddress.address) ||
                                    device.description?.includes(deviceName))
                            ) {
                                actualDeviceName = device.name;
                                break;
                            }
                        }
                    }
                }

                // 如果没有找到映射，检查是否直接是底层设备名称
                const deviceExists = capDevices.some(device => device.name === deviceName);
                if (!deviceExists && actualDeviceName === deviceName) {
                    logger.warn(`指定的设备 ${deviceName} 不存在，将使用默认设备`);
                    actualDeviceName = null;
                }
            }

            const device = actualDeviceName || this.Cap.findDevice();

            if (!device) {
                throw new Error('未找到可用的网络接口');
            }

            const bufSize = 10 * 1024 * 1024;
            const buffer = Buffer.alloc(bufSize);

            const linkType = this.capSession.open(device, filter || '', bufSize, buffer);

            this.isCapturing = true;
            let packetCount = 0;

            this.eventDispatcher = new EventDispatcher();
            this.eventDispatcher.setWebContents(webContents);

            // 响应抓包已开始
            this.eventDispatcher.emit(
                'native:packetEvent',
                successResponse({
                    type: 'PACKET_CAPTURE_START',
                    device: device,
                    linkType: linkType
                })
            );

            this.capSession.setMinBytes && this.capSession.setMinBytes(0);

            this.capSession.on('packet', (nbytes, trunc) => {
                try {
                    const timestamp = new Date();
                    packetCount++;

                    logger.info(`Captured packet: ${nbytes} bytes`);

                    let packetInfo = {
                        id: packetCount,
                        timestamp: timestamp.toISOString(),
                        length: nbytes,
                        truncated: trunc,
                        raw: buffer.toString('hex', 0, nbytes)
                    };

                    this.eventDispatcher.emit(
                        'native:packetEvent',
                        successResponse({
                            type: 'PACKET_CAPTURED',
                            packet: packetInfo
                        })
                    );
                } catch (err) {
                    this.eventDispatcher.emit(
                        'native:packetEvent',
                        errorResponse(err.message, {
                            type: 'PACKET_ERROR'
                        })
                    );
                }
            });

            logger.info('启动抓包成功:', { device, linkType, originalDeviceName: deviceName });
            return successResponse(null, '抓包启动成功');
        } catch (err) {
            this.isCapturing = false;
            if (this.capSession) {
                this.capSession.close();
                this.capSession = null;
            }
            this.eventDispatcher.cleanup();
            this.eventDispatcher = null;
            logger.error('启动抓包错误:', err.message);
            return errorResponse(`启动抓包失败: ${err.message}`);
        }
    }

    async handleStopPacketCapture() {
        try {
            if (this.capSession) {
                this.capSession.close();
                this.capSession = null;
            }
            this.isCapturing = false;
            logger.info('抓包已停止');
            return successResponse(null, '抓包已停止');
        } catch (err) {
            logger.error('停止抓包错误:', err.message);
            return errorResponse(err.message);
        } finally {
            this.eventDispatcher.cleanup();
            this.eventDispatcher = null;
        }
    }

    async handleExportPacketsToPcap(event, packets) {
        try {
            if (!packets || packets.length === 0) {
                return errorResponse('没有数据可以导出');
            }

            // 显示保存对话框
            const result = await dialog.showSaveDialog({
                title: '导出 PCAP 文件',
                defaultPath: `packets_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pcap`,
                filters: [
                    { name: 'PCAP Files', extensions: ['pcap'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (result.canceled) {
                return errorResponse('用户取消导出');
            }

            const filePath = result.filePath;

            // 创建 PCAP 文件
            await this.writePcapFile(filePath, packets);

            logger.info('PCAP 文件导出成功:', filePath);
            return successResponse({ filePath }, 'PCAP 文件导出成功');
        } catch (err) {
            logger.error('导出 PCAP 文件错误:', err.message);
            return errorResponse(`导出失败: ${err.message}`);
        }
    }

    async writePcapFile(filePath, packets) {
        return new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(filePath);

            writeStream.on('error', reject);
            writeStream.on('finish', resolve);

            // 写入 PCAP 全局头部 (24 bytes)
            const globalHeader = Buffer.alloc(24);
            globalHeader.writeUInt32LE(0xa1b2c3d4, 0); // magic number
            globalHeader.writeUInt16LE(2, 4); // version major
            globalHeader.writeUInt16LE(4, 6); // version minor
            globalHeader.writeInt32LE(0, 8); // thiszone
            globalHeader.writeUInt32LE(0, 12); // sigfigs
            globalHeader.writeUInt32LE(65535, 16); // snaplen
            globalHeader.writeUInt32LE(1, 20); // network (Ethernet)

            writeStream.write(globalHeader);

            // 写入每个数据包
            for (const packet of packets) {
                try {
                    const timestamp = new Date(packet.timestamp);
                    const packetData = Buffer.from(packet.raw, 'hex');

                    // 写入包记录头部 (16 bytes)
                    const recordHeader = Buffer.alloc(16);
                    recordHeader.writeUInt32LE(Math.floor(timestamp.getTime() / 1000), 0); // ts_sec
                    recordHeader.writeUInt32LE((timestamp.getTime() % 1000) * 1000, 4); // ts_usec
                    recordHeader.writeUInt32LE(packetData.length, 8); // incl_len
                    recordHeader.writeUInt32LE(packet.length || packetData.length, 12); // orig_len

                    writeStream.write(recordHeader);
                    writeStream.write(packetData);
                } catch (err) {
                    logger.warn(`跳过无效数据包 ${packet.id}:`, err.message);
                }
            }

            writeStream.end();
        });
    }

    getPacketCaptureRunning() {
        return null !== this.capSession;
    }

    // JSON格式化
    formatJSON(jsonString, indent) {
        try {
            // 确保indent是有效的正整数
            const validIndent = Math.max(1, Math.floor(Number(indent)) || 2);

            // 解析JSON字符串
            const obj = JSON.parse(jsonString);

            // 美化输出，使用指定的缩进空格数
            return {
                status: 'success',
                data: JSON.stringify(obj, null, validIndent)
            };
        } catch (error) {
            const errorInfo = this.getDetailedJSONError(jsonString, error);
            return {
                status: 'error',
                msg: errorInfo.message,
                errors: errorInfo.errors // 返回具体的错误位置信息
            };
        }
    }

    // 获取详细的JSON错误信息
    getDetailedJSONError(jsonString, originalError) {
        const errorMessage = originalError.message;
        const errors = [];

        // 尝试从错误信息中提取位置
        const positionMatch = errorMessage.match(/position (\d+)/i);
        if (positionMatch) {
            const position = parseInt(positionMatch[1]);
            const { line, column, context } = this.getLineColumnFromPosition(jsonString, position);

            errors.push({
                line: line,
                column: column,
                message: `JSON 语法错误: ${originalError.message}`,
                type: 'syntax'
            });

            return {
                message: `JSON 语法错误 (第 ${line} 行，第 ${column} 列): ${originalError.message}\n错误位置前后内容: ${context}`,
                errors: errors
            };
        }

        // 常见JSON错误的详细提示
        if (errorMessage.includes('Unexpected token')) {
            const tokenMatch = errorMessage.match(/Unexpected token (.+?) in JSON at position (\d+)/);
            if (tokenMatch) {
                const token = tokenMatch[1];
                const position = parseInt(tokenMatch[2]);
                const { line, column } = this.getLineColumnFromPosition(jsonString, position);

                errors.push({
                    line: line,
                    column: column,
                    message: `遇到意外的字符 "${token}"`,
                    type: 'syntax'
                });

                return {
                    message:
                        `JSON 语法错误: 遇到意外的字符 "${token}" (第 ${line} 行，第 ${column} 列)\n` +
                        `可能的原因:\n` +
                        `- 字符串未用双引号包裹\n` +
                        `- 对象属性名未用双引号包裹\n` +
                        `- 多余的逗号\n` +
                        `- 缺少逗号分隔`,
                    errors: errors
                };
            } else {
                // 如果没有position信息，尝试其他方式定位
                const simpleTokenMatch = errorMessage.match(/Unexpected token (.+?) in JSON/);
                if (simpleTokenMatch) {
                    const token = simpleTokenMatch[1];
                    const errorLine = this.findErrorLineByContent(jsonString, token);

                    if (errorLine) {
                        errors.push({
                            line: errorLine,
                            column: 1,
                            message: `遇到意外的字符 "${token}"`,
                            type: 'syntax'
                        });
                    }

                    return {
                        message:
                            `JSON 语法错误: 遇到意外的字符 "${token}"\n` +
                            `可能的原因:\n` +
                            `- 字符串未用双引号包裹\n` +
                            `- 对象属性名未用双引号包裹\n` +
                            `- 多余的逗号\n` +
                            `- 缺少逗号分隔`,
                        errors: errors
                    };
                }
            }
        }

        if (errorMessage.includes('Unexpected end of JSON input')) {
            // 找到最后一个有内容的行
            const lines = jsonString.split('\n');
            const lastNonEmptyLine = this.findLastNonEmptyLine(lines);

            if (lastNonEmptyLine > 0) {
                errors.push({
                    line: lastNonEmptyLine,
                    column: lines[lastNonEmptyLine - 1].length,
                    message: 'JSON 内容不完整，可能缺少闭合符号',
                    type: 'syntax'
                });
            }

            return {
                message:
                    `JSON 语法错误: JSON 内容不完整\n` +
                    `可能的原因:\n` +
                    `- 缺少闭合的花括号 "}" 或方括号 "]"\n` +
                    `- JSON 内容被意外截断`,
                errors: errors
            };
        }

        if (errorMessage.includes('Unexpected string')) {
            // 尝试通过逐行解析找到错误行
            const errorLineInfo = this.findJSONErrorLine(jsonString, originalError);
            if (errorLineInfo) {
                errors.push({
                    line: errorLineInfo.line,
                    column: errorLineInfo.column || 1,
                    message: '字符串格式错误，可能缺少逗号分隔',
                    type: 'syntax'
                });

                return {
                    message: errorLineInfo.message,
                    errors: errors
                };
            }

            return {
                message:
                    `JSON 语法错误: 字符串格式错误\n` +
                    `可能的原因:\n` +
                    `- 缺少逗号分隔多个属性或数组元素\n` +
                    `- 对象属性名或值的引号使用错误`,
                errors: errors
            };
        }

        // 尝试通过其他方式定位错误行
        const errorLineInfo = this.findJSONErrorLine(jsonString, originalError);
        if (errorLineInfo) {
            errors.push({
                line: errorLineInfo.line,
                column: errorLineInfo.column || 1,
                message: errorLineInfo.message,
                type: 'syntax'
            });

            return {
                message: errorLineInfo.message,
                errors: errors
            };
        }

        // 如果无法准确定位，返回通用错误
        errors.push({
            line: 1,
            column: 1,
            message: `JSON 格式错误: ${originalError.message}`,
            type: 'syntax'
        });

        return {
            message: `JSON 格式错误: ${originalError.message}`,
            errors: errors
        };
    }

    // 尝试通过解析找到JSON错误行
    findJSONErrorLine(jsonString, error) {
        const lines = jsonString.split('\n');

        // 逐行尝试解析，找到出错的行
        for (let i = 0; i < lines.length; i++) {
            try {
                const partialJson = lines.slice(0, i + 1).join('\n');
                JSON.parse(partialJson);
            } catch (e) {
                // 如果在这一行出错，且错误类型相似，则认为是这一行的问题
                if (e.message.includes(error.message.split(' ')[0])) {
                    return {
                        line: i + 1,
                        column: 1,
                        message: `第 ${i + 1} 行存在语法错误: ${error.message}`
                    };
                }
            }
        }

        return null;
    }

    // 根据内容查找错误行
    findErrorLineByContent(jsonString, token) {
        const lines = jsonString.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(token)) {
                return i + 1;
            }
        }
        return null;
    }

    // 找到最后一个非空行
    findLastNonEmptyLine(lines) {
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim()) {
                return i + 1;
            }
        }
        return 1;
    }

    // 根据字符位置计算行号和列号
    getLineColumnFromPosition(text, position) {
        const lines = text.substring(0, position).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        // 获取错误位置前后的上下文
        const allLines = text.split('\n');
        const contextStart = Math.max(0, line - 2);
        const contextEnd = Math.min(allLines.length, line + 1);
        const context = allLines.slice(contextStart, contextEnd).join('\n');

        return { line, column, context };
    }

    // XML格式化
    formatXML(xmlString, indent = 2) {
        if (!this.libxmljs) {
            return {
                status: 'error',
                msg: 'XML格式化功能不可用，请检查 libxmljs2 模块是否正确安装',
                errors: [
                    {
                        line: 1,
                        column: 1,
                        message: 'libxmljs2 模块不可用',
                        type: 'dependency'
                    }
                ]
            };
        }

        try {
            // 自动识别 encoding 声明
            let detectedEncoding = 'utf8';
            const head = xmlString.slice(0, 512);
            const encodingMatch = head.match(/encoding=["'](.*?)["']/i);
            if (encodingMatch) {
                const declared = encodingMatch[1].toLowerCase();
                if (declared === 'gb2312' || declared === 'gbk') {
                    detectedEncoding = 'gb2312';
                }
            }

            // 如果非 utf8 编码，先解码成 UTF-8
            if (detectedEncoding !== 'utf8' && Buffer.isBuffer(xmlString)) {
                xmlString = iconv.decode(xmlString, detectedEncoding);
            }

            // 替换编码声明为 UTF-8
            xmlString = xmlString.replace(/<\?xml(.*?)encoding=["'].*?["']/i, '<?xml$1encoding="UTF-8"');

            // 解析和格式化
            const xmlDoc = this.libxmljs.parseXml(xmlString);
            const rawXml = xmlDoc.toString();
            const formattedXml = this.formatXMLString(rawXml, indent);

            return {
                status: 'success',
                data: formattedXml
            };
        } catch (error) {
            const errorInfo = this.getDetailedXMLError(xmlString.toString(), error);
            return {
                status: 'error',
                msg: errorInfo.message,
                errors: errorInfo.errors
            };
        }
    }

    // 自定义XML格式化函数
    formatXMLString(xmlString, indent = 2) {
        // 确保indent是有效的非负整数
        const validIndent = Math.max(0, Math.floor(Number(indent)) || 2);
        const space = ' '.repeat(validIndent);

        // 移除多余的空白字符并分割成tokens
        const tokens = xmlString
            .replace(/>\s+</g, '><')
            .trim()
            .split(/(<[^>]*>)/);
        let formatted = '';
        let level = 0;
        let needsIndent = false;

        for (const token of tokens) {
            if (!token) continue;

            if (token.startsWith('<')) {
                // 处理XML标签
                if (token.startsWith('</')) {
                    // 结束标签：减少缩进
                    level = Math.max(0, level - 1);
                    if (needsIndent) {
                        formatted += '\n' + space.repeat(level);
                    }
                    formatted += token;
                    needsIndent = true;
                } else if (token.endsWith('/>')) {
                    // 自闭合标签：不改变缩进级别
                    if (needsIndent) {
                        formatted += '\n' + space.repeat(level);
                    }
                    formatted += token;
                    needsIndent = true;
                } else if (token.startsWith('<?') || token.startsWith('<!--')) {
                    // XML声明或注释：不改变缩进级别
                    if (needsIndent && formatted) {
                        formatted += '\n' + space.repeat(level);
                    }
                    formatted += token;
                    needsIndent = true;
                } else {
                    // 开始标签：增加缩进
                    if (needsIndent) {
                        formatted += '\n' + space.repeat(level);
                    }
                    formatted += token;
                    level++;
                    needsIndent = true;
                }
            } else {
                // 文本内容
                const trimmedToken = token.trim();
                if (trimmedToken) {
                    // 如果有实际内容，直接添加（不换行）
                    formatted += trimmedToken;
                    needsIndent = true;
                }
            }
        }

        return formatted.trim();
    }

    // 获取详细的XML错误信息
    getDetailedXMLError(xmlString, error) {
        const errors = [];
        const errorMessage = error.toString();

        // 尝试从libxmljs2错误信息中提取行号和列号
        let line = 1;
        let column = 1;

        if (error.line) {
            line = parseInt(error.line);
        }
        if (error.column) {
            column = parseInt(error.column);
        }

        // 分析不同类型的XML错误
        if (errorMessage.includes('StartTag: invalid element name') || errorMessage.includes('xmlParseStartTag')) {
            errors.push({
                line: line,
                column: column,
                message: '无效的XML标签名',
                type: 'syntax'
            });

            return {
                message:
                    `XML 语法错误 (第 ${line} 行，第 ${column} 列): 无效的标签名\n` +
                    `可能的原因:\n` +
                    `- 标签名包含非法字符\n` +
                    `- 标签名以数字开头\n` +
                    `- 标签名为空`,
                errors: errors
            };
        }

        if (errorMessage.includes('Opening and ending tag mismatch') || errorMessage.includes('expected')) {
            const tagMatch = errorMessage.match(/Opening and ending tag mismatch: (\w+) line \d+ and (\w+)/);
            if (tagMatch) {
                const openTag = tagMatch[1];
                const closeTag = tagMatch[2];

                errors.push({
                    line: line,
                    column: column,
                    message: `标签不匹配: 开始标签 <${openTag}> 与结束标签 </${closeTag}> 不匹配`,
                    type: 'mismatch'
                });

                return {
                    message:
                        `XML 标签不匹配错误 (第 ${line} 行): 开始标签 <${openTag}> 与结束标签 </${closeTag}> 不匹配\n` +
                        `请检查标签名是否一致`,
                    errors: errors
                };
            }

            errors.push({
                line: line,
                column: column,
                message: '标签不匹配',
                type: 'mismatch'
            });

            return {
                message:
                    `XML 标签不匹配错误 (第 ${line} 行，第 ${column} 列)\n` + `请检查开始标签和结束标签是否正确配对`,
                errors: errors
            };
        }

        if (errorMessage.includes('Premature end of data') || errorMessage.includes("EndTag: '<' not found")) {
            errors.push({
                line: line,
                column: column,
                message: 'XML内容不完整，可能缺少闭合标签',
                type: 'unclosed'
            });

            return {
                message:
                    `XML 语法错误 (第 ${line} 行): XML内容不完整\n` +
                    `可能的原因:\n` +
                    `- 缺少闭合标签\n` +
                    `- XML文档被意外截断`,
                errors: errors
            };
        }

        if (errorMessage.includes('not well-formed') || errorMessage.includes('xmlParseCharData')) {
            errors.push({
                line: line,
                column: column,
                message: 'XML格式不正确',
                type: 'syntax'
            });

            return {
                message:
                    `XML 语法错误 (第 ${line} 行，第 ${column} 列): XML格式不正确\n` +
                    `可能的原因:\n` +
                    `- 包含非法字符\n` +
                    `- 属性值未用引号包裹\n` +
                    `- 标签语法错误`,
                errors: errors
            };
        }

        if (errorMessage.includes('Empty content') || xmlString.trim() === '') {
            errors.push({
                line: 1,
                column: 1,
                message: 'XML内容为空',
                type: 'empty'
            });

            return {
                message: 'XML 内容为空\n请输入有效的XML内容',
                errors: errors
            };
        }

        // 处理其他类型的错误
        errors.push({
            line: line,
            column: column,
            message: errorMessage,
            type: 'syntax'
        });

        return {
            message: `XML 解析错误 (第 ${line} 行，第 ${column} 列): ${errorMessage}`,
            errors: errors
        };
    }
}

module.exports = NativeApp;
