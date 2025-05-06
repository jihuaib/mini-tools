const net = require('net');
const util = require('util');
const BgpConst = require('../const/bgpConst');
const { getAfiAndSafi, genRouteIps } = require('../utils/ipUtils');
const { BGP_REQ_TYPES } = require('../const/bgpReqConst');
const Logger = require('../log/logger');
const WorkerMessageHandler = require('./workerMessageHandler');
const BgpSession = require('./bgpSession');
const BgpInstance = require('./bgpInstance');
const CommonUtils = require('../utils/commonUtils');
const BgpRoute = require('./bgpRoute');

class BgpWorker {
    constructor() {
        this.ipv6Server = null;
        this.server = null;

        this.logger = new Logger();

        this.bgpConfigData = null; // bgp配置数据
        this.ipv4PeerConfigData = null; // ipv4邻居配置数据
        this.ipv6PeerConfigData = null; // ipv6邻居配置数据

        this.ipv4RouteConfigData = null; // ipv4路由配置数据
        this.ipv6RouteConfigData = null; // ipv6路由配置数据

        this.bgpSessionMap = new Map();
        this.bgpInstanceMap = new Map();

        // 创建消息处理器
        this.messageHandler = new WorkerMessageHandler();
        // 初始化消息处理器
        this.messageHandler.init();
        // 注册消息处理器
        this.messageHandler.registerHandler(BGP_REQ_TYPES.START_BGP, this.startBgp.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.STOP_BGP, this.stopBgp.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.CONFIG_IPV4_PEER, this.configIpv4Peer.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.CONFIG_IPV6_PEER, this.configIpv6Peer.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.GET_PEER_INFO, this.getPeerInfo.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.DELETE_PEER, this.deletePeer.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.GENERATE_IPV4_ROUTES, this.generateRoutes.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.DELETE_IPV4_ROUTES, this.deleteRoute.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.GENERATE_IPV6_ROUTES, this.generateRoutes.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.DELETE_IPV6_ROUTES, this.deleteRoute.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.GET_ROUTES, this.getRoutes.bind(this));
    }

    async startTcpServer(messageId) {
        try {
            this.server = net.createServer(socket => {
                const clientAddress = socket.remoteAddress;
                const clientPort = socket.remotePort;

                this.logger.info(`ipv4 Client connected from ${clientAddress}:${clientPort}`);
                this.logger.info(`ipv4 localAddress: ${socket.localAddress}:${socket.localPort}`);

                // 当接收到数据时处理数据
                socket.on('data', data => {
                    const bgpSession = this.bgpSessionMap.get(BgpSession.makeKey(0, socket.remoteAddress));
                    if (null == bgpSession) {
                        socket.destroy();
                        return;
                    }
                    bgpSession.recvMsg(data);
                });

                socket.on('end', () => {
                    this.logger.info(`ipv4 Client ${clientAddress}:${clientPort} end`);
                });

                socket.on('close', () => {
                    this.logger.info(`ipv4 Client ${clientAddress}:${clientPort} close`);
                });

                socket.on('error', err => {
                    this.logger.error(`ipv4 TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
                });

                const bgpSession = this.bgpSessionMap.get(BgpSession.makeKey(0, socket.remoteAddress));
                if (null == bgpSession) {
                    socket.destroy();
                    return;
                }

                bgpSession.tcpConnectSuccess(socket);
            });

            this.ipv6Server = net.createServer(socket => {
                const clientAddress = socket.remoteAddress;
                const clientPort = socket.remotePort;

                this.logger.info(`ipv6 Client connected from ${clientAddress}:${clientPort}`);
                this.logger.info(`ipv6 localAddress: ${socket.localAddress}:${socket.localPort}`);

                // 当接收到数据时处理数据
                socket.on('data', data => {
                    const bgpSession = this.bgpSessionMap.get(BgpSession.makeKey(0, socket.remoteAddress));
                    if (null == bgpSession) {
                        socket.destroy();
                        return;
                    }
                    bgpSession.recvMsg(data);
                });

                socket.on('end', () => {
                    this.logger.info(`ipv6 Client ${clientAddress}:${clientPort} end`);
                });

                socket.on('close', () => {
                    this.logger.info(`ipv6 Client ${clientAddress}:${clientPort} close`);
                });

                socket.on('error', err => {
                    this.logger.error(`ipv6 TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
                });

                const bgpSession = this.bgpSessionMap.get(BgpSession.makeKey(0, socket.remoteAddress));
                if (null == bgpSession) {
                    socket.destroy();
                    return;
                }

                bgpSession.tcpConnectSuccess(socket);
            });

            // 启动ipv4服务器并监听端口
            const listenPormise = util.promisify(this.server.listen).bind(this.server);
            await listenPormise(BgpConst.BGP_DEFAULT_PORT, '0.0.0.0');
            this.logger.info(`TCP Server listening on port ${BgpConst.BGP_DEFAULT_PORT} at 0.0.0.0`);
            // 启动ipv6服务器并监听端口
            const listenIpv6Pormise = util.promisify(this.ipv6Server.listen).bind(this.ipv6Server);
            await listenIpv6Pormise(BgpConst.BGP_DEFAULT_PORT, '::');
            this.logger.info(`TCP Server listening on port ${BgpConst.BGP_DEFAULT_PORT} at ::`);

            this.logger.info(`bgp协议启动成功`);
            this.messageHandler.sendSuccessResponse(messageId, null, 'bgp协议启动成功');
        } catch (err) {
            this.logger.error(`Error starting TCP server: ${err.message}`);
            this.messageHandler.sendErrorResponse(messageId, 'bgp协议启动失败');
        }
    }

    startBgp(messageId, bgpConfigData) {
        this.bgpConfigData = bgpConfigData;

        this.bgpConfigData.addressFamily.forEach(addressFamily => {
            const { afi, safi } = getAfiAndSafi(addressFamily);
            // 创建bgp实例
            this.bgpInstanceMap.set(BgpInstance.makeKey(0, afi, safi), new BgpInstance(0, afi, safi));
        });

        // 启动tcp服务器
        this.startTcpServer(messageId);
    }

    configIpv4Peer(messageId, ipv4PeerConfigData) {
        let isExist = false;
        let errorFamily = '';
        for (let i = 0; i < ipv4PeerConfigData.addressFamily.length; i++) {
            const family = ipv4PeerConfigData.addressFamily[i];
            const { afi, safi } = getAfiAndSafi(family);
            const bgpInstance = this.bgpInstanceMap.get(BgpInstance.makeKey(0, afi, safi));
            if (null == bgpInstance) {
                // 有地址组实例没创建
                isExist = false;
                errorFamily = family;
                break;
            }
            isExist = true;
        }

        if (!isExist) {
            this.logger.error(`bgp实例不存在: ${errorFamily}`);
            this.messageHandler.sendErrorResponse(messageId, `bgp实例不存在: ${errorFamily}`);
            return;
        }

        // 创建session结构
        const sessKey = BgpSession.makeKey(0, ipv4PeerConfigData.peerIp);
        let bgpSession = null;
        if (this.bgpSessionMap.has(sessKey)) {
            bgpSession = this.bgpSessionMap.get(sessKey);
            bgpSession.clearSession();
            bgpSession.resetSession();
            // 清空peer
            bgpSession.instanceMap.forEach((instance, _) => {
                instance.peerMap.delete(bgpSession.peerIp);
            });
        } else {
            bgpSession = new BgpSession(0, ipv4PeerConfigData.peerIp, this.bgpInstanceMap, this.messageHandler);
        }
        bgpSession.localAs = this.bgpConfigData.localAs;
        bgpSession.peerAs = ipv4PeerConfigData.peerAs;
        bgpSession.routerId = this.bgpConfigData.routerId;
        bgpSession.holdTime = ipv4PeerConfigData.holdTime;
        this.bgpSessionMap.set(sessKey, bgpSession);
        // 设置本地能力标志
        ipv4PeerConfigData.openCap.forEach(cap => {
            if (cap === BgpConst.BGP_CAPABILITY_UI.ADDR_FAMILY) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.MULTIPROTOCOL_EXTENSIONS
                );
                // 设置本地地址族标志
                ipv4PeerConfigData.addressFamily.forEach(family => {
                    if (family === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST) {
                        bgpSession.localAddrFamilyFlags = CommonUtils.BIT_SET(
                            bgpSession.localAddrFamilyFlags,
                            BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV4_UNICAST
                        );
                    } else if (family === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST) {
                        bgpSession.localAddrFamilyFlags = CommonUtils.BIT_SET(
                            bgpSession.localAddrFamilyFlags,
                            BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV6_UNICAST
                        );
                    }
                });
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROUTE_REFRESH) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.ROUTE_REFRESH
                );
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.AS4) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.FOUR_OCTET_AS
                );
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROLE) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.BGP_ROLE
                );
                bgpSession.localRole = BgpConst.BGP_ROLE_VALUE_MAP.get(ipv4PeerConfigData.role);
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.EXTENDED_NEXT_HOP_ENCODING) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.EXTENDED_NEXT_HOP_ENCODING
                );
            }
        });
        bgpSession.openCapCustom = ipv4PeerConfigData.openCapCustom;

        // 获取bgp实例
        ipv4PeerConfigData.addressFamily.forEach(family => {
            const { afi, safi } = getAfiAndSafi(family);
            const bgpInstance = this.bgpInstanceMap.get(BgpInstance.makeKey(0, afi, safi));
            bgpInstance.addPeer(bgpSession);
        });

        this.ipv4PeerConfigData = ipv4PeerConfigData;

        this.logger.info(`ipv4 邻居配置成功`);
        this.messageHandler.sendSuccessResponse(messageId, null, `ipv4 邻居配置成功`);
    }

    configIpv6Peer(messageId, ipv6PeerConfigData) {
        let isExist = false;
        let errorFamily = '';
        for (let i = 0; i < ipv6PeerConfigData.addressFamilyIpv6.length; i++) {
            const family = ipv6PeerConfigData.addressFamilyIpv6[i];
            const { afi, safi } = getAfiAndSafi(family);
            const bgpInstance = this.bgpInstanceMap.get(BgpInstance.makeKey(0, afi, safi));
            if (null == bgpInstance) {
                // 有地址组实例没创建
                isExist = false;
                errorFamily = family;
                break;
            }
            isExist = true;
        }

        if (!isExist) {
            this.logger.error(`bgp实例不存在: ${errorFamily}`);
            this.messageHandler.sendErrorResponse(messageId, `bgp实例不存在: ${errorFamily}`);
            return;
        }

        // 创建session结构
        const sessKey = BgpSession.makeKey(0, ipv6PeerConfigData.peerIpv6);
        let bgpSession = null;
        if (this.bgpSessionMap.has(sessKey)) {
            bgpSession = this.bgpSessionMap.get(sessKey);
            bgpSession.clearSession();
            bgpSession.resetSession();
            // 清空peer
            bgpSession.instanceMap.forEach((instance, _) => {
                instance.peerMap.delete(bgpSession.peerIp);
            });
        } else {
            bgpSession = new BgpSession(0, ipv6PeerConfigData.peerIpv6, this.bgpInstanceMap, this.messageHandler);
        }
        bgpSession.localAs = this.bgpConfigData.localAs;
        bgpSession.peerAs = ipv6PeerConfigData.peerIpv6As;
        bgpSession.routerId = this.bgpConfigData.routerId;
        bgpSession.holdTime = ipv6PeerConfigData.holdTimeIpv6;
        this.bgpSessionMap.set(sessKey, bgpSession);
        // 设置本地能力标志
        ipv6PeerConfigData.openCapIpv6.forEach(cap => {
            if (cap === BgpConst.BGP_CAPABILITY_UI.ADDR_FAMILY) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.MULTIPROTOCOL_EXTENSIONS
                );
                // 设置本地地址族标志
                ipv6PeerConfigData.addressFamilyIpv6.forEach(family => {
                    if (family === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST) {
                        bgpSession.localAddrFamilyFlags = CommonUtils.BIT_SET(
                            bgpSession.localAddrFamilyFlags,
                            BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV4_UNICAST
                        );
                    } else if (family === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST) {
                        bgpSession.localAddrFamilyFlags = CommonUtils.BIT_SET(
                            bgpSession.localAddrFamilyFlags,
                            BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV6_UNICAST
                        );
                    }
                });
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROUTE_REFRESH) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.ROUTE_REFRESH
                );
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.AS4) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.FOUR_OCTET_AS
                );
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROLE) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.BGP_ROLE
                );
                bgpSession.localRole = BgpConst.BGP_ROLE_VALUE_MAP.get(ipv6PeerConfigData.roleIpv6);
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.EXTENDED_NEXT_HOP_ENCODING) {
                bgpSession.localCapFlags = CommonUtils.BIT_SET(
                    bgpSession.localCapFlags,
                    BgpConst.BGP_CAP_FLAGS.EXTENDED_NEXT_HOP_ENCODING
                );
            }
        });
        bgpSession.openCapCustom = ipv6PeerConfigData.openCapCustomIpv6;

        // 获取bgp实例
        ipv6PeerConfigData.addressFamilyIpv6.forEach(family => {
            const { afi, safi } = getAfiAndSafi(family);
            const bgpInstance = this.bgpInstanceMap.get(BgpInstance.makeKey(0, afi, safi));
            bgpInstance.addPeer(bgpSession);
        });

        this.ipv6PeerConfigData = ipv6PeerConfigData;

        this.logger.info(`ipv6 邻居配置成功`);
        this.messageHandler.sendSuccessResponse(messageId, null, `ipv6 邻居配置成功`);
    }

    getPeerInfo(messageId) {
        const ipv4PeerInfoList = [];
        const ipv6PeerInfoList = [];
        this.bgpInstanceMap.forEach((instance, instanceKey) => {
            if (instance.peerMap && instance.peerMap.size > 0) {
                instance.peerMap.forEach((peer, _) => {
                    const peerInfo = peer.getPeerInfo();
                    if (peerInfo.addressFamily === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST) {
                        ipv4PeerInfoList.push(peerInfo);
                    } else if (peerInfo.addressFamily === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST) {
                        ipv6PeerInfoList.push(peerInfo);
                    }
                });
            } else {
                this.logger.warn(`peerMap is empty or undefined for instance: ${instanceKey}`);
            }
        });

        const peerInfoList = {
            [BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST]: [...ipv4PeerInfoList],
            [BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST]: [...ipv6PeerInfoList]
        };
        this.messageHandler.sendSuccessResponse(messageId, peerInfoList, '邻居信息查询成功');
    }

    stopBgp(messageId) {
        if (this.server) {
            this.server.close();
            this.server = null;
        }

        if (this.ipv6Server) {
            this.ipv6Server.close();
            this.ipv6Server = null;
        }

        // 清空peerMap
        this.bgpInstanceMap.forEach((instance, _) => {
            instance.peerMap.clear();
        });

        // 清空routeMap
        this.bgpInstanceMap.forEach((instance, _) => {
            instance.routeMap.clear();
        });

        // 关闭session socket
        this.bgpSessionMap.forEach((session, _) => {
            session.clearSession();
            session.resetSession();
        });

        // 清空sessionMap
        this.bgpSessionMap.clear();

        // 清空instanceMap
        this.bgpInstanceMap.clear();

        // 清空配置数据
        this.bgpConfigData = null;
        this.ipv4PeerConfigData = null;
        this.ipv6PeerConfigData = null;
        this.ipv4RouteConfigData = null;
        this.ipv6RouteConfigData = null;

        this.logger.info(`BGP stopped successfully`);

        // Send response using messageHandler
        this.messageHandler.sendSuccessResponse(messageId, null, 'bgp协议停止成功');
    }

    generateRoutes(messageId, config) {
        // 查询实例是否存在
        const { afi, safi } = getAfiAndSafi(config.addressFamily);
        const instance = this.bgpInstanceMap.get(BgpInstance.makeKey(0, afi, safi));
        if (!instance) {
            this.logger.error('实例不存在');
            this.messageHandler.sendErrorResponse(messageId, '实例不存在');
            return;
        }

        // 生成路由IP
        const ipType = afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4 ? BgpConst.IP_TYPE.IPV4 : BgpConst.IP_TYPE.IPV6;
        const routes = genRouteIps(ipType, config.prefix, config.mask, config.count);
        if (routes.length == 0) {
            this.messageHandler.sendSuccessResponse(messageId, null, '路由生成成功');
            return;
        }

        let hasRouteChanged = false;
        routes.forEach(route => {
            const key = BgpRoute.makeKey(route.ip, route.mask);
            if (!instance.routeMap.has(key)) {
                const bgpRoute = new BgpRoute(instance);
                bgpRoute.ip = route.ip;
                bgpRoute.mask = route.mask;
                instance.routeMap.set(key, bgpRoute);
                hasRouteChanged = true;
            }
        });

        if (instance.customAttr !== config.customAttr) {
            instance.customAttr = config.customAttr;
            hasRouteChanged = true;
        }

        if (hasRouteChanged) {
            instance.sendRoute();
        }

        this.messageHandler.sendSuccessResponse(messageId, null, '路由生成成功');
    }

    deleteRoute(messageId, config) {
        // 查询实例是否存在
        const { afi, safi } = getAfiAndSafi(config.addressFamily);
        const instance = this.bgpInstanceMap.get(BgpInstance.makeKey(0, afi, safi));
        if (!instance) {
            this.logger.error('实例不存在');
            this.messageHandler.sendErrorResponse(messageId, '实例不存在');
            return;
        }

        // 生成路由IP
        const ipType = afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4 ? BgpConst.IP_TYPE.IPV4 : BgpConst.IP_TYPE.IPV6;
        const routes = genRouteIps(ipType, config.prefix, config.mask, config.count);
        if (routes.length == 0) {
            this.messageHandler.sendSuccessResponse(messageId, null, '路由删除成功');
            return;
        }

        const withdrawnRoutes = [];

        routes.forEach(route => {
            const key = BgpRoute.makeKey(route.ip, route.mask);
            instance.routeMap.delete(key);
            withdrawnRoutes.push(route);
        });

        if (withdrawnRoutes.length > 0) {
            instance.withdrawRoute(withdrawnRoutes);
        }

        this.messageHandler.sendSuccessResponse(messageId, null, '路由删除成功');
    }

    deletePeer(messageId, peerRecord) {
        // 查询实例是否存在
        const { afi, safi } = getAfiAndSafi(peerRecord.addressFamily);
        const instance = this.bgpInstanceMap.get(BgpInstance.makeKey(0, afi, safi));
        if (!instance) {
            this.logger.error('实例不存在');
            this.messageHandler.sendErrorResponse(messageId, '实例不存在');
            return;
        }

        // 查询session是否存在
        const sessionKey = BgpSession.makeKey(0, peerRecord.peerIp);
        const session = this.bgpSessionMap.get(sessionKey);
        if (!session) {
            this.logger.error('session不存在');
            this.messageHandler.sendErrorResponse(messageId, 'session不存在');
            return;
        }

        // 查询peer是否存在
        const peer = instance.peerMap.get(peerRecord.peerIp);
        if (!peer) {
            this.logger.error('peer不存在');
            this.messageHandler.sendErrorResponse(messageId, 'peer不存在');
            return;
        }

        // 删除peer
        instance.peerMap.delete(peerRecord.peerIp);
        if (peerRecord.addressFamily === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST) {
            session.localAddrFamilyFlags = CommonUtils.BIT_RESET(
                session.localAddrFamilyFlags,
                BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV4_UNICAST
            );
        } else if (peerRecord.addressFamily === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST) {
            session.localAddrFamilyFlags = CommonUtils.BIT_RESET(
                session.localAddrFamilyFlags,
                BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV6_UNICAST
            );
        }

        // 查询是否还有其他实例使用该Session
        let hasOtherInstance = false;
        this.bgpInstanceMap.forEach((tempInstance, _) => {
            if (tempInstance.peerMap.size > 0) {
                tempInstance.peerMap.forEach((tempPeer, _) => {
                    const peerSessionKey = BgpSession.makeKey(0, tempPeer.session.peerIp);
                    if (peerSessionKey === sessionKey) {
                        hasOtherInstance = true;
                    }
                });
            }
        });

        if (!hasOtherInstance) {
            // 删除session
            session.clearSession();
            session.resetSession();
            this.bgpSessionMap.delete(sessionKey);
        } else {
            // 更新session的peerMap
            session.resetSession();
        }

        this.messageHandler.sendSuccessResponse(messageId, null, 'peer删除成功');
    }

    getRoutes(messageId, addressFamily) {
        const { afi, safi } = getAfiAndSafi(addressFamily);
        const instance = this.bgpInstanceMap.get(BgpInstance.makeKey(0, afi, safi));
        if (!instance) {
            this.logger.error('实例不存在');
            this.messageHandler.sendErrorResponse(messageId, '实例不存在');
            return;
        }
        const routes = [];
        instance.routeMap.forEach((route, _) => {
            const routeInfo = route.getRouteInfo();
            routes.push(routeInfo);
        });

        this.messageHandler.sendSuccessResponse(messageId, routes, '路由查询成功');
    }
}

new BgpWorker(); // 启动监听
