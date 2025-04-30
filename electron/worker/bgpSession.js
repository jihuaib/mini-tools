const BgpConst = require('../const/bgpConst');
const BgpPeer = require('./bgpPeer');
const { genRouteIps, writeUInt16, writeUInt32, ipToBytes, getAddrFamilyType, getAfiAndSafi } = require('../utils/ipUtils');
const { parseBgpPacket, getBgpPacketSummary } = require('../utils/bgpPacketParser');
const { BGP_REQ_TYPES } = require('../const/bgpReqConst');
const Logger = require('../log/logger');
const WorkerMessageHandler = require('./workerMessageHandler');
const { BGP_EVT_TYPES } = require('../const/BgpEvtConst');

class BgpSession {
    constructor(bgpConfigData, peerConfigData, messageHandler) {
        this.socket = null;
        this.bgpConfigData = bgpConfigData; // peer配置数据
        this.peerConfigData = peerConfigData; // peer配置数据
        this.packetBuffer = Buffer.alloc(0); // 添加缓冲区用于存储不完整的报文
        this.peerMap = new Map();
        this.messageHandler = messageHandler;

        this.logger = new Logger();
        this.sessState = BgpConst.BGP_PEER_STATE.IDLE;
    }

    createPeer() {
        this.peerConfigData.addressFamily.forEach(family => {
            if (family === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST) {
                const bgpPeer = new BgpPeer(
                    this,
                    0,
                    this.socket ? this.socket.localAddress : 'N/A',
                    this.bgpConfigData.localAs,
                    this.peerConfigData.peerIp,
                    this.peerConfigData.peerAs,
                    BgpConst.BGP_AFI_TYPE.AFI_IPV4,
                    BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST,
                    this.bgpConfigData.routerId
                );
                this.peerMap.set(
                    BgpPeer.makeKey(
                        0,
                        this.peerConfigData.peerIp,
                        BgpConst.BGP_AFI_TYPE.AFI_IPV4,
                        BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST
                    ),
                    bgpPeer
                );
            } else if (family === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST) {
                const bgpPeer = new BgpPeer(
                    this,
                    0,
                    this.socket ? this.socket.localAddress : 'N/A',
                    this.bgpConfigData.localAs,
                    this.peerConfigData.peerIp,
                    this.peerConfigData.peerAs,
                    BgpConst.BGP_AFI_TYPE.AFI_IPV6,
                    BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST,
                    this.bgpConfigData.routerId
                );
                this.peerMap.set(
                    BgpPeer.makeKey(
                        0,
                        this.peerConfigData.peerIp,
                        BgpConst.BGP_AFI_TYPE.AFI_IPV6,
                        BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST
                    ),
                    bgpPeer
                );
            }
        });
    }

    changeSessionFsmState(sessionState) {
        // 更新peer状态
        this.peerMap.forEach(peer => {
            peer.changePeerState(sessionState);
        });

        // 更新状态
        this.sessState = sessionState;
    }

    changePeerState(peer, sessionState) {
        peer.changePeerState(sessionState);
    }

    recvMsg(data) {
        this.handleBgpPacket(data);
    }

    comparePeerConfig(localPeerConfigData, peerConfigData) {
        if (localPeerConfigData.peerIp !== peerConfigData.peerIp) {
            return true;
        }

        if (localPeerConfigData.peerAs !== peerConfigData.peerAs) {
            return true;
        }

        if (localPeerConfigData.holdTime !== peerConfigData.holdTime) {
            return true;
        }

        if (localPeerConfigData.openCap.length !== peerConfigData.openCap.length) {
            return true;
        }

        for (let i = 0; i < localPeerConfigData.openCap.length; i++) {
            if (localPeerConfigData.openCap[i] !== peerConfigData.openCap[i]) {
                return true;
            }
        }

        if (localPeerConfigData.addressFamily.length !== peerConfigData.addressFamily.length) {
            return true;
        }

        for (let i = 0; i < localPeerConfigData.addressFamily.length; i++) {
            if (localPeerConfigData.addressFamily[i] !== peerConfigData.addressFamily[i]) {
                return true;
            }
        }

        if (localPeerConfigData.role !== peerConfigData.role) {
            return true;
        }

        if (localPeerConfigData.openCapCustom.trim() !== peerConfigData.openCapCustom.trim()) {
            return true;
        }

        return false;
    }

    configChange(peerConfigData) {
        // 比较配置是否变化
        if (!this.comparePeerConfig(this.peerConfigData, peerConfigData)) {
            return false;
        }

        this.peerConfigData = peerConfigData;

        // 发送Notification报文
        this.sendNotification(BgpConst.BGP_ERROR_CODE.CONNECTION_REJECTED, BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.OTHER_CONFIGURATION_CHANGE);

        this.socket.destroy();
        this.socket = null;

        // 清空peer
        this.peerMap.clear();

        return true;
    }

    tcpConnectSuccess(socket) {
        this.socket = socket;

        // 更新peer的localIp
        this.peerMap.forEach(peer => {
            peer.localIp = this.socket ? this.socket.localAddress : 'N/A';
        });

        this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.CONNECT);
        // 连接建立成功之后就发送open报文
        this.sendOpenMsg();
        this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.OPEN_SENT);
    }

    static makeKey(vrfIndex, peerIp) {
        return `${vrfIndex}|${peerIp}`;
    }

    static parseKey(key) {
        const [vrfIndex, peerIp] = key.split('|');
        return { vrfIndex: parseInt(vrfIndex), peerIp };
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

    sendOpenMsg() {
        const buf = this.buildOpenMsg();
        this.socket.write(buf);
        const parsedPacket = parseBgpPacket(buf);
        this.logger.info(`send open msg ${getBgpPacketSummary(parsedPacket)}`);
    }

    handleNotification() {
        this.peerMap.forEach(peer => {
            peer.handleNotification();
        });
    }

    handleBgpPacket(buffer) {
        // 将新接收的数据追加到缓冲区
        this.packetBuffer = Buffer.concat([this.packetBuffer, buffer]);

        // 循环处理缓冲区中的完整报文
        while (this.packetBuffer.length >= BgpConst.BGP_HEAD_LEN) {
            const header = this.parseBgpHeader(this.packetBuffer);

            // 如果缓冲区中的数据不足以构成一个完整的报文，等待更多数据
            if (this.packetBuffer.length < header.length) {
                break;
            }

            // 提取完整的报文
            const packet = this.packetBuffer.subarray(0, header.length);
            const parsedPacket = parseBgpPacket(packet);

            if (header.type === BgpConst.BGP_PACKET_TYPE.OPEN) {
                this.logger.info(`recv open message ${JSON.stringify(parsedPacket)}`);
                this.logger.info(`recv open message ${getBgpPacketSummary(parsedPacket)}`);
                const localAddressFamily = [];
                this.peerConfigData.addressFamily.forEach(family => {
                    localAddressFamily.push(family);
                });
                const remoteAddressFamily = [];
                parsedPacket.capabilities.forEach(cap => {
                    if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS) {
                        const addrFamilyType = getAddrFamilyType(cap.afi, cap.safi);
                        remoteAddressFamily.push(addrFamilyType);
                    }
                });

                // 如果本地没使能的地址族，而远端使能了，更新该peer状态为NO_NEG
                localAddressFamily.forEach(family => {
                    if (!remoteAddressFamily.includes(family)) {
                        const { afi, safi } = getAfiAndSafi(family);
                        const peer = this.peerMap.get(BgpPeer.makeKey(0, this.peerConfigData.peerIp, afi, safi));
                        this.changePeerState(peer, BgpConst.BGP_PEER_STATE.NO_NEG);
                    }
                });
                this.sendKeepAliveMsg();
                this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.OPEN_CONFIRM);
            } else if (header.type === BgpConst.BGP_PACKET_TYPE.KEEPALIVE) {
                if (this.sessState !== BgpConst.BGP_PEER_STATE.ESTABLISHED) {
                    this.logger.info(`recv keepalive message ${getBgpPacketSummary(parsedPacket)}`);
                }
                this.sendKeepAliveMsg();
                if (this.sessState !== BgpConst.BGP_PEER_STATE.ESTABLISHED) {
                    this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.ESTABLISHED);
                    if (this.sendRouteV4 != null) {
                        this.sendRoute(null, this.sendRouteV4);
                    }
                    if (this.sendRouteV6 != null) {
                        this.sendRoute(null, this.sendRouteV6);
                    }
                }
            } else if (header.type === BgpConst.BGP_PACKET_TYPE.NOTIFICATION) {
                this.logger.info(`recv notification message ${getBgpPacketSummary(parsedPacket)}`);
                this.handleNotification();
                if (this.socket) {
                    this.socket.destroy();
                    this.socket = null;
                }
            } else if (header.type === BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH) {
                this.logger.info(`recv route-refresh message ${getBgpPacketSummary(parsedPacket)}`);
                if (this.sendRouteV4 != null) {
                    this.sendRoute(null, this.sendRouteV4);
                }
                if (this.sendRouteV6 != null) {
                    this.sendRoute(null, this.sendRouteV6);
                }
            } else if (header.type === BgpConst.BGP_PACKET_TYPE.UPDATE) {
                this.logger.info(`recv update message ${getBgpPacketSummary(parsedPacket)}`);
            }

            // 从缓冲区中移除已处理的报文
            this.packetBuffer = this.packetBuffer.subarray(header.length);
        }
    }

    processCustomPkt(customPkt) {
        // Remove all spaces and newlines
        const cleanHex = customPkt.replace(/\s+/g, '');
        // Convert 0xff format to pure hex string
        const pureHex = cleanHex.replace(/0x/g, '');
        // Convert hex string to buffer
        const buffer = Buffer.from(pureHex, 'hex');
        return buffer;
    }

    buildBgpCapability(optType, optLength, capType, capLength, capInfo) {
        const capability = [];
        capability.push(optType); // 可选参数类型
        capability.push(optLength); // 可选参数长度
        capability.push(capType); // 能力代码
        capability.push(capLength); // 能力长度
        capability.push(...capInfo); // 能力信息
        return capability;
    }

    buildOpenMessageOptionalParams() {
        const optParams = [];

        if (this.peerConfigData.openCap && this.peerConfigData.openCap.length > 0) {
            this.peerConfigData.openCap.forEach(cap => {
                const capType = BgpConst.BGP_OPEN_CAP_MAP.get(cap);
                if (cap === BgpConst.BGP_CAPABILITY_UI.ADDR_FAMILY) {
                    this.peerConfigData.addressFamily.forEach(addrFamily => {
                        if (addrFamily === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST) {
                            optParams.push(
                                ...this.buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                                    ...writeUInt16(BgpConst.BGP_AFI_TYPE.AFI_IPV4),
                                    ...writeUInt16(BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST)
                                ])
                            );
                        } else if (addrFamily === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST) {
                            optParams.push(
                                ...this.buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                                    ...writeUInt16(BgpConst.BGP_AFI_TYPE.AFI_IPV6),
                                    ...writeUInt16(BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST)
                                ])
                            );
                        }
                    });
                } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROUTE_REFRESH) {
                    optParams.push(
                        ...this.buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x02, capType, 0x00, [])
                    );
                } else if (cap === BgpConst.BGP_CAPABILITY_UI.AS4) {
                    optParams.push(
                        ...this.buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                            ...writeUInt32(this.bgpConfigData.localAs)
                        ])
                    );
                } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROLE) {
                    optParams.push(
                        ...this.buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x03, capType, 0x01, [
                            BgpConst.BGP_ROLE_VALUE_MAP.get(this.peerConfigData.role)
                        ])
                    );
                }
            });
        }

        if (this.peerConfigData.openCapCustom && this.peerConfigData.openCapCustom.trim() !== '') {
            try {
                const customCapBuffer = this.processCustomPkt(this.peerConfigData.openCapCustom);
                optParams.push(...customCapBuffer);
            } catch (error) {
                this.logger.error(`Error processing custom capability: ${error.message}`);
            }
        }

        return optParams;
    }

    buildBgpMessageHeader(totalLength, type) {
        const header = Buffer.alloc(BgpConst.BGP_HEAD_LEN);
        header.fill(0xff, 0, BgpConst.BGP_MARKER_LEN);
        header.writeUInt16BE(totalLength, BgpConst.BGP_MARKER_LEN);
        header.writeUInt8(type, BgpConst.BGP_MARKER_LEN + 2);
        return header;
    }

    buildOpenMsg() {
        const openHeadMsg = [];
        // 版本号
        openHeadMsg.push(BgpConst.BGP_VERSION);
        // 本地AS号
        openHeadMsg.push(...writeUInt16(this.bgpConfigData.localAs));
        // holdTime
        openHeadMsg.push(...writeUInt16(this.peerConfigData.holdTime));
        // routerID
        openHeadMsg.push(...ipToBytes(this.bgpConfigData.routerId));

        const openHeadMsgBuf = Buffer.alloc(openHeadMsg.length);
        openHeadMsgBuf.set(openHeadMsg, 0);

        // 构建可选参数
        const optParams = this.buildOpenMessageOptionalParams();
        const optParamsBuf = Buffer.alloc(optParams.length + 1);
        optParamsBuf.writeUInt8(optParams.length, 0);
        optParamsBuf.set(optParams, 1);

        const header = this.buildBgpMessageHeader(
            BgpConst.BGP_HEAD_LEN + openHeadMsgBuf.length + optParamsBuf.length,
            BgpConst.BGP_PACKET_TYPE.OPEN
        );
        const buffer = Buffer.concat([header, openHeadMsgBuf, optParamsBuf]);

        return buffer;
    }

    buildNotificationMsg(errorCode, errorSubcode) {
        const buffer = Buffer.alloc(BgpConst.BGP_HEAD_LEN + 2);

        // 填充 Marker（16 字节 0xff）
        buffer.fill(0xff, 0, BgpConst.BGP_MARKER_LEN);
        // Length (2 bytes)
        buffer.writeUInt16BE(BgpConst.BGP_HEAD_LEN + 2, BgpConst.BGP_MARKER_LEN);
        // Type (1 byte)
        buffer.writeUInt8(BgpConst.BGP_PACKET_TYPE.NOTIFICATION, BgpConst.BGP_MARKER_LEN + 2);
        // Error Code (1 byte)
        buffer.writeUInt8(errorCode, BgpConst.BGP_MARKER_LEN + 3);
        // Error Subcode (1 byte)
        buffer.writeUInt8(errorSubcode, BgpConst.BGP_MARKER_LEN + 4);

        return buffer;
    }

    buildKeepAliveMsg() {
        const buffer = Buffer.alloc(BgpConst.BGP_HEAD_LEN);

        // 填充 Marker（16 字节 0xff）
        buffer.fill(0xff, 0, BgpConst.BGP_MARKER_LEN);
        // Length (2 bytes)
        buffer.writeUInt16BE(BgpConst.BGP_HEAD_LEN, BgpConst.BGP_MARKER_LEN);
        // Type (1 byte)
        buffer.writeUInt8(BgpConst.BGP_PACKET_TYPE.KEEPALIVE, BgpConst.BGP_MARKER_LEN + 2);

        return buffer;
    }

    sendKeepAliveMsg() {
        const buf = this.buildKeepAliveMsg();
        this.socket.write(buf);
        if (this.sessState !== BgpConst.BGP_PEER_STATE.ESTABLISHED) {
            const parsedPacket = parseBgpPacket(buf);
            this.logger.info(`send keepalive msg ${getBgpPacketSummary(parsedPacket)}`);
        }
    }

    sendNotification(errorCode, errorSubcode) {
        const buffer = this.buildNotificationMsg(errorCode, errorSubcode);
        this.socket.write(buffer);
    }
}

module.exports = BgpSession;
