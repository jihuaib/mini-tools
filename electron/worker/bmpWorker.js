const net = require('net');
const util = require('util');
const logger = require('../log/logger');
const WorkerMessageHandler = require('./workerMessageHandler');
const BmpSession = require('./bmpSession');
const { getAfiAndSafi } = require('../utils/bgpUtils');
const BmpBgpPeer = require('./bmpBgpPeer');
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
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_PEERS, this.getPeers.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_ROUTES, this.getRoutes.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_CLIENT, this.getClient.bind(this));
        this.messageHandler.registerHandler(BmpConst.BMP_REQ_TYPES.GET_PEER, this.getPeer.bind(this));
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

    getPeers(messageId, client) {
        const sessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(sessionKey);
        const peerList = [];
        if (!bmpSession) {
            logger.error(`BMP会话 ${sessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }
        bmpSession.peerMap.forEach((peer, _) => {
            peerList.push(peer.getPeerInfo());
        });
        this.messageHandler.sendSuccessResponse(messageId, peerList, '获取对等体列表成功');
    }

    getRoutes(messageId, data) {
        const { client, peer, ribType, page, pageSize } = data;
        const sessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(sessionKey);
        const routeList = [];
        if (!bmpSession) {
            logger.error(`BMP会话 ${sessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }
        const { afi, safi } = getAfiAndSafi(peer.addrFamilyType);
        const peerKey = BmpBgpPeer.makeKey(afi, safi, peer.peerIp, peer.peerRd);
        const bgpPeer = bmpSession.peerMap.get(peerKey);
        if (!bgpPeer) {
            logger.error(`BMP会话 ${sessionKey} 不存在对等体 ${peerKey}`);
            this.messageHandler.sendErrorResponse(messageId, '对等体信息不存在');
            return;
        }
        if (ribType === 'preRibIn') {
            bgpPeer.preRibInMap.forEach((route, _) => {
                routeList.push(route.getRouteInfo());
            });
        } else if (ribType === 'ribIn') {
            bgpPeer.ribInMap.forEach((route, _) => {
                routeList.push(route.getRouteInfo());
            });
        } else if (ribType === 'postLocRib') {
            bgpPeer.postLocRibMap.forEach((route, _) => {
                routeList.push(route.getRouteInfo());
            });
        } else if (ribType === 'locRib') {
            bgpPeer.locRibMap.forEach((route, _) => {
                routeList.push(route.getRouteInfo());
            });
        }

        const total = routeList.length;
        const list = routeList.slice((page - 1) * pageSize, page * pageSize);

        this.messageHandler.sendSuccessResponse(messageId, { list, total }, '获取路由列表成功');
    }

    getClient(messageId, client) {
        const sessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(sessionKey);
        if (!bmpSession) {
            logger.error(`BMP会话 ${sessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }
        this.messageHandler.sendSuccessResponse(messageId, bmpSession.getClientInfo(), '获取客户端信息成功');
    }

    getPeer(messageId, data) {
        const { client, peer } = data;
        const sessionKey = BmpSession.makeKey(client.localIp, client.localPort, client.remoteIp, client.remotePort);
        const bmpSession = this.bmpSessionMap.get(sessionKey);
        if (!bmpSession) {
            logger.error(`BMP会话 ${sessionKey} 不存在`);
            this.messageHandler.sendErrorResponse(messageId, 'BMP会话不存在');
            return;
        }
        const { afi, safi } = getAfiAndSafi(peer.addrFamilyType);
        const peerKey = BmpBgpPeer.makeKey(afi, safi, peer.peerIp, peer.peerRd);
        const bgpPeer = bmpSession.peerMap.get(peerKey);
        if (!bgpPeer) {
            logger.error(`BMP会话 ${sessionKey} 不存在对等体 ${peerKey}`);
            this.messageHandler.sendErrorResponse(messageId, '对等体信息不存在');
            return;
        }
        this.messageHandler.sendSuccessResponse(messageId, bgpPeer.getPeerInfo(), '获取对等体信息成功');
    }
}

new BmpWorker(); // 启动监听
