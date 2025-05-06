const BgpConst = require('../const/bgpConst');
const { writeUInt16, writeUInt32, ipToBytes, getAddrFamilyType, getAfiAndSafi } = require('../utils/ipUtils');
const { parseBgpPacket, getBgpPacketSummary } = require('../utils/bgpPacketParser');
const Logger = require('../log/logger');
const CommonUtils = require('../utils/commonUtils');
const BgpInstance = require('./bgpInstance');

class BgpSession {
    constructor(vrfIndex, peerIp, instanceMap, messageHandler) {
        this.socket = null;
        this.packetBuffer = Buffer.alloc(0); // 添加缓冲区用于存储不完整的报文
        this.messageHandler = messageHandler;
        this.vrfIndex = vrfIndex;
        this.localIp = this.socket ? this.socket.localAddress : 'N/A';
        this.peerIp = peerIp;
        this.instanceMap = instanceMap;
        // 本地能力标志 - 使用整数存储位标志
        this.localCapFlags = 0;
        // 远端能力标志 - 使用整数存储位标志
        this.peerCapFlags = 0;
        // 本地使能的地址族
        this.localAddrFamilyFlags = 0;
        // 远端使能的地址族
        this.peerAddrFamilyFlags = 0;
        // 本地角色
        this.localRole = BgpConst.BGP_ROLE_TYPE.ROLE_INVALID;
        // 远端角色
        this.peerRole = BgpConst.BGP_ROLE_TYPE.ROLE_INVALID;
        // 远端open报文可选参数
        this.openCapCustom = '';

        this.logger = new Logger();
        this.sessState = BgpConst.BGP_PEER_STATE.IDLE;
    }

    // 更新session状态
    changeSessionFsmState(sessionState) {
        // 更新peer状态
        this.instanceMap.forEach((instance, _) => {
            this.changePeerState(instance, sessionState);
        });

        // 更新状态
        this.sessState = sessionState;
    }

    changePeerState(instance, sessionState) {
        instance.changePeerState(this.peerIp, sessionState);
    }

    recvMsg(data) {
        this.handleBgpPacket(data);
    }

    tcpConnectSuccess(socket) {
        this.socket = socket;

        // 更新peer的localIp
        this.localIp = this.socket ? this.socket.localAddress : 'N/A';

        this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.CONNECT);
        // 连接建立成功之后就发送open报文
        this.sendOpenMsg();
        this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.OPEN_SENT);
    }

    clearSession() {
        this.peerCapFlags = 0;
        this.peerAddrFamilyFlags = 0;
        this.peerRole = BgpConst.BGP_ROLE_TYPE.ROLE_INVALID;
        this.openCapCustom = '';
        this.localCapFlags = 0;
        this.localAddrFamilyFlags = 0;
        this.localRole = BgpConst.BGP_ROLE_TYPE.ROLE_INVALID;
    }

    resetSession() {
        if (this.socket) {
            this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.IDLE);
            this.sendNotification(
                BgpConst.BGP_ERROR_CODE.CONNECTION_REJECTED,
                BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.OTHER_CONFIGURATION_CHANGE
            );
            this.socket.destroy();
            this.socket = null;
        }
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
        this.logger.info(`${this.peerIp} send open msg ${getBgpPacketSummary(parsedPacket)}`);
    }

    resetPeer() {
        this.instanceMap.forEach((instance, _) => {
            instance.resetPeer(this.peerIp);
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
                this.logger.info(`${this.peerIp} recv open message ${JSON.stringify(parsedPacket)}`);
                this.logger.info(`${this.peerIp} recv open message ${getBgpPacketSummary(parsedPacket)}`);

                // 解析远端能力并设置位标志
                parsedPacket.capabilities.forEach(cap => {
                    if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS) {
                        const addrFamilyType = getAddrFamilyType(cap.afi, cap.safi);
                        this.peerCapFlags = CommonUtils.BIT_SET(
                            this.peerCapFlags,
                            BgpConst.BGP_CAP_FLAGS.MULTIPROTOCOL_EXTENSIONS
                        );
                        // 根据地址族类型设置对应的能力标志
                        if (addrFamilyType === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST) {
                            this.peerAddrFamilyFlags = CommonUtils.BIT_SET(
                                this.peerAddrFamilyFlags,
                                BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV4_UNICAST
                            );
                        } else if (addrFamilyType === BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST) {
                            this.peerAddrFamilyFlags = CommonUtils.BIT_SET(
                                this.peerAddrFamilyFlags,
                                BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV6_UNICAST
                            );
                        }
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.ROUTE_REFRESH) {
                        this.peerCapFlags = CommonUtils.BIT_SET(
                            this.peerCapFlags,
                            BgpConst.BGP_CAP_FLAGS.ROUTE_REFRESH
                        );
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.FOUR_OCTET_AS) {
                        this.peerCapFlags = CommonUtils.BIT_SET(
                            this.peerCapFlags,
                            BgpConst.BGP_CAP_FLAGS.FOUR_OCTET_AS
                        );
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.BGP_ROLE) {
                        this.peerCapFlags = CommonUtils.BIT_SET(this.peerCapFlags, BgpConst.BGP_CAP_FLAGS.BGP_ROLE);
                        this.peerRole = cap.role;
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.EXTENDED_NEXT_HOP_ENCODING) {
                        this.peerCapFlags = CommonUtils.BIT_SET(
                            this.peerCapFlags,
                            BgpConst.BGP_CAP_FLAGS.EXTENDED_NEXT_HOP_ENCODING
                        );
                    }
                });

                // 如果本地没使能的地址族，而远端使能了，更新该peer状态为NO_NEG
                if (
                    !CommonUtils.BIT_TEST(
                        this.peerAddrFamilyFlags,
                        BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV4_UNICAST
                    )
                ) {
                    const { afi, safi } = getAfiAndSafi(BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST);
                    const instance = this.instanceMap.get(BgpInstance.makeKey(0, afi, safi));
                    if (instance) {
                        this.changePeerState(instance, BgpConst.BGP_PEER_STATE.NO_NEG);
                    }
                }

                // 同样检查IPv6单播地址族
                if (
                    !CommonUtils.BIT_TEST(
                        this.peerAddrFamilyFlags,
                        BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV6_UNICAST
                    )
                ) {
                    const { afi, safi } = getAfiAndSafi(BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST);
                    const instance = this.instanceMap.get(BgpInstance.makeKey(0, afi, safi));
                    if (instance) {
                        this.changePeerState(instance, BgpConst.BGP_PEER_STATE.NO_NEG);
                    }
                }
                this.sendKeepAliveMsg();
                this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.OPEN_CONFIRM);
            } else if (header.type === BgpConst.BGP_PACKET_TYPE.KEEPALIVE) {
                if (this.sessState !== BgpConst.BGP_PEER_STATE.ESTABLISHED) {
                    this.logger.info(`${this.peerIp} recv keepalive message ${getBgpPacketSummary(parsedPacket)}`);
                }
                this.sendKeepAliveMsg();
                if (this.sessState !== BgpConst.BGP_PEER_STATE.ESTABLISHED) {
                    this.changeSessionFsmState(BgpConst.BGP_PEER_STATE.ESTABLISHED);

                    const sessionKey = BgpSession.makeKey(0, this.peerIp);
                    this.instanceMap.forEach((instance, _) => {
                        instance.peerMap.forEach((peer, _) => {
                            const peerSessionKey = BgpSession.makeKey(0, peer.session.peerIp);
                            if (peerSessionKey === sessionKey) {
                                peer.sendRoute();
                            }
                        });
                    });
                }
            } else if (header.type === BgpConst.BGP_PACKET_TYPE.NOTIFICATION) {
                this.logger.info(`${this.peerIp} recv notification message ${getBgpPacketSummary(parsedPacket)}`);
                this.resetPeer();
                if (this.socket) {
                    this.socket.destroy();
                    this.socket = null;
                }
            } else if (header.type === BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH) {
                this.logger.info(`${this.peerIp} recv route-refresh message ${getBgpPacketSummary(parsedPacket)}`);
                const instance = this.instanceMap.get(BgpInstance.makeKey(0, parsedPacket.afi, parsedPacket.safi));
                if (instance) {
                    instance.sendRoute();
                }
            } else if (header.type === BgpConst.BGP_PACKET_TYPE.UPDATE) {
                this.logger.info(`${this.peerIp} recv update message ${getBgpPacketSummary(parsedPacket)}`);
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

        if (CommonUtils.BIT_TEST(this.localCapFlags, BgpConst.BGP_CAP_FLAGS.MULTIPROTOCOL_EXTENSIONS)) {
            if (
                CommonUtils.BIT_TEST(
                    this.localAddrFamilyFlags,
                    BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV4_UNICAST
                )
            ) {
                optParams.push(
                    ...this.buildBgpCapability(
                        BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE,
                        0x06,
                        BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS,
                        0x04,
                        [
                            ...writeUInt16(BgpConst.BGP_AFI_TYPE.AFI_IPV4),
                            ...writeUInt16(BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST)
                        ]
                    )
                );
            }
            if (
                CommonUtils.BIT_TEST(
                    this.localAddrFamilyFlags,
                    BgpConst.BGP_MULTIPROTOCOL_EXTENSIONS_FLAGS.ADDR_FAMILY_IPV6_UNICAST
                )
            ) {
                optParams.push(
                    ...this.buildBgpCapability(
                        BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE,
                        0x06,
                        BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS,
                        0x04,
                        [
                            ...writeUInt16(BgpConst.BGP_AFI_TYPE.AFI_IPV6),
                            ...writeUInt16(BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST)
                        ]
                    )
                );
            }
        }

        if (CommonUtils.BIT_TEST(this.localCapFlags, BgpConst.BGP_CAP_FLAGS.ROUTE_REFRESH)) {
            optParams.push(
                ...this.buildBgpCapability(
                    BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE,
                    0x02,
                    BgpConst.BGP_OPEN_CAP_CODE.ROUTE_REFRESH,
                    0x00,
                    []
                )
            );
        }
        if (CommonUtils.BIT_TEST(this.localCapFlags, BgpConst.BGP_CAP_FLAGS.FOUR_OCTET_AS)) {
            optParams.push(
                ...this.buildBgpCapability(
                    BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE,
                    0x06,
                    BgpConst.BGP_OPEN_CAP_CODE.FOUR_OCTET_AS,
                    0x04,
                    [...writeUInt32(this.localAs)]
                )
            );
        }
        if (CommonUtils.BIT_TEST(this.localCapFlags, BgpConst.BGP_CAP_FLAGS.BGP_ROLE)) {
            optParams.push(
                ...this.buildBgpCapability(
                    BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE,
                    0x03,
                    BgpConst.BGP_OPEN_CAP_CODE.BGP_ROLE,
                    0x01,
                    [this.localRole]
                )
            );
        }

        // IPv4 Unicast 路由使用 IPv6 nexthop
        if (CommonUtils.BIT_TEST(this.localCapFlags, BgpConst.BGP_CAP_FLAGS.EXTENDED_NEXT_HOP_ENCODING)) {
            optParams.push(
                ...this.buildBgpCapability(
                    BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE,
                    0x08,
                    BgpConst.BGP_OPEN_CAP_CODE.EXTENDED_NEXT_HOP_ENCODING,
                    0x06,
                    [
                        ...writeUInt16(BgpConst.BGP_AFI_TYPE.AFI_IPV4),
                        ...writeUInt16(BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST),
                        ...writeUInt16(BgpConst.IP_TYPE.IPV6)
                    ]
                )
            );
        }

        if (this.openCapCustom && this.openCapCustom.trim() !== '') {
            try {
                const customCapBuffer = this.processCustomPkt(this.openCapCustom);
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
        openHeadMsg.push(...writeUInt16(this.localAs));
        // holdTime
        openHeadMsg.push(...writeUInt16(this.holdTime));
        // routerID
        openHeadMsg.push(...ipToBytes(this.routerId));

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
            this.logger.info(`${this.peerIp} send keepalive msg ${getBgpPacketSummary(parsedPacket)}`);
        }
    }

    sendNotification(errorCode, errorSubcode) {
        const buffer = this.buildNotificationMsg(errorCode, errorSubcode);
        this.socket.write(buffer);
        const parsedPacket = parseBgpPacket(buffer);
        this.logger.info(`${this.peerIp} send notification msg ${getBgpPacketSummary(parsedPacket)}`);
    }

    sendRoute(buffer) {
        this.socket.write(buffer);
        const parsedPacket = parseBgpPacket(buffer);
        this.logger.info(`${this.peerIp} send route msg ${getBgpPacketSummary(parsedPacket)}`);
    }

    withdrawRoute(buffer) {
        this.socket.write(buffer);
        const parsedPacket = parseBgpPacket(buffer);
        this.logger.info(`${this.peerIp} withdraw route msg ${getBgpPacketSummary(parsedPacket)}`);
    }
}

module.exports = BgpSession;
