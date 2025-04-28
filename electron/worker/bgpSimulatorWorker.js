const net = require('net');
const BgpConst = require('../const/bgpConst');
const { genRouteIps, writeUInt16, writeUInt32, ipToBytes } = require('../utils/ipUtils');
const { parseBgpPacket, getBgpPacketSummary } = require('../utils/bgpPacketParser');
const { BGP_REQ_TYPES } = require('../const/bgpReqConst');
const Logger = require('../log/logger');
const WorkerMessageHandler = require('./workerMessageHandler');
const { BGP_EVT_TYPES } = require('../const/BgpEvtConst');

class BgpSimulatorWorker {
    constructor() {
        this.bgpState = BgpConst.BGP_STATE.IDLE;
        this.server = null;
        this.bgpSocket = null;
        this.packetBuffer = Buffer.alloc(0); // 添加缓冲区用于存储不完整的报文

        this.logger = new Logger();

        this.bgpData = null; // bgp配置数据
        this.sendRouteV4 = null; // 待发送的ipv4路由
        this.sendRouteV6 = null; // 待发送的ipv6路由

        // 创建消息处理器
        this.messageHandler = new WorkerMessageHandler();
        // 初始化消息处理器
        this.messageHandler.init();
        // 注册消息处理器
        this.messageHandler.registerHandler(BGP_REQ_TYPES.START_BGP, this.startBgp.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.STOP_BGP, this.stopBgp.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.SEND_ROUTE, this.sendRoute.bind(this));
        this.messageHandler.registerHandler(BGP_REQ_TYPES.WITHDRAW_ROUTE, this.withdrawRoute.bind(this));
    }

    changeBgpFsmState(_bgpState) {
        this.logger.info(
            `bgp fsm state ${BgpConst.BGP_STATE_MAP.get(this.bgpState)} -> ${BgpConst.BGP_STATE_MAP.get(_bgpState)}`
        );

        // 发送状态变更事件
        this.messageHandler.sendEvent(BGP_EVT_TYPES.BGP_STATE_CHANGE, {
            state: `${BgpConst.BGP_STATE_MAP.get(_bgpState)}`
        });

        // 更新状态
        this.bgpState = _bgpState;
    }

    startTcpServer(messageId) {
        try {
            this.server = net.createServer(socket => {
                const clientAddress = socket.remoteAddress;
                const clientPort = socket.remotePort;

                this.logger.info(`Client connected from ${clientAddress}:${clientPort}`);

                this.bgpSocket = socket;

                this.changeBgpFsmState(BgpConst.BGP_STATE.CONNECT);
                // 连接建立成功之后就发送open报文
                this.sendOpenMsg();
                this.changeBgpFsmState(BgpConst.BGP_STATE.OPEN_SENT);

                // 当接收到数据时处理数据
                this.bgpSocket.on('data', data => {
                    this.handleBgpPacket(data);
                });

                this.bgpSocket.on('end', () => {
                    this.bgpSocket = null;
                    this.logger.info(`Client ${clientAddress}:${clientPort} end`);
                });

                this.bgpSocket.on('close', () => {
                    this.bgpSocket = null;
                    this.logger.info(`Client ${clientAddress}:${clientPort} close`);
                });

                this.bgpSocket.on('error', err => {
                    this.bgpSocket = null;
                    this.logger.error(`TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
                });
            });

            // 启动服务器并监听端口
            this.server.listen(BgpConst.BGP_DEFAULT_PORT, this.bgpData.localIp, () => {
                this.logger.info(
                    `TCP Server listening on port ${BgpConst.BGP_DEFAULT_PORT} at ${this.bgpData.localIp}`
                );
            });

            this.logger.info(`bgp协议启动成功`);
            this.messageHandler.sendSuccessResponse(messageId, null, 'bgp协议启动成功');
        } catch (err) {
            this.logger.error(`Error starting TCP server: ${err.message}`);
            this.messageHandler.sendErrorResponse(messageId, 'bgp协议启动失败');
        }
    }

    startBgp(messageId, data) {
        this.bgpData = data;
        this.startTcpServer(messageId);
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

            if (header.type == BgpConst.BGP_PACKET_TYPE.OPEN) {
                this.logger.info(`recv open message ${getBgpPacketSummary(parsedPacket)}`);
                this.sendKeepAliveMsg();
                this.changeBgpFsmState(BgpConst.BGP_STATE.OPEN_CONFIRM);
            } else if (header.type == BgpConst.BGP_PACKET_TYPE.KEEPALIVE) {
                if (this.bgpState != BgpConst.BGP_STATE.ESTABLISHED) {
                    this.logger.info(`recv keepalive message ${getBgpPacketSummary(parsedPacket)}`);
                }
                this.sendKeepAliveMsg();
                if (this.bgpState != BgpConst.BGP_STATE.ESTABLISHED) {
                    this.changeBgpFsmState(BgpConst.BGP_STATE.ESTABLISHED);
                    if (this.sendRouteV4 != null) {
                        this.sendRoute(null, this.sendRouteV4);
                    }
                    if (this.sendRouteV6 != null) {
                        this.sendRoute(null, this.sendRouteV6);
                    }
                }
            } else if (header.type == BgpConst.BGP_PACKET_TYPE.NOTIFICATION) {
                this.logger.info(`recv notification message ${getBgpPacketSummary(parsedPacket)}`);
                this.changeBgpFsmState(BgpConst.BGP_STATE.IDLE);
                if (this.bgpSocket) {
                    this.bgpSocket.destroy();
                    this.bgpSocket = null;
                }
            } else if (header.type == BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH) {
                this.logger.info(`recv route-refresh message ${getBgpPacketSummary(parsedPacket)}`);
                if (this.sendRouteV4 != null) {
                    this.sendRoute(null, this.sendRouteV4);
                }
                if (this.sendRouteV6 != null) {
                    this.sendRoute(null, this.sendRouteV6);
                }
            } else if (header.type == BgpConst.BGP_PACKET_TYPE.UPDATE) {
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

        if (this.bgpData.openCap && this.bgpData.openCap.length > 0) {
            this.bgpData.openCap.forEach(cap => {
                const capType = BgpConst.BGP_OPEN_CAP_MAP.get(cap);
                if (cap === BgpConst.BGP_CAPABILITY_UI.ADDR_FAMILY) {
                    this.bgpData.addressFamily.forEach(addr => {
                        if (addr === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
                            optParams.push(
                                ...this.buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                                    ...writeUInt16(BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4),
                                    ...writeUInt16(BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST)
                                ])
                            );
                        } else if (addr === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
                            optParams.push(
                                ...this.buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                                    ...writeUInt16(BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6),
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
                            ...writeUInt32(this.bgpData.localAs)
                        ])
                    );
                } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROLE) {
                    optParams.push(
                        ...this.buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x03, capType, 0x01, [
                            BgpConst.BGP_ROLE_VALUE_MAP.get(this.bgpData.role)
                        ])
                    );
                }
            });
        }

        if (this.bgpData.openCapCustom && this.bgpData.openCapCustom.trim() !== '') {
            try {
                const customCapBuffer = this.processCustomPkt(this.bgpData.openCapCustom);
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
        openHeadMsg.push(...writeUInt16(this.bgpData.localAs));
        // holdTime
        openHeadMsg.push(...writeUInt16(this.bgpData.holdTime));
        // routerID
        openHeadMsg.push(...ipToBytes(this.bgpData.routerId));

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
        this.bgpSocket.write(buf);
        if (this.bgpState != BgpConst.BGP_STATE.ESTABLISHED) {
            const parsedPacket = parseBgpPacket(buf);
            this.logger.info(`send keepalive msg ${getBgpPacketSummary(parsedPacket)}`);
        }
    }

    sendOpenMsg() {
        const buf = this.buildOpenMsg();
        this.bgpSocket.write(buf);
        const parsedPacket = parseBgpPacket(buf);
        this.logger.info(`send open msg ${getBgpPacketSummary(parsedPacket)}`);
    }

    stopBgp(messageId) {
        // Close the socket connection first
        if (this.bgpSocket) {
            this.bgpSocket.destroy();
            this.bgpSocket = null;
        }

        // Close the server synchronously
        if (this.server) {
            this.server.close();
            this.server = null;
        }

        // Reset BGP state
        this.changeBgpFsmState(BgpConst.BGP_STATE.IDLE);

        // Clear configuration data
        this.bgpData = null;

        this.logger.info(`BGP stopped successfully`);

        // Send response using messageHandler
        this.messageHandler.sendSuccessResponse(messageId, null, 'bgp协议停止成功');
    }

    buildPathAttribute(type, flags, value) {
        const attr = [];
        attr.push(flags);
        attr.push(type);
        if (value.length > 255) {
            attr.push(...writeUInt16(value.length));
        } else {
            attr.push(value.length);
        }
        attr.push(...value);
        return attr;
    }

    buildOriginAttribute() {
        return this.buildPathAttribute(
            BgpConst.BGP_PATH_ATTR.ORIGIN,
            BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
            [0x00] // IGP
        );
    }

    buildAsPathAttribute(localAs) {
        return this.buildPathAttribute(
            BgpConst.BGP_PATH_ATTR.AS_PATH,
            BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
            [0x02, 0x01, ...writeUInt32(localAs)] // AS_SEQUENCE
        );
    }

    buildMedAttribute() {
        return this.buildPathAttribute(
            BgpConst.BGP_PATH_ATTR.MED,
            BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL,
            writeUInt32(0)
        );
    }

    buildMpReachNlriAttribute(routes, routeIndex, msgLen) {
        const attr = [];
        attr.push(BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL | BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH);
        attr.push(BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI);
        msgLen += 2;

        // 记录长度位置，稍后更新
        const lengthPos = attr.length;
        attr.push(0x00, 0x00); // 占位长度
        msgLen += 2;

        // AFI and SAFI
        attr.push(...writeUInt16(0x02)); // IPv6
        attr.push(0x01); // Unicast
        msgLen += 3;

        // Next Hop
        const nextHopBytes = ipToBytes(`::ffff:${this.bgpData.localIp}`);
        attr.push(nextHopBytes.length);
        attr.push(...nextHopBytes);
        msgLen += 1 + nextHopBytes.length;

        // Reserved
        attr.push(0x00);
        msgLen += 1;

        // NLRI
        let route = routes[routeIndex];
        let prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
        let nlriLen = 1 + prefixLength;
        while (msgLen + nlriLen < BgpConst.BGP_MAX_PKT_SIZE && routeIndex < routes.length) {
            attr.push(route.mask); // 前缀长度（单位bit）
            const prefixBytes = ipToBytes(route.ip);
            attr.push(...prefixBytes.slice(0, prefixLength));

            routeIndex++;
            msgLen += nlriLen;
            if (routeIndex < routes.length) {
                route = routes[routeIndex];
                prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
                nlriLen = 1 + prefixLength;
            } else {
                break;
            }
        }

        // 更新长度
        const length = attr.length - lengthPos - 2;
        const lengthBuf = Buffer.alloc(2);
        lengthBuf.writeUInt16BE(length, 0);
        attr[lengthPos] = lengthBuf[0];
        attr[lengthPos + 1] = lengthBuf[1];

        return { index: routeIndex, attr: attr };
    }

    buildMpUnreachNlriAttribute(routes, msgLen, routeIndex) {
        const attr = [];
        attr.push(BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL | BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH);
        attr.push(BgpConst.BGP_PATH_ATTR.MP_UNREACH_NLRI);
        msgLen += 2;

        // 记录长度位置，稍后更新
        const lengthPos = attr.length;
        attr.push(0x00, 0x00); // 占位长度
        msgLen += 2;

        // AFI and SAFI
        attr.push(...writeUInt16(0x02)); // IPv6
        attr.push(0x01); // Unicast
        msgLen += 3;

        // NLRI
        let route = routes[routeIndex];
        let prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
        let nlriLen = 1 + prefixLength;
        while (msgLen + nlriLen < BgpConst.BGP_MAX_PKT_SIZE && routeIndex < routes.length) {
            attr.push(route.mask); // 前缀长度（单位bit）
            const prefixBytes = ipToBytes(route.ip);
            attr.push(...prefixBytes.slice(0, prefixLength));

            routeIndex++;
            msgLen += nlriLen;
            if (routeIndex < routes.length) {
                route = routes[routeIndex];
                prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
                nlriLen = 1 + prefixLength;
            } else {
                break;
            }
        }

        // 更新长度
        const length = attr.length - lengthPos - 2;
        const lengthBuf = Buffer.alloc(2);
        lengthBuf.writeUInt16BE(length, 0);
        attr[lengthPos] = lengthBuf[0];
        attr[lengthPos + 1] = lengthBuf[1];

        return { index: routeIndex, attr: attr };
    }

    buildUpdateMsgIpv6(routes, routeIndex, customAttr) {
        try {
            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            // 构建路径属性
            const pathAttr = [
                ...this.buildOriginAttribute(),
                ...this.buildAsPathAttribute(this.bgpData.localAs),
                ...this.buildMedAttribute()
            ];

            // 添加自定义属性
            if (customAttr?.trim()) {
                try {
                    const customPathAttr = this.processCustomPkt(customAttr);
                    pathAttr.push(...customPathAttr);
                } catch (error) {
                    this.logger.error(`Error processing custom path attribute: ${error.message}`);
                    return {
                        status: false,
                        index: routeIndex,
                        buffer: null
                    };
                }
            }

            const msgLen = BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + 2 + pathAttr.length; // 固定长度

            const mpNlriAttrResult = this.buildMpReachNlriAttribute(routes, routeIndex, msgLen);
            pathAttr.push(...mpNlriAttrResult.attr);

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
            pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
            pathAttrBuf.set(pathAttr, 2);

            // 构建消息头
            const bufHeader = this.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            const buffer = Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);
            return {
                status: true,
                index: mpNlriAttrResult.index,
                buffer: buffer
            };
        } catch (error) {
            this.logger.error(`Error building IPv6 UPDATE message: ${error.message}`);
            return {
                status: false,
                index: routeIndex,
                buffer: null
            };
        }
    }

    buildUpdateMsgIpv4(routes, routeIndex, customAttr) {
        try {
            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            // 构建路径属性
            const pathAttr = [
                ...this.buildOriginAttribute(),
                ...this.buildAsPathAttribute(this.bgpData.localAs),
                ...this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.NEXT_HOP,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    ipToBytes(this.bgpData.localIp)
                ),
                ...this.buildMedAttribute()
            ];

            // 添加自定义属性
            if (customAttr?.trim()) {
                try {
                    const customPathAttr = this.processCustomPkt(customAttr);
                    pathAttr.push(...customPathAttr);
                } catch (error) {
                    this.logger.error(`Error processing custom path attribute: ${error.message}`);
                    return {
                        status: false,
                        index: routeIndex,
                        buffer: null
                    };
                }
            }

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
            pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
            pathAttrBuf.set(pathAttr, 2);

            // 构建NLRI
            const nlri = [];
            let msgLen = BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length;

            let route = routes[routeIndex];
            let prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
            let nlriLen = 1 + prefixLength;
            while (msgLen + nlriLen < BgpConst.BGP_MAX_PKT_SIZE && routeIndex < routes.length) {
                nlri.push(route.mask); // 前缀长度（单位bit）
                const prefixBytes = ipToBytes(route.ip);
                nlri.push(...prefixBytes.slice(0, prefixLength));

                routeIndex++;
                msgLen += nlriLen;
                if (routeIndex < routes.length) {
                    route = routes[routeIndex];
                    prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
                    nlriLen = 1 + prefixLength;
                } else {
                    break;
                }
            }

            const nlriBuf = Buffer.alloc(nlri.length);
            nlriBuf.set(nlri);

            // 构建消息头
            const bufHeader = this.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length + nlriBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            const buffer = Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf, nlriBuf]);
            return {
                status: true,
                index: routeIndex,
                buffer: buffer
            };
        } catch (error) {
            this.logger.error(`Error building IPv4 UPDATE message: ${error.message}`);
            return {
                status: false,
                index: routeIndex,
                buffer: null
            };
        }
    }

    buildWithdrawMsgIpv4(routes, routeIndex) {
        try {
            const pathAttrBuf = Buffer.alloc(2);
            pathAttrBuf.writeUInt16BE(0, 0);

            const withdrawNlri = [];
            let msgLen = BgpConst.BGP_HEAD_LEN + pathAttrBuf.length + 2; // 固定长度

            let route = routes[routeIndex];
            let prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
            let nlriLen = 1 + prefixLength;
            while (msgLen + nlriLen < BgpConst.BGP_MAX_PKT_SIZE && routeIndex < routes.length) {
                withdrawNlri.push(route.mask); // 前缀长度（单位bit）
                const prefixBytes = ipToBytes(route.ip);
                withdrawNlri.push(...prefixBytes.slice(0, prefixLength));

                routeIndex++;
                msgLen += nlriLen;
                if (routeIndex < routes.length) {
                    route = routes[routeIndex];
                    prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
                    nlriLen = 1 + prefixLength;
                } else {
                    break;
                }
            }

            const withdrawNlriBuf = Buffer.alloc(withdrawNlri.length + 2);
            withdrawNlriBuf.writeUInt16BE(withdrawNlri.length, 0);
            withdrawNlriBuf.set(withdrawNlri, 2);

            const bufHeader = this.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawNlriBuf.length + pathAttrBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            const buffer = Buffer.concat([bufHeader, withdrawNlriBuf, pathAttrBuf]);
            return {
                status: true,
                index: routeIndex,
                buffer: buffer
            };
        } catch (error) {
            this.logger.error(`Error building IPv4 WITHDRAW message: ${error.message}`);
            return {
                status: false,
                index: routeIndex,
                buffer: null
            };
        }
    }

    buildWithdrawMsgIpv6(routes, routeIndex) {
        try {
            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            const msgLen = BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + 2; // 固定长度

            // 构建路径属性
            const mpUnReachAttrResult = this.buildMpUnreachNlriAttribute(routes, msgLen, routeIndex);

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(mpUnReachAttrResult.attr.length + 2);
            pathAttrBuf.writeUInt16BE(mpUnReachAttrResult.attr.length, 0);
            pathAttrBuf.set(mpUnReachAttrResult.attr, 2);

            // 构建消息头
            const bufHeader = this.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            const buffer = Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);

            return {
                status: true,
                index: mpUnReachAttrResult.index,
                buffer: buffer
            };
        } catch (error) {
            this.logger.error(`Error building IPv6 WITHDRAW message: ${error.message}`);
            return {
                status: false,
                index: routeIndex,
                buffer: null
            };
        }
    }

    sendRoute(messageId, config) {
        if (this.bgpState !== BgpConst.BGP_STATE.ESTABLISHED) {
            this.logger.error('bgp不在Established状态');
            if (messageId != null) {
                this.messageHandler.sendErrorResponse(messageId, 'bgp不在Established状态');
            }
            return;
        }

        const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
        if (routes.length == 0) {
            if (messageId != null) {
                this.messageHandler.sendSuccessResponse(messageId, null, '路由发送成功');
            }
            return;
        }

        if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
            this.sendRouteV4 = config;
        } else if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
            this.sendRouteV6 = config;
        }

        let routeIndex = 0;

        if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
            while (routeIndex < routes.length) {
                const result = this.buildUpdateMsgIpv4(routes, routeIndex, config.customAttr);
                if (result.status) {
                    this.bgpSocket.write(result.buffer);
                    const parsedPacket = parseBgpPacket(result.buffer);
                    this.logger.info(`send update msg ${getBgpPacketSummary(parsedPacket)}`);
                    routeIndex = result.index;
                } else {
                    break;
                }
            }
        } else if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
            while (routeIndex < routes.length) {
                const result = this.buildUpdateMsgIpv6(routes, routeIndex, config.customAttr);
                if (result.status) {
                    this.bgpSocket.write(result.buffer);
                    const parsedPacket = parseBgpPacket(result.buffer);
                    this.logger.info(`send update msg ${getBgpPacketSummary(parsedPacket)}`);
                    routeIndex = result.index;
                } else {
                    break;
                }
            }
        }
        if (messageId != null) {
            this.messageHandler.sendSuccessResponse(messageId, null, '路由发送成功');
        }
    }

    withdrawRoute(messageId, config) {
        if (this.bgpState !== BgpConst.BGP_STATE.ESTABLISHED) {
            this.logger.error('bgp不在Established状态');
            if (messageId != null) {
                this.messageHandler.sendErrorResponse(messageId, 'bgp不在Established状态');
            }
            return;
        }

        const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
        if (routes.length == 0) {
            if (messageId != null) {
                this.messageHandler.sendSuccessResponse(messageId, null, '路由撤销成功');
            }
            return;
        }

        if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
            this.sendRouteV4 = null;
        } else if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
            this.sendRouteV6 = null;
        }

        let routeIndex = 0;

        if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
            while (routeIndex < routes.length) {
                const result = this.buildWithdrawMsgIpv4(routes, routeIndex);
                if (result.status) {
                    this.bgpSocket.write(result.buffer);
                    const parsedPacket = parseBgpPacket(result.buffer);
                    this.logger.info(`send withdraw msg ${getBgpPacketSummary(parsedPacket)}`);
                    routeIndex = result.index;
                } else {
                    break;
                }
            }
        } else if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
            while (routeIndex < routes.length) {
                const result = this.buildWithdrawMsgIpv6(routes, routeIndex);
                if (result.status) {
                    this.bgpSocket.write(result.buffer);
                    const parsedPacket = parseBgpPacket(result.buffer);
                    this.logger.info(`send withdraw msg ${getBgpPacketSummary(parsedPacket)}`);
                    routeIndex = result.index;
                } else {
                    break;
                }
            }
        }
        if (messageId != null) {
            this.messageHandler.sendSuccessResponse(messageId, null, '路由撤销成功');
        }
    }
}

new BgpSimulatorWorker(); // 启动监听
