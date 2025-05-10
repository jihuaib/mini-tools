const net = require('net');
const util = require('util');
const { RPKI_REQ_TYPES } = require('../const/rpkiReqConst');
const logger = require('../log/logger');
const WorkerMessageHandler = require('./workerMessageHandler');
const RpkiSession = require('./rpkiSession');
const RpkiRoa = require('./rpkiRoa');
const { RPKI_EVT_TYPES } = require('../const/rpkiEvtConst');

class RpkiWorker {
    constructor() {
        this.server = null;
        this.ipv6Server = null;
        this.socket = null;

        this.rpkiConfigData = null; // rpki配置数据

        this.rpkiSessionMap = new Map(); // rpki会话map
        this.rpkiRoaMap = new Map(); // rpki roa map

        // 创建消息处理器
        this.messageHandler = new WorkerMessageHandler();
        // 初始化消息处理器
        this.messageHandler.init();
        // 注册消息处理器
        this.messageHandler.registerHandler(RPKI_REQ_TYPES.START_RPKI, this.startRpki.bind(this));
        this.messageHandler.registerHandler(RPKI_REQ_TYPES.STOP_RPKI, this.stopRpki.bind(this));
        this.messageHandler.registerHandler(RPKI_REQ_TYPES.ADD_ROA, this.addRoa.bind(this));
        this.messageHandler.registerHandler(RPKI_REQ_TYPES.DELETE_ROA, this.deleteRoa.bind(this));
    }

    async startTcpServer(messageId) {
        try {
            this.server = net.createServer(socket => {
                const clientAddress = socket.remoteAddress;
                const clientPort = socket.remotePort;

                logger.info(`ipv4 Client connected from ${clientAddress}:${clientPort}`);
                logger.info(`ipv4 localAddress: ${socket.localAddress}:${socket.localPort}`);

                // 当接收到数据时处理数据
                socket.on('data', data => {
                    const rpkiSession = this.rpkiSessionMap.get(
                        RpkiSession.makeKey(socket.localAddress, socket.localPort, clientAddress, clientPort)
                    );
                    if (null == rpkiSession) {
                        logger.error(`ipv4 Client ${clientAddress}:${clientPort} not found in rpkiSessionMap`);
                        socket.destroy();
                        return;
                    }
                    rpkiSession.recvMsg(data);
                });

                socket.on('end', () => {
                    const sessionKey = RpkiSession.makeKey(
                        socket.localAddress,
                        socket.localPort,
                        clientAddress,
                        clientPort
                    );
                    const rpkiSession = this.rpkiSessionMap.get(sessionKey);
                    if (null == rpkiSession) {
                        logger.error(`ipv6 Client ${clientAddress}:${clientPort} not found in rpkiSessionMap`);
                        socket.destroy();
                        return;
                    } else {
                        rpkiSession.closeSession();
                        this.rpkiSessionMap.delete(sessionKey);
                    }
                    logger.info(`ipv4 Client ${clientAddress}:${clientPort} end`);
                });

                socket.on('close', () => {
                    const sessionKey = RpkiSession.makeKey(
                        socket.localAddress,
                        socket.localPort,
                        clientAddress,
                        clientPort
                    );
                    const rpkiSession = this.rpkiSessionMap.get(sessionKey);
                    if (null == rpkiSession) {
                        logger.error(`ipv6 Client ${clientAddress}:${clientPort} not found in rpkiSessionMap`);
                        socket.destroy();
                        return;
                    } else {
                        rpkiSession.closeSession();
                        this.rpkiSessionMap.delete(sessionKey);
                    }
                    logger.info(`ipv4 Client ${clientAddress}:${clientPort} close`);
                });

                socket.on('error', err => {
                    const sessionKey = RpkiSession.makeKey(
                        socket.localAddress,
                        socket.localPort,
                        clientAddress,
                        clientPort
                    );
                    const rpkiSession = this.rpkiSessionMap.get(sessionKey);
                    if (null == rpkiSession) {
                        logger.error(`ipv6 Client ${clientAddress}:${clientPort} not found in rpkiSessionMap`);
                        socket.destroy();
                        return;
                    } else {
                        rpkiSession.closeSession();
                        this.rpkiSessionMap.delete(sessionKey);
                    }
                    logger.error(`ipv4 TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
                });

                // 创建RPKI会话
                let rpkiSession = null;
                const sessionKey = RpkiSession.makeKey(
                    socket.localAddress,
                    socket.localPort,
                    clientAddress,
                    clientPort
                );
                rpkiSession = this.rpkiSessionMap.get(sessionKey);
                if (null != rpkiSession) {
                    rpkiSession.closeSession();
                    this.rpkiSessionMap.delete(sessionKey);
                } else {
                    rpkiSession = new RpkiSession(this.messageHandler, this);
                }
                this.rpkiSessionMap.set(sessionKey, rpkiSession);

                rpkiSession.socket = socket;
                rpkiSession.localIp = socket.localAddress;
                rpkiSession.localPort = socket.localPort;
                rpkiSession.remoteIp = clientAddress;
                rpkiSession.remotePort = clientPort;

                this.messageHandler.sendEvent(RPKI_EVT_TYPES.CLIENT_CONNECTION, {
                    opType: 'add',
                    data: rpkiSession.getClientInfo()
                });
            });

            this.ipv6Server = net.createServer(socket => {
                const clientAddress = socket.remoteAddress;
                const clientPort = socket.remotePort;

                logger.info(`ipv6 Client connected from ${clientAddress}:${clientPort}`);
                logger.info(`ipv6 localAddress: ${socket.localAddress}:${socket.localPort}`);

                // 当接收到数据时处理数据
                socket.on('data', data => {
                    const rpkiSession = this.rpkiSessionMap.get(
                        RpkiSession.makeKey(socket.localAddress, socket.localPort, clientAddress, clientPort)
                    );
                    if (null == rpkiSession) {
                        logger.error(`ipv6 Client ${clientAddress}:${clientPort} not found in rpkiSessionMap`);
                        socket.destroy();
                        return;
                    }
                    rpkiSession.recvMsg(data);
                });

                socket.on('end', () => {
                    const sessionKey = RpkiSession.makeKey(
                        socket.localAddress,
                        socket.localPort,
                        clientAddress,
                        clientPort
                    );
                    const rpkiSession = this.rpkiSessionMap.get(sessionKey);
                    if (null == rpkiSession) {
                        logger.error(`ipv6 Client ${clientAddress}:${clientPort} not found in rpkiSessionMap`);
                        socket.destroy();
                        return;
                    } else {
                        rpkiSession.closeSession();
                        this.rpkiSessionMap.delete(sessionKey);
                    }
                    logger.info(`ipv6 Client ${clientAddress}:${clientPort} end`);
                });

                socket.on('close', () => {
                    const sessionKey = RpkiSession.makeKey(
                        socket.localAddress,
                        socket.localPort,
                        clientAddress,
                        clientPort
                    );
                    const rpkiSession = this.rpkiSessionMap.get(sessionKey);
                    if (null == rpkiSession) {
                        logger.error(`ipv6 Client ${clientAddress}:${clientPort} not found in rpkiSessionMap`);
                        socket.destroy();
                        return;
                    } else {
                        rpkiSession.closeSession();
                        this.rpkiSessionMap.delete(sessionKey);
                    }
                    logger.info(`ipv6 Client ${clientAddress}:${clientPort} close`);
                });

                socket.on('error', err => {
                    const sessionKey = RpkiSession.makeKey(
                        socket.localAddress,
                        socket.localPort,
                        clientAddress,
                        clientPort
                    );
                    const rpkiSession = this.rpkiSessionMap.get(sessionKey);
                    if (null == rpkiSession) {
                        logger.error(`ipv6 Client ${clientAddress}:${clientPort} not found in rpkiSessionMap`);
                        socket.destroy();
                        return;
                    } else {
                        rpkiSession.closeSession();
                        this.rpkiSessionMap.delete(sessionKey);
                    }
                    logger.error(`ipv6 TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
                });

                // 创建RPKI会话
                let rpkiSession = null;
                const sessionKey = RpkiSession.makeKey(
                    socket.localAddress,
                    socket.localPort,
                    clientAddress,
                    clientPort
                );
                rpkiSession = this.rpkiSessionMap.get(sessionKey);
                if (null != rpkiSession) {
                    rpkiSession.closeSession();
                    this.rpkiSessionMap.delete(sessionKey);
                } else {
                    rpkiSession = new RpkiSession(this.messageHandler, this);
                }
                this.rpkiSessionMap.set(sessionKey, rpkiSession);

                rpkiSession.socket = socket;
                rpkiSession.localIp = socket.localAddress;
                rpkiSession.localPort = socket.localPort;
                rpkiSession.remoteIp = clientAddress;
                rpkiSession.remotePort = clientPort;

                this.messageHandler.sendEvent(RPKI_EVT_TYPES.CLIENT_CONNECTION, {
                    opType: 'add',
                    data: rpkiSession.getClientInfo()
                });
            });

            // 启动ipv4服务器并监听端口
            const listenPormise = util.promisify(this.server.listen).bind(this.server);
            await listenPormise(this.rpkiConfigData.port, '0.0.0.0');
            logger.info(`TCP Server listening on port ${this.rpkiConfigData.port} at 0.0.0.0`);

            // 启动ipv6服务器并监听端口
            const ipv6ListenPormise = util.promisify(this.ipv6Server.listen).bind(this.ipv6Server);
            await ipv6ListenPormise(this.rpkiConfigData.port, '::');
            logger.info(`TCP Server listening on port ${this.rpkiConfigData.port} at ::`);

            logger.info(`rpki协议启动成功`);
            this.messageHandler.sendSuccessResponse(messageId, null, 'rpki协议启动成功');
        } catch (err) {
            logger.error(`Error starting TCP server: ${err.message}`);
            this.messageHandler.sendErrorResponse(messageId, 'rpki协议启动失败');
        }
    }

    startRpki(messageId, rpkiConfigData) {
        this.rpkiConfigData = rpkiConfigData;
        // 启动tcp服务器
        this.startTcpServer(messageId);
    }

    stopRpki(messageId) {
        if (this.server) {
            this.server.close();
            this.server = null;
        }

        if (this.ipv6Server) {
            this.ipv6Server.close();
            this.ipv6Server = null;
        }

        // 清空配置数据
        this.rpkiConfigData = null;

        // 清空会话
        this.rpkiSessionMap.forEach((session, _) => {
            session.closeSession();
        });
        this.rpkiSessionMap.clear();
        this.rpkiRoaMap.clear();
        this.messageHandler.sendSuccessResponse(messageId, null, 'rpki协议停止成功');
    }

    sendSingleRoaData(rpkiRoa) {
        const rpkiSession = this.rpkiSessionMap.values();
        for (const session of rpkiSession) {
            session.sendSingleRoaData(rpkiRoa);
        }
    }

    withdrawSingleRoaData(rpkiRoa) {
        const rpkiSession = this.rpkiSessionMap.values();
        for (const session of rpkiSession) {
            session.withdrawSingleRoaData(rpkiRoa);
        }
    }

    addRoa(messageId, roa) {
        const key = RpkiRoa.makeKey(roa.ip, roa.mask, roa.asn, roa.maxLength);
        if (this.rpkiRoaMap.has(key)) {
            logger.error(`RPKI ROA配置已存在: ${key}`);
            this.messageHandler.sendErrorResponse(messageId, 'RPKI ROA配置已存在');
            return;
        }
        const rpkiRoa = new RpkiRoa(roa.ip, roa.mask, roa.asn, roa.maxLength, roa.ipType);
        this.rpkiRoaMap.set(key, rpkiRoa);

        // 发送ROA数据
        this.sendSingleRoaData(rpkiRoa);

        this.messageHandler.sendSuccessResponse(messageId, null, 'RPKI ROA配置添加成功');
    }

    deleteRoa(messageId, roa) {
        const key = RpkiRoa.makeKey(roa.ip, roa.mask, roa.asn, roa.maxLength);
        if (!this.rpkiRoaMap.has(key)) {
            logger.error(`RPKI ROA配置不存在: ${key}`);
            this.messageHandler.sendErrorResponse(messageId, 'RPKI ROA配置不存在');
            return;
        }

        const rpkiRoa = this.rpkiRoaMap.get(key);

        // 发送ROA数据
        this.withdrawSingleRoaData(rpkiRoa);

        this.rpkiRoaMap.delete(key);
        this.messageHandler.sendSuccessResponse(messageId, null, 'RPKI ROA配置删除成功');
    }
}

new RpkiWorker(); // 启动监听
