const { app } = require('electron');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const WorkerWithPromise = require('../worker/workerWithPromise');
const logger = require('../log/logger');
const BgpConst = require('../const/bgpConst');
const EventDispatcher = require('../utils/eventDispatcher');
class BgpApp {
    constructor(ipc, store) {
        this.worker = null;
        this.bgpConfigFileKey = 'bgp-config';
        this.ipv4PeerConfigFileKey = 'ipv4-peer-config';
        this.ipv6PeerConfigFileKey = 'ipv6-peer-config';
        this.ipv4UNCRouteConfigFileKey = 'ipv4-unc-route-config';
        this.ipv6UNCRouteConfigFileKey = 'ipv6-unc-route-config';
        this.isDev = !app.isPackaged;
        this.peerChangeHandler = null;
        this.store = store;
        this.eventDispatcher = null;
        // 注册IPC处理程序
        this.registerHandlers(ipc);
    }

    registerHandlers(ipc) {
        // 配置相关
        ipc.handle('bgp:saveBgpConfig', async (event, config) => this.handleSaveBgpConfig(event, config));
        ipc.handle('bgp:loadBgpConfig', async () => this.handleLoadBgpConfig());
        ipc.handle('bgp:saveIpv4PeerConfig', async (event, config) => this.handleSaveIpv4PeerConfig(event, config));
        ipc.handle('bgp:loadIpv4PeerConfig', async () => this.handleLoadIpv4PeerConfig());
        ipc.handle('bgp:saveIpv6PeerConfig', async (event, config) => this.handleSaveIpv6PeerConfig(event, config));
        ipc.handle('bgp:loadIpv6PeerConfig', async () => this.handleLoadIpv6PeerConfig());
        ipc.handle('bgp:saveIpv4UNCRouteConfig', async (event, config) =>
            this.handleSaveIpv4UNCRouteConfig(event, config)
        );
        ipc.handle('bgp:loadIpv4UNCRouteConfig', async () => this.handleLoadIpv4UNCRouteConfig());
        ipc.handle('bgp:saveIpv6UNCRouteConfig', async (event, config) =>
            this.handleSaveIpv6UNCRouteConfig(event, config)
        );
        ipc.handle('bgp:loadIpv6UNCRouteConfig', async () => this.handleLoadIpv6UNCRouteConfig());

        // bgp
        ipc.handle('bgp:startBgp', async (event, bgpConfigData) => this.handleStartBgp(event, bgpConfigData));
        ipc.handle('bgp:stopBgp', async () => this.handleStopBgp());

        // peer
        ipc.handle('bgp:configIpv4Peer', async (event, ipv4PeerConfigData) =>
            this.handleConfigIpv4Peer(event, ipv4PeerConfigData)
        );
        ipc.handle('bgp:configIpv6Peer', async (event, ipv6PeerConfigData) =>
            this.handleConfigIpv6Peer(event, ipv6PeerConfigData)
        );
        ipc.handle('bgp:getPeerInfo', async () => this.handleGetPeerInfo());
        ipc.handle('bgp:deletePeer', async (event, peer) => this.handleDeletePeer(event, peer));

        // route
        ipc.handle('bgp:generateIpv4Routes', async (event, config) => this.handleGenerateIpv4Routes(event, config));
        ipc.handle('bgp:generateIpv6Routes', async (event, config) => this.handleGenerateIpv6Routes(event, config));
        ipc.handle('bgp:deleteIpv4Routes', async (event, config) => this.handleDeleteIpv4Routes(event, config));
        ipc.handle('bgp:deleteIpv6Routes', async (event, config) => this.handleDeleteIpv6Routes(event, config));
        ipc.handle('bgp:getRoutes', async (event, addressFamily) => this.handleGetRoutes(event, addressFamily));
    }

    // 保存配置
    async handleSaveBgpConfig(event, config) {
        try {
            this.store.set(this.bgpConfigFileKey, config);
            return successResponse(null, 'BGP配置文件保存成功');
        } catch (error) {
            logger.error('Error saving Bgp config:', error.message);
            return errorResponse(error.message);
        }
    }

    // 加载配置
    async handleLoadBgpConfig() {
        try {
            const config = this.store.get(this.bgpConfigFileKey);
            if (!config) {
                return successResponse(null, 'BGP配置文件不存在');
            }
            return successResponse(config, 'BGP配置文件加载成功');
        } catch (error) {
            logger.error('Error loading Bgp config:', error.message);
            return errorResponse(error.message);
        }
    }

    // 保存配置
    async handleSaveIpv4PeerConfig(event, config) {
        try {
            this.store.set(this.ipv4PeerConfigFileKey, config);
            return successResponse(null, 'IPv4 Peer配置文件保存成功');
        } catch (error) {
            logger.error('Error saving ipv4 peer config:', error.message);
            return errorResponse(error.message);
        }
    }

    // 加载配置
    async handleLoadIpv4PeerConfig() {
        try {
            const config = this.store.get(this.ipv4PeerConfigFileKey);
            if (!config) {
                return successResponse(null, 'IPv4 Peer配置文件不存在');
            }
            return successResponse(config, 'IPv4 Peer配置文件加载成功');
        } catch (error) {
            logger.error('Error loading ipv4 peer config:', error.message);
            return errorResponse(error.message);
        }
    }

    // 保存配置
    async handleSaveIpv6PeerConfig(event, config) {
        try {
            this.store.set(this.ipv6PeerConfigFileKey, config);
            return successResponse(null, 'IPv6 Peer配置文件保存成功');
        } catch (error) {
            logger.error('Error saving ipv6 peer config:', error.message);
            return errorResponse(error.message);
        }
    }

    // 加载配置
    async handleLoadIpv6PeerConfig() {
        try {
            const config = this.store.get(this.ipv6PeerConfigFileKey);
            if (!config) {
                return successResponse(null, 'IPv6 Peer配置文件不存在');
            }
            return successResponse(config, 'IPv6 Peer配置文件加载成功');
        } catch (error) {
            logger.error('Error loading ipv6 peer config:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleSaveIpv4UNCRouteConfig(event, config) {
        try {
            this.store.set(this.ipv4UNCRouteConfigFileKey, config);
            return successResponse(null, 'IPv4 UNC Route配置文件保存成功');
        } catch (error) {
            logger.error('Error saving ipv4 unc route config:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleLoadIpv4UNCRouteConfig() {
        try {
            const config = this.store.get(this.ipv4UNCRouteConfigFileKey);
            if (!config) {
                return successResponse(null, 'IPv4 UNC Route配置文件不存在');
            }
            return successResponse(config, 'IPv4 UNC Route配置文件加载成功');
        } catch (error) {
            logger.error('Error loading ipv4 unc route config:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleSaveIpv6UNCRouteConfig(event, config) {
        try {
            this.store.set(this.ipv6UNCRouteConfigFileKey, config);
            return successResponse(null, 'IPv6 UNC Route配置文件保存成功');
        } catch (error) {
            logger.error('Error saving ipv6 unc route config:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleLoadIpv6UNCRouteConfig() {
        try {
            const config = this.store.get(this.ipv6UNCRouteConfigFileKey);
            if (!config) {
                return successResponse(null, 'IPv6 UNC Route配置文件不存在');
            }
            return successResponse(config, 'IPv6 UNC Route配置文件加载成功');
        } catch (error) {
            logger.error('Error loading ipv6 unc route config:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleDeletePeer(event, peer) {
        try {
            if (null === this.worker) {
                logger.error('bgp协议没有运行');
                return errorResponse('bgp协议没有运行');
            }

            logger.info(`delete peer: ${JSON.stringify(peer)}`);

            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.DELETE_PEER, peer);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error deleting peer:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleConfigIpv4Peer(event, ipv4PeerConfigData) {
        try {
            if (null === this.worker) {
                logger.error(`bgp协议没有启动`);
                return errorResponse('bgp协议没有启动');
            }

            logger.info(`ipv4 peer config: ${JSON.stringify(ipv4PeerConfigData)}`);

            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.CONFIG_IPV4_PEER, ipv4PeerConfigData);

            // 这里肯定是启动成功了，如果失败，会抛出异常
            logger.info(`ipv4 config peer成功 result: ${JSON.stringify(result)}`);

            return successResponse(null, result.msg);
        } catch (error) {
            logger.error(`ipv4 Error config Peer:`, error.message);
            return errorResponse(error.message);
        }
    }

    async handleConfigIpv6Peer(event, ipv6PeerConfigData) {
        try {
            if (null === this.worker) {
                logger.error(`bgp协议没有启动`);
                return errorResponse('bgp协议没有启动');
            }

            logger.info(`ipv6 peer config: ${JSON.stringify(ipv6PeerConfigData)}`);

            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.CONFIG_IPV6_PEER, ipv6PeerConfigData);

            // 这里肯定是启动成功了，如果失败，会抛出异常
            logger.info(`ipv6 config peer成功 result: ${JSON.stringify(result)}`);

            return successResponse(null, result.msg);
        } catch (error) {
            logger.error(`ipv6 Error config Peer:`, error.message);
            return errorResponse(error.message);
        }
    }

    async handleStartBgp(event, bgpConfigData) {
        const webContents = event.sender;
        try {
            if (null !== this.worker) {
                logger.error(`bgp协议已经启动`);
                return errorResponse('bgp协议已经启动');
            }

            logger.info(`${JSON.stringify(bgpConfigData)}`);

            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/bgpWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/bgpWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            this.worker = workerFactory.createLongRunningWorker();

            // 设置事件发送器的 webContents
            this.eventDispatcher = new EventDispatcher();
            this.eventDispatcher.setWebContents(webContents);

            // 定义事件处理函数
            this.peerChangeHandler = data => {
                this.eventDispatcher.emit('bgp:peerChange', successResponse(data.data));
            };

            // 注册事件监听器，处理来自worker的事件通知
            this.worker.addEventListener(BgpConst.BGP_EVT_TYPES.BGP_PEER_CHANGE, this.peerChangeHandler);

            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.START_BGP, bgpConfigData);

            // 这里肯定是启动成功了，如果失败，会抛出异常
            logger.info(`bgp启动成功 result: ${JSON.stringify(result)}`);
            return successResponse(null, result.msg);
        } catch (error) {
            this.worker.removeEventListener(BgpConst.BGP_EVT_TYPES.BGP_PEER_CHANGE, this.peerChangeHandler);
            await this.worker.terminate();
            this.worker = null;
            this.eventDispatcher.cleanup(); // 清理事件发送器
            this.eventDispatcher = null;
            logger.error('Error starting BGP:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleStopBgp() {
        if (null === this.worker) {
            logger.error('BGP未启动');
            return errorResponse('BGP未启动');
        }

        try {
            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.STOP_BGP, null);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error stopping BGP:', error.message);
            return errorResponse(error.message);
        } finally {
            // 移除事件监听器
            this.worker.removeEventListener(BgpConst.BGP_EVT_TYPES.BGP_PEER_CHANGE, this.peerChangeHandler);
            await this.worker.terminate();
            this.worker = null;
            this.eventDispatcher.cleanup(); // 清理事件发送器
            this.eventDispatcher = null;
        }
    }

    async handleGetPeerInfo() {
        if (null === this.worker) {
            return successResponse({}, 'bgp协议没有运行');
        }

        try {
            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.GET_PEER_INFO, null);
            logger.info(`获取Peer信息成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取Peer信息成功');
        } catch (error) {
            logger.error('Error getting peer info:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGenerateIpv4Routes(event, config) {
        if (null === this.worker) {
            logger.error('bgp协议没有运行');
            return errorResponse('bgp协议没有运行');
        }

        logger.info(`${JSON.stringify(config)}`);

        try {
            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.GENERATE_IPV4_ROUTES, config);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error generating ipv4 routes:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGenerateIpv6Routes(event, config) {
        if (null === this.worker) {
            logger.error('bgp协议没有运行');
            return errorResponse('bgp协议没有运行');
        }

        logger.info(`${JSON.stringify(config)}`);

        try {
            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.GENERATE_IPV6_ROUTES, config);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error generating ipv6 routes:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleDeleteIpv4Routes(event, config) {
        if (null === this.worker) {
            logger.error('bgp协议没有运行');
            return errorResponse('bgp协议没有运行');
        }

        logger.info(`${JSON.stringify(config)}`);

        try {
            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.DELETE_IPV4_ROUTES, config);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error deleting ipv4 routes:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleDeleteIpv6Routes(event, config) {
        if (null === this.worker) {
            logger.error('bgp协议没有运行');
            return errorResponse('bgp协议没有运行');
        }

        logger.info(`${JSON.stringify(config)}`);

        try {
            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.DELETE_IPV6_ROUTES, config);
            return successResponse(null, result.msg);
        } catch (error) {
            logger.error('Error deleting ipv6 routes:', error.message);
            return errorResponse(error.message);
        }
    }

    async handleGetRoutes(event, addressFamily) {
        if (null === this.worker) {
            return successResponse({}, 'bgp协议没有运行');
        }

        try {
            const result = await this.worker.sendRequest(BgpConst.BGP_REQ_TYPES.GET_ROUTES, addressFamily);
            logger.info(`获取路由列表成功 result: ${JSON.stringify(result)}`);
            return successResponse(result.data, '获取路由信息成功');
        } catch (error) {
            logger.error('Error getting routes:', error.message);
            return errorResponse(error.message);
        }
    }

    getBgpRunning() {
        return null !== this.worker;
    }
}

module.exports = BgpApp;
