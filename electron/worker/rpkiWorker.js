const { parentPort, workerData } = require('worker_threads');
const net = require('net');
const { v4: uuidv4 } = require('uuid');
const { RPKI_MSG_TYPE, RPKI_PROTOCOL_VERSION, RPKI_FLAGS, RPKI_ROA_STATUS } = require('../const/rpkiConst');
const { RPKI_REQ_TYPES } = require('../const/rpkiReqConst');
const { RPKI_EVT_TYPES } = require('../const/rpkiEvtConst');
const Logger = require('../log/logger');

class RpkiWorker {
    constructor() {
        this.server = null;
        this.clients = new Map();
        this.routeOriginAuthorizations = new Map(); // Map客户端ID -> Map ROA ID -> ROA对象
        this.logger = new Logger();
        this.setupWorkerMessageHandler();
    }

    setupWorkerMessageHandler() {
        parentPort.on('message', async message => {
            try {
                const { id, type, data } = message;

                // 处理请求消息
                if (id && type) {
                    let result = null;

                    switch (type) {
                        case RPKI_REQ_TYPES.START_RPKI:
                            result = await this.startRpki(data);
                            break;
                        case RPKI_REQ_TYPES.STOP_RPKI:
                            result = await this.stopRpki();
                            break;
                        case RPKI_REQ_TYPES.GET_CLIENT_LIST:
                            result = await this.getClientList();
                            break;
                        case RPKI_REQ_TYPES.GET_CLIENT:
                            result = await this.getClient(data);
                            break;
                        case RPKI_REQ_TYPES.DISCONNECT_CLIENT:
                            result = await this.disconnectClient(data);
                            break;
                        case RPKI_REQ_TYPES.GET_ROA_LIST:
                            result = await this.getRoaList(data);
                            break;
                        case RPKI_REQ_TYPES.ADD_ROA:
                            result = await this.addRoa(data);
                            break;
                        case RPKI_REQ_TYPES.UPDATE_ROA:
                            result = await this.updateRoa(data);
                            break;
                        case RPKI_REQ_TYPES.DELETE_ROA:
                            result = await this.deleteRoa(data);
                            break;
                        case RPKI_REQ_TYPES.CLEAR_ALL_ROA:
                            result = await this.clearAllRoa(data);
                            break;
                        default:
                            result = { status: 'error', msg: `未知的请求类型: ${type}` };
                    }

                    // 发送响应
                    parentPort.postMessage({ id, result });
                }
            } catch (error) {
                this.logger.error(`Worker处理消息出错: ${error.message}`);
                // 发送错误响应
                if (message && message.id) {
                    parentPort.postMessage({
                        id: message.id,
                        result: { status: 'error', msg: error.message }
                    });
                }
            }
        });
    }

    // 启动RPKI服务器
    async startRpki(config) {
        if (this.server) {
            await this.stopRpki();
        }

        return new Promise((resolve, reject) => {
            try {
                const port = config.port || 8282;

                this.server = net.createServer(socket => {
                    this.handleNewConnection(socket);
                });

                this.server.on('error', err => {
                    this.logger.error(`RPKI服务器错误: ${err.message}`);
                    reject(err);
                });

                this.server.listen(port, () => {
                    this.logger.info(`RPKI服务器启动成功，监听端口: ${port}`);
                    resolve({ status: 'success', msg: `RPKI服务器启动成功，监听端口: ${port}` });
                });
            } catch (error) {
                this.logger.error(`启动RPKI服务器失败: ${error.message}`);
                reject(error);
            }
        });
    }

    // 停止RPKI服务器
    async stopRpki() {
        return new Promise((resolve, reject) => {
            try {
                if (!this.server) {
                    resolve({ status: 'success', msg: 'RPKI服务器未运行' });
                    return;
                }

                // 关闭所有客户端连接
                for (const [clientId, client] of this.clients.entries()) {
                    if (client.socket) {
                        client.socket.destroy();
                    }
                }
                this.clients.clear();
                this.routeOriginAuthorizations.clear();

                // 关闭服务器
                this.server.close(() => {
                    this.server = null;
                    this.logger.info('RPKI服务器已停止');
                    resolve({ status: 'success', msg: 'RPKI服务器已停止' });
                });
            } catch (error) {
                this.logger.error(`停止RPKI服务器失败: ${error.message}`);
                reject(error);
            }
        });
    }

    // 处理新的客户端连接
    handleNewConnection(socket) {
        const clientId = uuidv4();
        const remoteAddress = socket.remoteAddress.replace(/^::ffff:/, '');
        const remotePort = socket.remotePort;

        this.logger.info(`新的RPKI客户端连接: ${remoteAddress}:${remotePort}`);

        // 存储客户端信息
        const clientInfo = {
            id: clientId,
            remoteIp: remoteAddress,
            remotePort: remotePort,
            socket: socket,
            hostname: null,
            connectedAt: new Date().toISOString()
        };

        this.clients.set(clientId, clientInfo);
        this.routeOriginAuthorizations.set(clientId, new Map());

        // 发送通知
        this.sendEvent(RPKI_EVT_TYPES.CLIENT_CONNECTION, {
            action: 'connect',
            client: this.getClientPublicInfo(clientInfo)
        });

        // 处理数据
        socket.on('data', data => {
            this.handleClientData(clientId, data);
        });

        // 处理连接关闭
        socket.on('close', () => {
            this.handleClientDisconnect(clientId);
        });

        // 处理错误
        socket.on('error', err => {
            this.logger.error(`客户端 ${remoteAddress}:${remotePort} 连接错误: ${err.message}`);
            socket.destroy();
        });

        // 发送缓存响应
        this.sendCacheResponsePDU(socket);
    }

    // 处理客户端数据
    handleClientData(clientId, data) {
        try {
            const client = this.clients.get(clientId);
            if (!client) {
                this.logger.error(`收到未知客户端 ${clientId} 的数据`);
                return;
            }

            // RPKI消息解析
            let offset = 0;
            while (offset < data.length) {
                // 确保至少有头部
                if (offset + 8 > data.length) {
                    break;
                }

                const protocolVersion = data[offset];
                const pduType = data[offset + 1];
                const sessionId = data.readUInt16BE(offset + 2);
                const length = data.readUInt32BE(offset + 4);

                // 确保有完整的PDU
                if (offset + length > data.length) {
                    break;
                }

                // 处理不同类型的PDU
                switch (pduType) {
                    case RPKI_MSG_TYPE.RESET_QUERY:
                        this.handleResetQuery(client, protocolVersion, sessionId);
                        break;
                    // 其他PDU类型的处理...
                    default:
                        this.logger.info(`收到未处理的PDU类型: ${pduType}`);
                }

                offset += length;
            }
        } catch (error) {
            this.logger.error(`处理客户端数据出错: ${error.message}`);
        }
    }

    // 处理Reset Query
    handleResetQuery(client, protocolVersion, sessionId) {
        this.logger.info(`收到客户端 ${client.remoteIp}:${client.remotePort} 的Reset Query`);

        // 发送缓存响应
        this.sendCacheResponsePDU(client.socket);

        // 发送ROA
        this.sendAllRoaToClient(client);

        // 发送End of Data
        this.sendEndOfDataPDU(client.socket, protocolVersion);
    }

    // 发送缓存响应
    sendCacheResponsePDU(socket) {
        const buffer = Buffer.alloc(8);
        buffer[0] = RPKI_PROTOCOL_VERSION.V1; // 协议版本
        buffer[1] = RPKI_MSG_TYPE.CACHE_RESPONSE; // PDU类型
        buffer.writeUInt16BE(0, 2); // Session ID
        buffer.writeUInt32BE(8, 4); // Length (头部长度)

        socket.write(buffer);
    }

    // 发送End of Data
    sendEndOfDataPDU(socket, version) {
        const buffer = Buffer.alloc(24); // 包括头部的8字节
        buffer[0] = version || RPKI_PROTOCOL_VERSION.V1; // 协议版本
        buffer[1] = RPKI_MSG_TYPE.END_OF_DATA; // PDU类型
        buffer.writeUInt16BE(0, 2); // Session ID
        buffer.writeUInt32BE(24, 4); // Length

        // End of Data特有字段
        const now = Math.floor(Date.now() / 1000);
        buffer.writeUInt32BE(now, 8); // Serial Number
        buffer.writeUInt32BE(3600, 12); // Refresh Interval
        buffer.writeUInt32BE(600, 16); // Retry Interval
        buffer.writeUInt32BE(7200, 20); // Expire Interval

        socket.write(buffer);
    }

    // 发送IPv4 Prefix PDU
    sendIPv4PrefixPDU(socket, roa, isWithdrawal = false) {
        try {
            // 解析前缀
            const [prefix, prefixLength] = roa.prefix.split('/');
            const prefixBytes = prefix.split('.').map(Number);
            const prefixLengthNum = parseInt(prefixLength, 10);

            // 计算缓冲区长度（头部8字节 + IPv4前缀20字节）
            const buffer = Buffer.alloc(28);

            // 填充头部
            buffer[0] = RPKI_PROTOCOL_VERSION.V1; // 协议版本
            buffer[1] = RPKI_MSG_TYPE.IPV4_PREFIX; // PDU类型
            buffer.writeUInt16BE(0, 2); // Session ID
            buffer.writeUInt32BE(28, 4); // Length

            // 填充IPv4前缀数据
            buffer[8] = isWithdrawal ? RPKI_FLAGS.WITHDRAWAL : RPKI_FLAGS.ANNOUNCEMENT; // Flags
            buffer[9] = prefixLengthNum; // Prefix Length
            buffer[10] = roa.maxLength; // Max Length
            buffer[11] = 0; // 保留字节

            // IPv4地址
            buffer[12] = prefixBytes[0];
            buffer[13] = prefixBytes[1];
            buffer[14] = prefixBytes[2];
            buffer[15] = prefixBytes[3];

            // AS号
            buffer.writeUInt32BE(roa.asn, 16);

            // 发送到客户端
            socket.write(buffer);
        } catch (error) {
            this.logger.error(`发送IPv4前缀出错: ${error.message}`);
        }
    }

    // 发送IPv6 Prefix PDU
    sendIPv6PrefixPDU(socket, roa, isWithdrawal = false) {
        try {
            // 解析前缀
            const [prefix, prefixLength] = roa.prefix.split('/');
            const prefixLengthNum = parseInt(prefixLength, 10);

            // 解析IPv6地址
            const ipv6Parts = prefix.split(':');
            const ipv6Buffer = Buffer.alloc(16);

            // 填充IPv6地址（简化处理，实际中需要处理缩写形式等）
            for (let i = 0; i < ipv6Parts.length; i++) {
                const part = ipv6Parts[i] || '0'; // 处理空字符串（连续冒号情况）
                const value = parseInt(part, 16);
                ipv6Buffer.writeUInt16BE(value, i * 2);
            }

            // 计算缓冲区长度（头部8字节 + IPv6前缀32字节）
            const buffer = Buffer.alloc(40);

            // 填充头部
            buffer[0] = RPKI_PROTOCOL_VERSION.V1; // 协议版本
            buffer[1] = RPKI_MSG_TYPE.IPV6_PREFIX; // PDU类型
            buffer.writeUInt16BE(0, 2); // Session ID
            buffer.writeUInt32BE(40, 4); // Length

            // 填充IPv6前缀数据
            buffer[8] = isWithdrawal ? RPKI_FLAGS.WITHDRAWAL : RPKI_FLAGS.ANNOUNCEMENT; // Flags
            buffer[9] = prefixLengthNum; // Prefix Length
            buffer[10] = roa.maxLength; // Max Length
            buffer[11] = 0; // 保留字节

            // 复制IPv6地址
            ipv6Buffer.copy(buffer, 12);

            // AS号
            buffer.writeUInt32BE(roa.asn, 28);

            // 发送到客户端
            socket.write(buffer);
        } catch (error) {
            this.logger.error(`发送IPv6前缀出错: ${error.message}`);
        }
    }

    // 向客户端发送所有ROA
    sendAllRoaToClient(client) {
        const clientId = this.getClientKey(client);
        const roaMap = this.routeOriginAuthorizations.get(clientId);

        if (roaMap) {
            for (const roa of roaMap.values()) {
                this.sendRoaToClient(client, roa);
            }
        }
    }

    // 向客户端发送单个ROA
    sendRoaToClient(client, roa) {
        if (roa.prefix.includes(':')) {
            // IPv6 ROA
            this.sendIPv6PrefixPDU(client.socket, roa);
        } else {
            // IPv4 ROA
            this.sendIPv4PrefixPDU(client.socket, roa);
        }
    }

    // 向客户端发送ROA撤销
    sendRoaWithdrawalToClient(client, roa) {
        if (roa.prefix.includes(':')) {
            // IPv6 ROA撤销
            this.sendIPv6PrefixPDU(client.socket, roa, true);
        } else {
            // IPv4 ROA撤销
            this.sendIPv4PrefixPDU(client.socket, roa, true);
        }
    }

    // 处理客户端断开连接
    handleClientDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            this.logger.info(`RPKI客户端断开连接: ${client.remoteIp}:${client.remotePort}`);

            // 移除客户端
            this.clients.delete(clientId);
            this.routeOriginAuthorizations.delete(clientId);

            // 发送通知
            this.sendEvent(RPKI_EVT_TYPES.CLIENT_CONNECTION, {
                action: 'disconnect',
                client: this.getClientPublicInfo(client)
            });
        }
    }

    // 获取客户端列表
    async getClientList() {
        try {
            const clientList = Array.from(this.clients.values()).map(client => this.getClientPublicInfo(client));
            return { status: 'success', data: clientList };
        } catch (error) {
            this.logger.error(`获取客户端列表失败: ${error.message}`);
            return { status: 'error', msg: error.message };
        }
    }

    // 获取客户端信息
    async getClient(clientData) {
        try {
            const { remoteIp, remotePort } = clientData;
            const clientKey = this.findClientByAddress(remoteIp, remotePort);

            if (!clientKey) {
                return { status: 'error', msg: '客户端不存在' };
            }

            const client = this.clients.get(clientKey);
            return { status: 'success', data: this.getClientPublicInfo(client) };
        } catch (error) {
            this.logger.error(`获取客户端信息失败: ${error.message}`);
            return { status: 'error', msg: error.message };
        }
    }

    // 断开客户端连接
    async disconnectClient(clientData) {
        try {
            const { remoteIp, remotePort } = clientData;
            const clientKey = this.findClientByAddress(remoteIp, remotePort);

            if (!clientKey) {
                return { status: 'error', msg: '客户端不存在' };
            }

            const client = this.clients.get(clientKey);
            if (client.socket) {
                client.socket.destroy();
            }

            return { status: 'success', msg: '客户端已断开连接' };
        } catch (error) {
            this.logger.error(`断开客户端连接失败: ${error.message}`);
            return { status: 'error', msg: error.message };
        }
    }

    // 获取ROA列表
    async getRoaList(clientData) {
        try {
            const { remoteIp, remotePort } = clientData;
            const clientKey = this.findClientByAddress(remoteIp, remotePort);

            if (!clientKey) {
                return { status: 'error', msg: '客户端不存在' };
            }

            const roaMap = this.routeOriginAuthorizations.get(clientKey);
            if (!roaMap) {
                return { status: 'success', data: [] };
            }

            const roaList = Array.from(roaMap.values());
            return { status: 'success', data: roaList };
        } catch (error) {
            this.logger.error(`获取ROA列表失败: ${error.message}`);
            return { status: 'error', msg: error.message };
        }
    }

    // 添加ROA
    async addRoa(data) {
        try {
            const { client, roa } = data;
            const { remoteIp, remotePort } = client;
            const clientKey = this.findClientByAddress(remoteIp, remotePort);

            if (!clientKey) {
                return { status: 'error', msg: '客户端不存在' };
            }

            const roaMap = this.routeOriginAuthorizations.get(clientKey);
            if (!roaMap) {
                return { status: 'error', msg: '客户端ROA映射不存在' };
            }

            // 创建ROA对象
            const newRoa = {
                id: uuidv4(),
                asn: roa.asn,
                prefix: roa.prefix,
                maxLength: roa.maxLength,
                status: RPKI_ROA_STATUS.ACTIVE,
                createdAt: new Date().toISOString()
            };

            // 存储ROA
            roaMap.set(newRoa.id, newRoa);

            // 发送ROA到客户端
            const clientObj = this.clients.get(clientKey);
            if (clientObj && clientObj.socket) {
                this.sendRoaToClient(clientObj, newRoa);
            }

            // 发送通知
            this.sendEvent(RPKI_EVT_TYPES.ROA_UPDATE, {
                action: 'add',
                client: this.getClientPublicInfo(clientObj),
                roa: newRoa
            });

            return { status: 'success', data: newRoa };
        } catch (error) {
            this.logger.error(`添加ROA失败: ${error.message}`);
            return { status: 'error', msg: error.message };
        }
    }

    // 更新ROA
    async updateRoa(data) {
        try {
            const { client, roa } = data;
            const { remoteIp, remotePort } = client;
            const clientKey = this.findClientByAddress(remoteIp, remotePort);

            if (!clientKey) {
                return { status: 'error', msg: '客户端不存在' };
            }

            const roaMap = this.routeOriginAuthorizations.get(clientKey);
            if (!roaMap) {
                return { status: 'error', msg: '客户端ROA映射不存在' };
            }

            // 检查ROA是否存在
            const existingRoa = roaMap.get(roa.id);
            if (!existingRoa) {
                return { status: 'error', msg: 'ROA不存在' };
            }

            // 先撤销原来的ROA
            const clientObj = this.clients.get(clientKey);
            if (clientObj && clientObj.socket) {
                this.sendRoaWithdrawalToClient(clientObj, existingRoa);
            }

            // 更新ROA
            const updatedRoa = {
                ...existingRoa,
                asn: roa.asn,
                prefix: roa.prefix,
                maxLength: roa.maxLength,
                updatedAt: new Date().toISOString()
            };

            // 存储更新后的ROA
            roaMap.set(roa.id, updatedRoa);

            // 发送更新后的ROA到客户端
            if (clientObj && clientObj.socket) {
                this.sendRoaToClient(clientObj, updatedRoa);
            }

            // 发送通知
            this.sendEvent(RPKI_EVT_TYPES.ROA_UPDATE, {
                action: 'update',
                client: this.getClientPublicInfo(clientObj),
                roa: updatedRoa
            });

            return { status: 'success', data: updatedRoa };
        } catch (error) {
            this.logger.error(`更新ROA失败: ${error.message}`);
            return { status: 'error', msg: error.message };
        }
    }

    // 删除ROA
    async deleteRoa(data) {
        try {
            const { client, roa } = data;
            const { remoteIp, remotePort } = client;
            const clientKey = this.findClientByAddress(remoteIp, remotePort);

            if (!clientKey) {
                return { status: 'error', msg: '客户端不存在' };
            }

            const roaMap = this.routeOriginAuthorizations.get(clientKey);
            if (!roaMap) {
                return { status: 'error', msg: '客户端ROA映射不存在' };
            }

            // 检查ROA是否存在
            const existingRoa = roaMap.get(roa.id);
            if (!existingRoa) {
                return { status: 'error', msg: 'ROA不存在' };
            }

            // 发送撤销到客户端
            const clientObj = this.clients.get(clientKey);
            if (clientObj && clientObj.socket) {
                this.sendRoaWithdrawalToClient(clientObj, existingRoa);
            }

            // 删除ROA
            roaMap.delete(roa.id);

            // 发送通知
            this.sendEvent(RPKI_EVT_TYPES.ROA_UPDATE, {
                action: 'delete',
                client: this.getClientPublicInfo(clientObj),
                roa: existingRoa
            });

            return { status: 'success', msg: 'ROA已删除' };
        } catch (error) {
            this.logger.error(`删除ROA失败: ${error.message}`);
            return { status: 'error', msg: error.message };
        }
    }

    // 清空所有ROA
    async clearAllRoa(clientData) {
        try {
            const { remoteIp, remotePort } = clientData;
            const clientKey = this.findClientByAddress(remoteIp, remotePort);

            if (!clientKey) {
                return { status: 'error', msg: '客户端不存在' };
            }

            const roaMap = this.routeOriginAuthorizations.get(clientKey);
            if (!roaMap || roaMap.size === 0) {
                return { status: 'success', msg: '没有ROA需要清空' };
            }

            const clientObj = this.clients.get(clientKey);
            if (clientObj && clientObj.socket) {
                // 发送所有ROA的撤销
                for (const roa of roaMap.values()) {
                    this.sendRoaWithdrawalToClient(clientObj, roa);
                }
            }

            // 清空ROA映射
            roaMap.clear();

            // 发送通知
            this.sendEvent(RPKI_EVT_TYPES.ROA_UPDATE, {
                action: 'clear',
                client: this.getClientPublicInfo(clientObj)
            });

            return { status: 'success', msg: '所有ROA已清空' };
        } catch (error) {
            this.logger.error(`清空ROA失败: ${error.message}`);
            return { status: 'error', msg: error.message };
        }
    }

    // 通过IP和端口查找客户端
    findClientByAddress(ip, port) {
        for (const [clientId, client] of this.clients.entries()) {
            if (client.remoteIp === ip && client.remotePort.toString() === port.toString()) {
                return clientId;
            }
        }
        return null;
    }

    // 获取客户端公开信息（不包含套接字等敏感信息）
    getClientPublicInfo(client) {
        if (!client) return null;

        return {
            remoteIp: client.remoteIp,
            remotePort: client.remotePort,
            hostname: client.hostname,
            connectedAt: client.connectedAt
        };
    }

    // 获取客户端唯一键
    getClientKey(client) {
        for (const [clientId, c] of this.clients.entries()) {
            if (c.remoteIp === client.remoteIp && c.remotePort === client.remotePort) {
                return clientId;
            }
        }
        return null;
    }

    // 发送事件通知
    sendEvent(type, data) {
        if (parentPort) {
            parentPort.postMessage({
                event: true,
                type,
                data
            });
        }
    }
}

const worker = new RpkiWorker();

// 守护进程，防止worker线程退出
setInterval(() => {}, 1000);
