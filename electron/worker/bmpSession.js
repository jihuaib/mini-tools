const logger = require('../log/logger');
const BmpConst = require('../const/bmpConst');
const { getInitiationTlvName } = require('../utils/bmpUtils');
const BgpConst = require('../const/bgpConst');
const BmpBgpPeer = require('./bmpBgpPeer');
const BmpBgpRoute = require('./bmpBgpRoute');
const { rdBufferToString, ipv4BufferToString, ipv6BufferToString } = require('../utils/ipUtils');
const { parseBgpPacket } = require('../utils/bgpPacketParser');

class BmpSession {
    constructor(messageHandler, bmpWorker) {
        this.socket = null;
        this.messageHandler = messageHandler;
        this.bmpWorker = bmpWorker;
        this.localIp = null;
        this.localPort = null;
        this.remoteIp = null;
        this.remotePort = null;
        this.sysName = null;
        this.sysDesc = null;
        this.receivedAt = null;
        this.tlvs = [];

        this.peerMap = new Map();
        this.messageBuffer = Buffer.alloc(0);
    }

    static makeKey(localIp, localPort, remoteIp, remotePort) {
        return `${localIp}|${localPort}|${remoteIp}|${remotePort}`;
    }

    static parseKey(key) {
        const [localIp, localPort, remoteIp, remotePort] = key.split('|');
        return { localIp, localPort, remoteIp, remotePort };
    }

    getRouteMapsByFlags(peer, peerFlags) {
        const routeMaps = [];

        // 默认最基础的 pre-rib-in
        routeMaps.push({ name: 'preRibIn', map: peer.preRibInMap });

        // 如果有 POST_POLICY 标志
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.POST_POLICY) {
            routeMaps.push({ name: 'ribIn', map: peer.ribInMap });
        }

        // 如果有 ADJ_RIB_OUT 标志
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.ADJ_RIB_OUT) {
            routeMaps.push({ name: 'postLocRib', map: peer.postLocRibMap });
        }

        // 如果有 LOC_RIB 标志
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.LOC_RIB) {
            routeMaps.push({ name: 'locRib', map: peer.locRibMap });
        }

        return routeMaps;
    }

    processRouteMonitoring(message) {
        try {
            let position = 0;

            const _peerType = message[position];
            position += 1;
            const peerFlags = message[position];
            position += 1;
            const rdBuffer = message.subarray(position, position + BgpConst.BGP_RD_LEN);
            position += BgpConst.BGP_RD_LEN;
            const peerRd = rdBufferToString(rdBuffer);

            let peerAddress;
            if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
                // IPv6 对等体
                peerAddress = ipv6BufferToString(message.subarray(position, position + 16), 128);
                position += 16;
            } else {
                // IPv4 对等体
                // 12字节保留字段
                position += 12;
                peerAddress = ipv4BufferToString(message.subarray(position, position + 4), 32);
                position += 4;
            }

            const _peerAs = message.readUInt32BE(position);
            position += 4;
            const _peerRouterId = ipv4BufferToString(message.subarray(position, position + 4), 32);
            position += 4;
            const _peerTimestamp = message.readUInt32BE(position);
            position += 4;
            const _peerTimestampMs = message.readUInt32BE(position);
            position += 4;

            // BGP 更新消息
            const bgpUpdateHeader = message.subarray(position, position + BgpConst.BGP_HEAD_LEN);
            const { length: updateLength, type: _updateType } = this.parseBgpHeader(bgpUpdateHeader);
            const bgpUpdate = message.subarray(position, position + updateLength);
            const parsedBgpUpdate = parseBgpPacket(bgpUpdate);
            if (!parsedBgpUpdate.valid) {
                logger.error(`Received BGP Update message is invalid: ${parsedBgpUpdate.error}`);
            }
            position += updateLength;

            let routeUpdates = [];

            // 处理withdrawn routes (IPv4)
            if (parsedBgpUpdate.withdrawnRoutes && parsedBgpUpdate.withdrawnRoutes.length > 0) {
                // 寻找匹配的IPv4 Unicast peer
                const peer = this.findPeer(
                    peerAddress,
                    peerRd,
                    BgpConst.BGP_AFI_TYPE.AFI_IPV4,
                    BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST
                );
                if (peer) {
                    // 删除所有撤销的路由
                    const routeMaps = this.getRouteMapsByFlags(peer, peerFlags);
                    for (const routeMap of routeMaps) {
                        for (const withdrawn of parsedBgpUpdate.withdrawnRoutes) {
                            const key = BmpBgpRoute.makeKey(withdrawn.rd, withdrawn.prefix, withdrawn.length);
                            const route = routeMap.map.get(key);
                            if (route) {
                                routeUpdates.push({
                                    type: BmpConst.BMP_ROUTE_UPDATE_TYPE.ROUTE_DELETE,
                                    ribType: routeMap.name,
                                    client: this.getClientInfo(),
                                    peer: peer.getPeerInfo(),
                                    route: route.getRouteInfo()
                                });
                                routeMap.map.delete(key);
                            }
                        }
                    }

                    if (routeUpdates.length > 0) {
                        this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.ROUTE_UPDATE, { data: routeUpdates });
                    }
                }
            }

            routeUpdates = [];
            // 处理MP_UNREACH_NLRI (多协议撤销路由)
            let mpUnreachNlri = null;
            for (const attr of parsedBgpUpdate.pathAttributes || []) {
                if (attr.typeCode === BgpConst.BGP_PATH_ATTR.MP_UNREACH_NLRI) {
                    mpUnreachNlri = attr.mpUnreach;
                    break;
                }
            }

            if (mpUnreachNlri && mpUnreachNlri.withdrawnRoutes && mpUnreachNlri.withdrawnRoutes.length > 0) {
                // 寻找匹配的多协议peer
                const peer = this.findPeer(peerAddress, peerRd, mpUnreachNlri.afi, mpUnreachNlri.safi);
                if (peer) {
                    // 删除所有撤销的路由
                    const routeMaps = this.getRouteMapsByFlags(peer, peerFlags);
                    for (const routeMap of routeMaps) {
                        for (const withdrawn of mpUnreachNlri.withdrawnRoutes) {
                            const key = BmpBgpRoute.makeKey(withdrawn.rd, withdrawn.prefix, withdrawn.length);
                            const route = routeMap.map.get(key);
                            if (route) {
                                routeUpdates.push({
                                    type: BmpConst.BMP_ROUTE_UPDATE_TYPE.ROUTE_DELETE,
                                    ribType: routeMap.name,
                                    client: this.getClientInfo(),
                                    peer: peer.getPeerInfo(),
                                    route: route.getRouteInfo()
                                });
                                routeMap.map.delete(key);
                            }
                        }
                    }

                    if (routeUpdates.length > 0) {
                        this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.ROUTE_UPDATE, { data: routeUpdates });
                    }
                }
            }

            routeUpdates = [];
            // 处理IPv4 NLRI
            if (parsedBgpUpdate.nlri && parsedBgpUpdate.nlri.length > 0) {
                // 寻找匹配的IPv4 Unicast peer
                const peer = this.findPeer(
                    peerAddress,
                    peerRd,
                    BgpConst.BGP_AFI_TYPE.AFI_IPV4,
                    BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST
                );
                if (peer) {
                    // 处理所有NLRI条目
                    const routeMaps = this.getRouteMapsByFlags(peer, peerFlags);
                    for (const routeMap of routeMaps) {
                        for (const nlri of parsedBgpUpdate.nlri) {
                            const key = BmpBgpRoute.makeKey(nlri.rd, nlri.prefix, nlri.length);

                            let bmpBgpRoute = routeMap.map.get(key);
                            if (!bmpBgpRoute) {
                                bmpBgpRoute = new BmpBgpRoute(peer);
                                routeMap.map.set(key, bmpBgpRoute);
                            } else {
                                bmpBgpRoute.clearAttributes();
                            }

                            bmpBgpRoute.rd = nlri.rd;
                            bmpBgpRoute.ip = nlri.prefix;
                            bmpBgpRoute.mask = nlri.length;

                            // 设置路由属性
                            this.setRouteAttributes(bmpBgpRoute, parsedBgpUpdate);

                            routeUpdates.push({
                                type: BmpConst.BMP_ROUTE_UPDATE_TYPE.ROUTE_UPDATE,
                                ribType: routeMap.name,
                                client: this.getClientInfo(),
                                peer: peer.getPeerInfo(),
                                route: bmpBgpRoute.getRouteInfo()
                            });
                        }
                    }

                    if (routeUpdates.length > 0) {
                        this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.ROUTE_UPDATE, { data: routeUpdates });
                    }
                }
            }

            // 处理MP_REACH_NLRI (多协议扩展)
            let mpReachNlri = null;
            for (const attr of parsedBgpUpdate.pathAttributes || []) {
                if (attr.typeCode === BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI) {
                    mpReachNlri = attr.mpReach;
                    break;
                }
            }

            if (mpReachNlri && mpReachNlri.nlri && mpReachNlri.nlri.length > 0) {
                // 寻找匹配的多协议peer
                const peer = this.findPeer(peerAddress, peerRd, mpReachNlri.afi, mpReachNlri.safi);
                if (peer) {
                    // 处理所有MP_REACH_NLRI条目
                    const routeMaps = this.getRouteMapsByFlags(peer, peerFlags);
                    for (const routeMap of routeMaps) {
                        for (const nlri of mpReachNlri.nlri) {
                            const key = BmpBgpRoute.makeKey(nlri.rd, nlri.prefix, nlri.length);

                            let bmpBgpRoute = routeMap.map.get(key);
                            if (!bmpBgpRoute) {
                                bmpBgpRoute = new BmpBgpRoute(peer);
                                routeMap.map.set(key, bmpBgpRoute);
                            } else {
                                bmpBgpRoute.clearAttributes();
                            }

                            bmpBgpRoute.rd = nlri.rd;
                            bmpBgpRoute.ip = nlri.prefix;
                            bmpBgpRoute.mask = nlri.length;

                            // 设置路由属性
                            this.setRouteAttributes(bmpBgpRoute, parsedBgpUpdate);

                            routeUpdates.push({
                                type: BmpConst.BMP_ROUTE_UPDATE_TYPE.ROUTE_UPDATE,
                                ribType: routeMap.name,
                                client: this.getClientInfo(),
                                peer: peer.getPeerInfo(),
                                route: bmpBgpRoute.getRouteInfo()
                            });
                        }
                    }

                    if (routeUpdates.length > 0) {
                        this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.ROUTE_UPDATE, { data: routeUpdates });
                    }
                }
            }
        } catch (err) {
            logger.error(`Error processing route monitoring:`, err);
        }
    }

    // 辅助方法：根据peerAddress和地址族找到对应的peer
    findPeer(peerAddress, peerRd, afi, safi) {
        // 优先尝试查找精确匹配的peer
        const exactKey = BmpBgpPeer.makeKey(afi, safi, peerAddress, peerRd);
        let peer = this.peerMap.get(exactKey);

        if (peer) {
            return peer;
        }

        // 如果没找到，尝试查找地址族为null的通用peer
        const genericKey = BmpBgpPeer.makeKey(null, null, peerAddress, peerRd);
        return this.peerMap.get(genericKey);
    }

    // 辅助方法：设置路由属性
    setRouteAttributes(route, bgpUpdate) {
        route.bgpPacket = bgpUpdate;

        for (const attr of bgpUpdate.pathAttributes || []) {
            switch (attr.typeCode) {
                case BgpConst.BGP_PATH_ATTR.ORIGIN:
                    route.origin = attr.origin;
                    break;
                case BgpConst.BGP_PATH_ATTR.AS_PATH:
                    route.asPath = '';
                    attr.segments.forEach(seg => {
                        if (seg.typeName === 'AS_SEQUENCE') {
                            route.asPath += seg.asNumbers.join(' ');
                        } else {
                            route.asPath += `{${seg.asNumbers.join(' ')}}`;
                        }
                    });
                    break;
                case BgpConst.BGP_PATH_ATTR.NEXT_HOP:
                    route.nextHop = attr.nextHop;
                    break;
                case BgpConst.BGP_PATH_ATTR.LOCAL_PREF:
                    route.localPref = attr.localPref;
                    break;
                case BgpConst.BGP_PATH_ATTR.COMMUNITY:
                    route.communities = attr.communities.map(c => c.formatted).join(' ');
                    break;
                case BgpConst.BGP_PATH_ATTR.MED:
                    route.med = attr.med;
                    break;
                case BgpConst.BGP_PATH_ATTR.PATH_OTC:
                    route.otc = attr.otc;
                    break;
                case BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI:
                    route.nextHop = attr.mpReach.nextHop;
            }
        }
    }

    getClientInfo() {
        return {
            localIp: this.localIp,
            localPort: this.localPort,
            remoteIp: this.remoteIp,
            remotePort: this.remotePort,
            sysName: this.sysName,
            sysDesc: this.sysDesc,
            rawTlvs: this.tlvs,
            receivedAt: this.receivedAt
        };
    }

    processInitiation(message) {
        try {
            let position = 0;

            this.tlvs = [];

            // 解析消息中的所有TLV
            while (position < message.length) {
                // 每个TLV由Type (2字节), Length (2字节)和Value (可变)组成
                if (position + 4 > message.length) {
                    break; // 没有足够的TLV头数据
                }

                const type = message.readUInt16BE(position);
                position += 2;

                const length = message.readUInt16BE(position);
                position += 2;

                if (position + length > message.length) {
                    break; // 没有足够的TLV值数据
                }

                const value = message.subarray(position, position + length).toString('utf8');
                position += length;

                this.tlvs.push({ type, length, value });
            }

            // 提取已知的TLV类型
            this.sysName = '';
            this.sysDesc = '';

            for (const tlv of this.tlvs) {
                switch (tlv.type) {
                    case BmpConst.BMP_INITIATION_TLV_TYPE.SYS_NAME: // sysName
                        this.sysName = tlv.value;
                        tlv.tlvName = getInitiationTlvName(tlv.type);
                        break;
                    case BmpConst.BMP_INITIATION_TLV_TYPE.SYS_DESC: // sysDesc
                        this.sysDesc = tlv.value;
                        tlv.tlvName = getInitiationTlvName(tlv.type);
                        break;
                    default:
                        tlv.tlvName = getInitiationTlvName(tlv.type);
                }
            }

            this.receivedAt = new Date();

            // 创建一个初始化记录
            const clientInfo = this.getClientInfo();

            this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.INITIATION, { data: clientInfo });
            logger.info(`Processed initiation message: sysName=${this.sysName}, sysDesc=${this.sysDesc}`);
        } catch (err) {
            logger.error(`Error processing initiation:`, err);
        }
    }

    parseBgpHeader(buffer) {
        if (buffer.length < BgpConst.BGP_HEAD_LEN) {
            return null;
        }

        const marker = buffer.subarray(0, 16).toString('hex');
        const length = buffer.readUInt16BE(16);
        const type = buffer.readUInt8(18);

        return { marker, length, type };
    }

    processPeerDown(message) {
        try {
            let position = 0;

            const _peerType = message[position];
            position += 1;
            const peerFlags = message[position];
            position += 1;
            const rdBuffer = message.subarray(position, position + BgpConst.BGP_RD_LEN);
            position += BgpConst.BGP_RD_LEN;
            const peerRd = rdBufferToString(rdBuffer);

            let peerAddress;
            if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
                // IPv6 peer
                peerAddress = ipv6BufferToString(message.subarray(position, position + 16), 128);
                position += 16;
            } else {
                // IPv4 peer
                // 12字节保留字段
                position += 12;
                peerAddress = ipv4BufferToString(message.subarray(position, position + 4), 32);
                position += 4;
            }

            const _peerAs = message.readUInt32BE(position);
            position += 4;
            const _peerRouterId = ipv4BufferToString(message.subarray(position, position + 4), 32);
            position += 4;
            const _peerTimestamp = message.readUInt32BE(position);
            position += 4;
            const _peerTimestampMs = message.readUInt32BE(position);
            position += 4;

            const _reason = message[position];
            position += 1;

            let parsedBgpNotification = null;
            if (position + BgpConst.BGP_HEAD_LEN <= message.length) {
                // BGP notification message
                const bgpNotificationHeader = message.subarray(position, position + BgpConst.BGP_HEAD_LEN);
                const { length: notificationLength, type: _notificationType } =
                    this.parseBgpHeader(bgpNotificationHeader);
                const bgpNotification = message.subarray(position, position + notificationLength);
                parsedBgpNotification = parseBgpPacket(bgpNotification);
                if (!parsedBgpNotification.valid) {
                    logger.error(`Received BGP Notification message is invalid: ${parsedBgpNotification.error}`);
                }
            }

            // Find all matching peers and store their keys for deletion
            const keysToDelete = [];
            this.peerMap.forEach((peer, key) => {
                if (peer.peerIp === peerAddress && peer.peerRd === peerRd) {
                    if (parsedBgpNotification) {
                        peer.bgpPacket.push({ type: 'notification', packet: parsedBgpNotification });
                    }

                    peer.peerState = BmpConst.BMP_PEER_STATE.PEER_DOWN;
                    this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.PEER_UPDATE, { data: peer.getPeerInfo() });

                    keysToDelete.push(key);
                }
            });

            if (keysToDelete.length > 0) {
                keysToDelete.forEach(key => {
                    this.peerMap.delete(key);
                });
            }
        } catch (err) {
            logger.error(`Error processing peer down:`, err);
        }
    }

    processPeerUp(message) {
        try {
            let position = 0;

            const peerType = message[position];
            position += 1;
            const peerFlags = message[position];
            position += 1;
            const rdBuffer = message.subarray(position, position + BgpConst.BGP_RD_LEN);
            position += BgpConst.BGP_RD_LEN;
            const peerRd = rdBufferToString(rdBuffer);

            let peerAddress;
            if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
                // IPv6 peer
                peerAddress = ipv6BufferToString(message.subarray(position, position + 16), 128);
                position += 16;
            } else {
                // IPv4 peer
                // 12字节保留字段
                position += 12;
                peerAddress = ipv4BufferToString(message.subarray(position, position + 4), 32);
                position += 4;
            }

            const peerAs = message.readUInt32BE(position);
            position += 4;
            const peerRouterId = ipv4BufferToString(message.subarray(position, position + 4), 32);
            position += 4;
            const peerTimestamp = message.readUInt32BE(position);
            position += 4;
            const peerTimestampMs = message.readUInt32BE(position);
            position += 4;

            let localAddress;
            if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
                // IPv6 peer
                localAddress = ipv6BufferToString(message.subarray(position, position + 16), 128);
                position += 16;
            } else {
                // IPv4 peer
                // 12字节保留字段
                position += 12;
                localAddress = ipv4BufferToString(message.subarray(position, position + 4), 32);
                position += 4;
            }

            const localPort = message.readUInt16BE(position);
            position += 2;
            const remotePort = message.readUInt16BE(position);
            position += 2;

            let parsedRecvBgpOpen = null;
            let parsedSendBgpOpen = null;

            if (position + BgpConst.BGP_HEAD_LEN <= message.length) {
                // BGP recv Open message
                const bgpRecvOpenHeader = message.subarray(position, position + BgpConst.BGP_HEAD_LEN);
                const { length: recvOpenLength, type: _recvOpenType } = this.parseBgpHeader(bgpRecvOpenHeader);
                const bgpRecvOpen = message.subarray(position, position + recvOpenLength);
                parsedRecvBgpOpen = parseBgpPacket(bgpRecvOpen);
                if (!parsedRecvBgpOpen.valid) {
                    logger.error(`Received BGP Open message is invalid: ${parsedRecvBgpOpen.error}`);
                }
                position += recvOpenLength;
            }

            if (position + BgpConst.BGP_HEAD_LEN <= message.length) {
                // BGP send Open message
                const bgpSendOpenHeader = message.subarray(position, position + BgpConst.BGP_HEAD_LEN);
                const { length: sendOpenLength, type: _sendOpenType } = this.parseBgpHeader(bgpSendOpenHeader);
                const bgpSendOpen = message.subarray(position, position + sendOpenLength);
                parsedSendBgpOpen = parseBgpPacket(bgpSendOpen);
                if (!parsedSendBgpOpen.valid) {
                    logger.error(`Sent BGP Open message is invalid: ${parsedSendBgpOpen.error}`);
                }
                position += sendOpenLength;
            }

            // Extract enabled address families from capabilities
            const enabledAddressFamilies = [];
            const recvAddressFamilies = [];
            const sentAddressFamilies = [];

            // Process received BGP OPEN message capabilities
            if (parsedRecvBgpOpen && parsedRecvBgpOpen.capabilities) {
                parsedRecvBgpOpen.capabilities.forEach(capability => {
                    if (capability.code === BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS) {
                        recvAddressFamilies.push({
                            afi: capability.afi,
                            safi: capability.safi
                        });
                    }
                });
            }

            // Process sent BGP OPEN message capabilities
            if (parsedSendBgpOpen && parsedSendBgpOpen.capabilities) {
                parsedSendBgpOpen.capabilities.forEach(capability => {
                    if (capability.code === BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS) {
                        sentAddressFamilies.push({
                            afi: capability.afi,
                            safi: capability.safi
                        });
                    }
                });
            }

            // Only include address families that appear in both received and sent capabilities
            recvAddressFamilies.forEach(recvAF => {
                const matchingSentAF = sentAddressFamilies.find(
                    sentAF => sentAF.afi === recvAF.afi && sentAF.safi === recvAF.safi
                );

                if (matchingSentAF) {
                    enabledAddressFamilies.push(recvAF);
                }
            });

            // Create BmpBgpPeer instances for each enabled address family
            for (const addressFamily of enabledAddressFamilies) {
                const key = BmpBgpPeer.makeKey(addressFamily.afi, addressFamily.safi, peerAddress, peerRd);
                let bmpBgpPeer = this.peerMap.get(key);
                if (!bmpBgpPeer) {
                    bmpBgpPeer = new BmpBgpPeer(this);
                    this.peerMap.set(key, bmpBgpPeer);
                } else {
                    bmpBgpPeer.bgpPacket = [];
                }

                bmpBgpPeer.peerType = peerType;
                bmpBgpPeer.peerFlags = peerFlags;
                bmpBgpPeer.peerRd = peerRd;
                bmpBgpPeer.peerIp = peerAddress;
                bmpBgpPeer.peerAs = peerAs;
                bmpBgpPeer.peerRouterId = peerRouterId;
                bmpBgpPeer.peerTimestamp = peerTimestamp;
                bmpBgpPeer.peerTimestampMs = peerTimestampMs;
                bmpBgpPeer.localIp = localAddress;
                bmpBgpPeer.localPort = localPort;
                bmpBgpPeer.remotePort = remotePort;
                if (parsedRecvBgpOpen) {
                    bmpBgpPeer.bgpPacket.push({ type: 'recv Open', packet: parsedRecvBgpOpen });
                }
                if (parsedSendBgpOpen) {
                    bmpBgpPeer.bgpPacket.push({ type: 'send Open', packet: parsedSendBgpOpen });
                }
                bmpBgpPeer.peerState = BmpConst.BMP_PEER_STATE.PEER_UP;
                bmpBgpPeer.afi = addressFamily.afi;
                bmpBgpPeer.safi = addressFamily.safi;

                this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.PEER_UPDATE, { data: bmpBgpPeer.getPeerInfo() });
            }

            // If no address families were found in capabilities, create a default peer (for legacy support)
            if (enabledAddressFamilies.length === 0) {
                const key = BmpBgpPeer.makeKey(null, null, peerAddress, peerRd);
                let bmpBgpPeer = this.peerMap.get(key);
                if (!bmpBgpPeer) {
                    bmpBgpPeer = new BmpBgpPeer(this);
                    this.peerMap.set(key, bmpBgpPeer);
                } else {
                    bmpBgpPeer.bgpPacket = [];
                }

                bmpBgpPeer.peerType = peerType;
                bmpBgpPeer.peerFlags = peerFlags;
                bmpBgpPeer.peerRd = peerRd;
                bmpBgpPeer.peerIp = peerAddress;
                bmpBgpPeer.peerAs = peerAs;
                bmpBgpPeer.peerRouterId = peerRouterId;
                bmpBgpPeer.peerTimestamp = peerTimestamp;
                bmpBgpPeer.peerTimestampMs = peerTimestampMs;
                bmpBgpPeer.localIp = localAddress;
                bmpBgpPeer.localPort = localPort;
                bmpBgpPeer.remotePort = remotePort;
                if (parsedRecvBgpOpen) {
                    bmpBgpPeer.bgpPacket.push({ type: 'recv Open', packet: parsedRecvBgpOpen });
                }
                if (parsedSendBgpOpen) {
                    bmpBgpPeer.bgpPacket.push({ type: 'send Open', packet: parsedSendBgpOpen });
                }
                bmpBgpPeer.peerState = BmpConst.BMP_PEER_STATE.PEER_UP;

                this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.PEER_UPDATE, { data: bmpBgpPeer.getPeerInfo() });
            }
        } catch (err) {
            logger.error(`Error processing peer up:`, err);
        }
    }

    processTermination(_message) {
        const clientInfo = this.getClientInfo();
        this.messageHandler.sendEvent(BmpConst.BMP_EVT_TYPES.TERMINATION, { data: clientInfo });
        this.closeSession();

        const key = BmpSession.makeKey(this.localIp, this.localPort, this.remoteIp, this.remotePort);
        this.bmpWorker.bmpSessionMap.delete(key);
    }

    processMessage(message) {
        try {
            const clientAddress = `${this.remoteIp}:${this.remotePort}`;

            const _version = message[0];
            const length = message.readUInt32BE(1);
            const type = message[5];

            logger.info(
                `Received message type ${BmpConst.BMP_MSG_TYPE_NAME[type]} from ${clientAddress}, length ${length}`
            );

            const msg = message.slice(BmpConst.BMP_HEADER_LENGTH, length);

            switch (type) {
                case BmpConst.BMP_MSG_TYPE.ROUTE_MONITORING:
                    this.processRouteMonitoring(msg);
                    break;
                case BmpConst.BMP_MSG_TYPE.PEER_DOWN_NOTIFICATION:
                    this.processPeerDown(msg);
                    break;
                case BmpConst.BMP_MSG_TYPE.PEER_UP_NOTIFICATION:
                    this.processPeerUp(msg);
                    break;
                case BmpConst.BMP_MSG_TYPE.INITIATION:
                    this.processInitiation(msg);
                    break;
                case BmpConst.BMP_MSG_TYPE.TERMINATION:
                    this.processTermination(msg);
                    break;
                default:
                    logger.warn(`Unknown message type: ${type}`);
            }
        } catch (err) {
            logger.error(`Error processing message:`, err);
        }
    }

    recvMsg(buffer) {
        this.messageBuffer = Buffer.concat([this.messageBuffer, buffer]);
        this.processBufferedMessages();
    }

    processBufferedMessages() {
        while (this.messageBuffer.length >= BmpConst.BMP_HEADER_LENGTH) {
            const messageLength = this.messageBuffer.readUInt32BE(1);
            if (this.messageBuffer.length < messageLength) {
                logger.info(
                    `Waiting for more data. Have ${this.messageBuffer.length} bytes, need ${messageLength} bytes`
                );
                break;
            }

            const completeMessage = this.messageBuffer.subarray(0, messageLength);
            this.messageBuffer = this.messageBuffer.subarray(messageLength);
            this.processMessage(completeMessage);
        }
    }

    closeSession() {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }

        this.peerMap.forEach((peer, _) => {
            peer.closePeer();
        });

        this.peerMap.clear();
    }
}

module.exports = BmpSession;
