const net = require('net');
const util = require('util');
const logger = require('../log/logger');
const WorkerMessageHandler = require('./workerMessageHandler');
const BmpSession = require('./bmpSession');
const { getAfiAndSafi } = require('../utils/bgpUtils');
const BmpBgpSession = require('./bmpBgpSession');
const BmpConst = require('../const/bmpConst');

class BmpWorker {
    constructor() {
        this.server = null;
        this.ipv6Server = null;
        this.socket = null;

        this.bmpConfigData = null; // bmp配置数据

        this.bmpSessionMap = new Map(); // bmp会话map

        // 创建消息处理器
        this.messageHandler = new WorkerMessageHandler();
        // 初始化消息处理器
        this.messageHandler.init();
        // 注册消息处理器
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.START_BMP, this.startBmp.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.STOP_BMP, this.stopBmp.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_CLIENT_LIST, this.getClientList.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_BGP_SESSIONS, this.getBgpSessions.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_BGP_ROUTES, this.getBgpRoutes.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_CLIENT, this.getClient.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_PEER, this.getPeer.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_BGP_INSTANCES, this.getBgpInstances.bind(this));
        this.messageHandler.registerHandler(
            BmpConst.BMP_REQ_TYPES.GET_BGP_INSTANCE_ROUTES,
            this.getBgpInstanceRoutes.bind(this)
        );
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
                    const bmpSession = this.bmpSessionMap.get(
                        BmpSession.makeKey(socket.localAddress, socket.localPort, clientAddress, clientPort)
                    );
                    if (!bmpSession) {
                        logger.error(`ipv4 Client ${clientAddress}:${clientPort} not found in bmpSessionMap`);
                        socket.destroy();
                        return;
                    }
                    bmpSession.recvMsg(data);
                });

                socket.on('end', () => {
                    logger.info(`ipv4 Client ${clientAddress}:${clientPort} end`);
                });

                socket.on('close', () => {
                    logger.info(`ipv4 Client ${clientAddress}:${clientPort} close`);
                });

                socket.on('error', err => {
                    logger.error(`ipv4 TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
                });

                // 创建BMP会话
                let bmpSession = null;
                const sessionKey = BmpSession.makeKey(socket.localAddress, socket.localPort, clientAddress, clientPort);
                bmpSession = this.bmpSessionMap.get(sessionKey);
                if (bmpSession) {
                    bmpSession.closeSession();
                    this.bmpSessionMap.delete(sessionKey);
                } else {
                    bmpSession = new BmpSession(this.messageHandler, this);
                }
                this.bmpSessionMap.set(sessionKey, bmpSession);

                bmpSession.socket = socket;
                bmpSession.localIp = socket.localAddress;
                bmpSession.localPort = socket.localPort;
                bmpSession.remoteIp = clientAddress;
                bmpSession.remotePort = clientPort;
            });

            this.ipv6Server = net.createServer(socket => {
                const clientAddress = socket.remoteAddress;
                const clientPort = socket.remotePort;

                logger.info(`ipv6 Client connected from ${clientAddress}:${clientPort}`);
                logger.info(`ipv6 localAddress: ${socket.localAddress}:${socket.localPort}`);

                // 当接收到数据时处理数据
                socket.on('data', data => {
                    const bmpSession = this.bmpSessionMap.get(
                        BmpSession.makeKey(socket.localAddress, socket.localPort, clientAddress, clientPort)
                    );
                    if (!bmpSession) {
                        logger.error(`ipv6 Client ${clientAddress}:${clientPort} not found in bmpSessionMap`);
                        socket.destroy();
                        return;
                    }
                    bmpSession.recvMsg(data);
                });

                socket.on('end', () => {
                    logger.info(`ipv6 Client ${clientAddress}:${clientPort} end`);
                });

                socket.on('close', () => {
                    logger.info(`ipv6 Client ${clientAddress}:${clientPort} close`);
                });

                socket.on('error', err => {
                    logger.error(`ipv6 TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
                });

                // 创建BMP会话
                let bmpSession = null;
                const sessionKey = BmpSession.makeKey(socket.localAddress, socket.localPort, clientAddress, clientPort);
                bmpSession = this.bmpSessionMap.get(sessionKey);
                if (bmpSession) {
                    bmpSession.closeSession();
                    this.bmpSessionMap.delete(sessionKey);
                } else {
                    bmpSession = new BmpSession(this.messageHandler, this);
                }
                this.bmpSessionMap.set(sessionKey, bmpSession);

                bmpSession.socket = socket;
                bmpSession.localIp = socket.localAddress;
                bmpSession.localPort = socket.localPort;
                bmpSession.remoteIp = clientAddress;
                bmpSession.remotePort = clientPort;
            });

            // 启动ipv4服务器并监听端口
            const listenPormise = util.promisify(this.server.listen).bind(this.server);
            await listenPormise(this.bmpConfigData.port, '0.0.0.0');
            logger.info(`TCP Server listening on port ${this.bmpConfigData.port} at 0.0.0.0`);

            // 启动ipv6服务器并监听端口
            const ipv6ListenPormise = util.promisify(this.ipv6Server.listen).bind(this.ipv6Server);
            await ipv6ListenPormise(this.bmpConfigData.port, '::');
            logger.info(`TCP Server listening on port ${this.bmpConfigData.port} at ::`);

            logger.info(`bmp协议启动成功`);
            this.messageHandler.sendSuccessResponse(messageId, null, 'bmp协议启动成功');
        } catch (err) {
            logger.error(`Error starting TCP server: ${err.message}`);
            this.messageHandler.sendErrorResponse(messageId, 'bmp协议启动失败');
        }
    }

    startBmp(messageId, bmpConfigData) {
        this.bmpConfigData = bmpConfigData;
        // 启动tcp服务器
        this.startTcpServer(messageId);
    }

    stopBmp(messageId) {
        if (this.server) {
            this.server.close();
            this.server = null;
        }

        if (this.ipv6Server) {
            this.ipv6Server.close();
            this.ipv6Server = null;
        }

        // 清空配置数据
        this.bmpConfigData = null;

        // 发送全局终止事件通知前端
        this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.TERMINATION, { data: null });

        // 清空会话
        this.bmpSessionMap.forEach((session, _) => {
            session.closeSession();
        });
        this.bmpSessionMap.clear();
        this.messageHandler.sendSuccessResponse(messageId, null, 'bmp协议停止成功');
    }

    getClientList(messageId) {
        const clientList = [];
        this.bmpSessionMap.forEach((session, _) => {
            const clientInfo = session.getClientInfo();
            clientList.push(clientInfo);
        });
        this.messageHandler.sendSuccessResponse(messageId, clientList, '获取客户端列表成功');
    }

    getBgpSessions(messageId, client) {
        const bmpSessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(bmpSessionKey);
        const peerList = [];
        if (!bmpSession) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }
        bmpSession.bgpSessionMap.forEach((session, _) => {
            peerList.push(session.getSessionInfo());
        });
        this.messageHandler.sendSuccessResponse(messageId, peerList, '获取对等体列表成功');
    }

    getBgpInstanceRoutes(messageId, data) {
        const { client, instance, page, pageSize } = data;
        const bmpSessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(bmpSessionKey);
        const routeList = [];
        if (!bmpSession) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }

        const { afi, safi } = getAfiAndSafi(instance.addrFamilyType);

        const bgpInstKey = BmpBgpSession.makeKey(instance.instanceType, instance.instanceRd, afi, safi);
        const bgpInstance = bmpSession.bgpInstanceMap.get(bgpInstKey);
        if (!bgpInstance) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在BGP实例 ${bgpInstKey}`);
            this.messageHandler.sendErrorResponse(messageId, 'BGP实例不存在');
            return;
        }

        bgpInstance.bgpRoutes.forEach((route, _) => {
            routeList.push(route.getRouteInfo());
        });

        const total = routeList.length;
        const list = routeList.slice((page - 1) * pageSize, page * pageSize);

        this.messageHandler.sendSuccessResponse(messageId, { list, total }, 'BGP实例获取路由列表成功');
    }

    getBgpRoutes(messageId, data) {
        const { client, session, af, ribType, page, pageSize } = data;
        const bmpSessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(bmpSessionKey);
        const routeList = [];
        if (!bmpSession) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }

        const bgpSessionKey = BmpBgpSession.makeKey(
            session.sessionType,
            session.sessionRd,
            session.sessionIp,
            session.sessionAs
        );
        const bgpSession = bmpSession.bgpSessionMap.get(bgpSessionKey);
        if (!bgpSession) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在BGP会话 ${bgpSessionKey}`);
            this.messageHandler.sendErrorResponse(messageId, 'BGP会话不存在');
            return;
        }

        const { afi, safi } = getAfiAndSafi(af);
        const afKey = `${afi}|${safi}`;
        const ribTypeRouteMap = bgpSession.bgpRoutes.get(afKey);
        if (!ribTypeRouteMap) {
            logger.error(`BGP会话 ${bgpSessionKey} 不存在地址族 ${afKey}`);
            this.messageHandler.sendErrorResponse(messageId, '地址族不存在');
            return;
        }

        const routeMap = ribTypeRouteMap.get(ribType);
        if (!routeMap) {
            logger.error(`BGP会话 ${bgpSessionKey} 不存在 ribType ${ribType}`);
            this.messageHandler.sendErrorResponse(messageId, 'ribType不存在');
            return;
        }

        routeMap.forEach((route, _) => {
            routeList.push(route.getRouteInfo());
        });

        const total = routeList.length;
        const list = routeList.slice((page - 1) * pageSize, page * pageSize);

        this.messageHandler.sendSuccessResponse(messageId, { list, total }, '获取路由列表成功');
    }

    getClient(messageId, client) {
        const bmpSessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(bmpSessionKey);
        if (!bmpSession) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }
        this.messageHandler.sendSuccessResponse(messageId, bmpSession.getClientInfo(), '获取客户端信息成功');
    }

    getPeer(messageId, data) {
        const { client, peer } = data;
        const bmpSessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(bmpSessionKey);
        if (!bmpSession) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }
        const { afi, safi } = getAfiAndSafi(peer.addrFamilyType);
        const peerKey = BmpBgpSession.makeKey(afi, safi, peer.peerIp, peer.peerRd);
        const bgpPeer = bmpSession.bgpSessionMap.get(peerKey);
        if (!bgpPeer) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在对等体 ${peerKey}`);
            this.messageHandler.sendErrorResponse(messageId, '对等体信息不存在');
            return;
        }
        this.messageHandler.sendSuccessResponse(messageId, bgpPeer.getPeerInfo(), '获取对等体信息成功');
    }

    getBgpInstances(messageId, client) {
        const bmpSessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(bmpSessionKey);
        if (!bmpSession) {
            logger.error(`BMP会话 ${bmpSessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }

        const instanceList = [];
        bmpSession.bgpInstanceMap.forEach((instance, _) => {
            instanceList.push(instance.getInstanceInfo());
        });

        this.messageHandler.sendSuccessResponse(messageId, instanceList, '获取实例列表成功');
    }
}

new BmpWorker(); // 启动监听
