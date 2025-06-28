const dgram = require('dgram');
const logger = require('../log/logger');
const WorkerMessageHandler = require('./workerMessageHandler');
const SnmpConst = require('../const/snmpConst');
const Asn1Parser = require('../utils/asn1Parser');

class SnmpWorker {
    constructor() {
        this.server = null;
        this.ipv6Server = null;
        this.snmpConfig = null;
        this.sessionMap = new Map(); // SNMP会话映射
        this.agentMap = new Map(); // 代理映射
        this.trapCounter = 0;

        // 创建消息处理器
        this.messageHandler = new WorkerMessageHandler();
        // 初始化消息处理器
        this.messageHandler.init();
        // 注册消息处理器
        this.messageHandler.registerHandler(SnmpConst.SNMP_REQ_TYPES.START_SNMP, this.startSnmp.bind(this));
        this.messageHandler.registerHandler(SnmpConst.SNMP_REQ_TYPES.STOP_SNMP, this.stopSnmp.bind(this));
    }

    /**
     * 启动SNMP服务器
     */
    async startSnmp(messageId, config) {
        try {
            this.snmpConfig = config;

            // 启动IPv4服务器
            await this.startUdpServer();

            // 启动IPv6服务器
            await this.startUdpServerV6();

            logger.info(`SNMP Trap服务器启动成功，监听端口: ${config.port}`);
            this.messageHandler.sendSuccessResponse(messageId, null, 'SNMP协议启动成功');

            // 发送服务器状态事件
            this.messageHandler.sendEvent(SnmpConst.SNMP_EVT_TYPES.TRAP_EVT, {
                type: SnmpConst.SNMP_SUB_EVT_TYPES.SERVER_STATUS,
                data: {
                    status: 'running',
                    port: config.port,
                    supportedVersions: config.supportedVersions
                }
            });
        } catch (error) {
            logger.error('启动SNMP服务器失败:', error);
            this.messageHandler.sendErrorResponse(messageId, 'SNMP协议启动失败: ' + error.message);
        }
    }

    /**
     * 启动IPv4 UDP服务器
     */
    async startUdpServer() {
        return new Promise((resolve, reject) => {
            try {
                this.server = dgram.createSocket('udp4');

                this.server.on('message', (msg, rinfo) => {
                    this.handleSnmpMessage(msg, rinfo, 'ipv4');
                });

                this.server.on('error', err => {
                    logger.error('IPv4 UDP服务器错误:', err);
                    reject(err);
                });

                this.server.on('listening', () => {
                    const address = this.server.address();
                    logger.info(`IPv4 SNMP服务器监听: ${address.address}:${address.port}`);
                    resolve();
                });

                this.server.bind(this.snmpConfig.port, '0.0.0.0');
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 启动IPv6 UDP服务器
     */
    async startUdpServerV6() {
        return new Promise((resolve, reject) => {
            try {
                this.ipv6Server = dgram.createSocket('udp6');

                this.ipv6Server.on('message', (msg, rinfo) => {
                    this.handleSnmpMessage(msg, rinfo, 'ipv6');
                });

                this.ipv6Server.on('error', err => {
                    logger.error('IPv6 UDP服务器错误:', err);
                    reject(err);
                });

                this.ipv6Server.on('listening', () => {
                    const address = this.ipv6Server.address();
                    logger.info(`IPv6 SNMP服务器监听: ${address.address}:${address.port}`);
                    resolve();
                });

                this.ipv6Server.bind(this.snmpConfig.port, '::');
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 处理SNMP消息
     */
    handleSnmpMessage(buffer, rinfo, ipVersion) {
        try {
            logger.info(`收到来自 ${rinfo.address}:${rinfo.port} (${ipVersion}) 的SNMP消息, 长度: ${buffer.length}`);

            // 解析SNMP消息
            const snmpMessage = this.parseSnmpMessage(buffer);
            if (!snmpMessage) {
                logger.error('SNMP消息解析失败');
                return;
            }

            logger.info(
                `解析成功: version=${snmpMessage.version}, community=${snmpMessage.community}, pduType=0x${snmpMessage.pduType.toString(16)}`
            );

            // 检查是否为Trap消息
            if (this.isTrapMessage(snmpMessage)) {
                this.processTrapMessage(snmpMessage, rinfo, buffer);
            } else {
                logger.info('收到非Trap SNMP消息，忽略');
            }
        } catch (error) {
            logger.error('处理SNMP消息失败:', error);
        }
    }

    /**
     * 解析SNMP消息 - 完整的ASN.1 BER解析
     */
    parseSnmpMessage(buffer) {
        try {
            const parser = new Asn1Parser(buffer);

            // 解析SNMP消息序列
            const messageSequence = parser.parseSequence();
            if (!messageSequence) {
                logger.error('SNMP消息不是有效的ASN.1序列');
                return null;
            }

            // 解析版本
            const version = parser.parseInteger();
            if (version === null) {
                logger.error('无法解析SNMP版本');
                return null;
            }

            // 解析community字符串
            const community = parser.parseOctetString();
            if (community === null) {
                logger.error('无法解析community字符串');
                return null;
            }

            // 解析PDU
            const pduResult = parser.parsePdu();
            if (!pduResult) {
                logger.error('无法解析PDU');
                return null;
            }

            console.log('pduResult', pduResult);

            return {
                version: this.getVersionString(version),
                versionNumber: version,
                community: community,
                pduType: pduResult.type,
                requestId: pduResult.requestId || 0,
                errorStatus: pduResult.errorStatus || 0,
                errorIndex: pduResult.errorIndex || 0,
                varbinds: pduResult.varbinds || [],
                rawData: buffer.toString('hex'),
                // Trap特有字段
                enterprise: pduResult.enterprise,
                agentAddr: pduResult.agentAddr,
                genericTrap: pduResult.genericTrap,
                specificTrap: pduResult.specificTrap,
                timeStamp: pduResult.timeStamp
            };
        } catch (error) {
            logger.error('解析SNMP消息失败:', error);
            return null;
        }
    }

    /**
     * 获取版本字符串
     */
    getVersionString(version) {
        switch (version) {
            case 0:
                return 'v1';
            case 1:
                return 'v2c';
            case 3:
                return 'v3';
            default:
                return `unknown(${version})`;
        }
    }

    /**
     * 检查是否为Trap消息
     */
    isTrapMessage(message) {
        return (
            message.pduType === SnmpConst.SNMP_PDU_TYPE.TRAP ||
            message.pduType === SnmpConst.SNMP_PDU_TYPE.SNMPV2_TRAP ||
            message.pduType === SnmpConst.SNMP_PDU_TYPE.INFORM_REQUEST
        );
    }

    /**
     * 处理Trap消息
     */
    processTrapMessage(message, rinfo, _rawBuffer) {
        try {
            this.trapCounter++;

            const trapData = {
                id: `trap_${Date.now()}_${this.trapCounter}`,
                timestamp: new Date().toISOString(),
                sourceIp: rinfo.address,
                sourcePort: rinfo.port,
                version: message.version,
                community: message.community,
                pduType: message.pduType,
                requestId: message.requestId,
                enterpriseOid: message.enterprise,
                trapType: this.getTrapType(message),
                specificType: message.specificTrap,
                genericType: message.genericTrap,
                varbinds: message.varbinds,
                status: 'received',
                rawData: message.rawData
            };

            logger.info(`处理Trap: ${trapData.id} 来自 ${rinfo.address}:${rinfo.port}`);

            // 发送Trap接收事件
            this.messageHandler.sendEvent(SnmpConst.SNMP_EVT_TYPES.TRAP_EVT, {
                type: SnmpConst.SNMP_SUB_EVT_TYPES.TRAP_RECEIVED,
                data: trapData
            });

            // 更新代理信息
            this.updateAgentInfo(rinfo.address, trapData);
        } catch (error) {
            logger.error('处理Trap消息失败:', error);

            // 发送Trap错误事件
            this.messageHandler.sendEvent(SnmpConst.SNMP_EVT_TYPES.TRAP_EVT, {
                type: SnmpConst.SNMP_SUB_EVT_TYPES.TRAP_ERROR,
                data: {
                    error: error.message,
                    sourceIp: rinfo.address,
                    sourcePort: rinfo.port
                }
            });
        }
    }

    /**
     * 获取Trap类型
     */
    getTrapType(message) {
        switch (message.pduType) {
            case SnmpConst.SNMP_PDU_TYPE.TRAP:
                return 'SNMPv1 Trap';
            case SnmpConst.SNMP_PDU_TYPE.SNMPV2_TRAP:
                return 'SNMPv2 Trap';
            case SnmpConst.SNMP_PDU_TYPE.INFORM_REQUEST:
                return 'Inform Request';
            default:
                return 'Unknown';
        }
    }

    /**
     * 更新代理信息
     */
    updateAgentInfo(agentIp, trapData) {
        try {
            const agentKey = agentIp;
            let agentInfo = this.agentMap.get(agentKey);

            if (!agentInfo) {
                agentInfo = {
                    ip: agentIp,
                    firstSeen: new Date().toISOString(),
                    trapCount: 0,
                    lastTrapTime: null,
                    status: 'online'
                };

                // 发送代理连接事件
                this.messageHandler.sendEvent(SnmpConst.SNMP_EVT_TYPES.TRAP_EVT, {
                    type: SnmpConst.SNMP_SUB_EVT_TYPES.AGENT_CONNECTION,
                    data: agentInfo
                });
            }

            agentInfo.trapCount++;
            agentInfo.lastTrapTime = trapData.timestamp;
            agentInfo.status = 'online';

            this.agentMap.set(agentKey, agentInfo);
        } catch (error) {
            logger.error('更新代理信息失败:', error);
        }
    }

    /**
     * 停止SNMP服务器
     */
    stopSnmp(messageId) {
        try {
            if (this.server) {
                this.server.close();
                this.server = null;
            }

            if (this.ipv6Server) {
                this.ipv6Server.close();
                this.ipv6Server = null;
            }

            // 清空配置和会话
            this.snmpConfig = null;
            this.sessionMap.clear();
            this.agentMap.clear();
            this.trapCounter = 0;

            logger.info('SNMP服务器停止成功');
            this.messageHandler.sendSuccessResponse(messageId, null, 'SNMP协议停止成功');

            // 发送服务器状态事件
            this.messageHandler.sendEvent(SnmpConst.SNMP_EVT_TYPES.TRAP_EVT, {
                type: SnmpConst.SNMP_SUB_EVT_TYPES.SERVER_STATUS,
                data: {
                    status: 'stopped'
                }
            });
        } catch (error) {
            logger.error('停止SNMP服务器失败:', error);
            this.messageHandler.sendErrorResponse(messageId, 'SNMP协议停止失败: ' + error.message);
        }
    }
}

new SnmpWorker(); // 启动监听
