const net = require('net');
const BgpConst = require('../const/bgpConst');
const { genRouteIps, writeUInt16, writeUInt32, ipToBytes } = require('../utils/ipUtils');
const { parseBgpPacket, getBgpSummary } = require('../utils/bgpPacketParser');
const { BGP_REQ_TYPES } = require('../const/bgpReqConst');
const Logger = require('../log/logger');
const WorkerMessageHandler = require('./workerMessageHandler');
const { BGP_EVT_TYPES } = require('../const/BgpEvtConst');
class BgpSimulatorWorker {
    constructor() {
        this.bgpState = BgpConst.BGP_STATE.IDLE;
        this.bgpData = null;
        this.server = null;
        this.bgpSocket = null;

        this.logger = new Logger();

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
        // 可能多个报文
        let packet = buffer;

        while (packet.length > 0) {
            const header = this.parseBgpHeader(packet);
            const spiltBuffer = packet.subarray(0, header.length); // 剩余报文体
            const parsedPacket = parseBgpPacket(spiltBuffer);

            if (header.type == BgpConst.BGP_PACKET_TYPE.OPEN) {
                this.logger.info(`recv open message ${getBgpSummary(parsedPacket)}`);
                this.sendKeepAliveMsg();
                this.changeBgpFsmState(BgpConst.BGP_STATE.OPEN_CONFIRM);
            } else if (header.type == BgpConst.BGP_PACKET_TYPE.KEEPALIVE) {
                if (this.bgpState != BgpConst.BGP_STATE.ESTABLISHED) {
                    this.logger.info(`recv keepalive message ${getBgpSummary(parsedPacket)}`);
                }
                this.sendKeepAliveMsg();
                if (this.bgpState != BgpConst.BGP_STATE.ESTABLISHED) {
                    this.changeBgpFsmState(BgpConst.BGP_STATE.ESTABLISHED);
                }
            } else if (header.type == BgpConst.BGP_PACKET_TYPE.NOTIFICATION) {
                this.logger.info(`recv notification message ${getBgpSummary(parsedPacket)}`);
                this.changeBgpFsmState(BgpConst.BGP_STATE.IDLE);
                if (this.bgpSocket) {
                    this.bgpSocket.destroy();
                    this.bgpSocket = null;
                }
            } else if (header.type == BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH) {
                this.logger.info(`recv route-refresh message ${getBgpSummary(parsedPacket)}`);
            } else if (header.type == BgpConst.BGP_PACKET_TYPE.UPDATE) {
                this.logger.info(`recv update message ${getBgpSummary(parsedPacket)}`);
            }

            packet = packet.subarray(header.length);
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

        this.logger.info(`build open msg: ${buffer.toString('hex')}`);
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
            this.logger.info(`send keepalive msg`);
        }
    }

    sendOpenMsg() {
        const buf = this.buildOpenMsg();
        this.bgpSocket.write(buf);
        this.logger.info(`send open msg`);
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

    buildMpReachNlriAttribute(route, localIp) {
        const attr = [];
        attr.push(BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL | BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH);
        attr.push(BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI);

        // 记录长度位置，稍后更新
        const lengthPos = attr.length;
        attr.push(0x00, 0x00); // 占位长度

        // AFI and SAFI
        attr.push(...writeUInt16(0x02)); // IPv6
        attr.push(0x01); // Unicast

        // Next Hop
        const nextHopBytes = ipToBytes(`::ffff:${localIp}`);
        attr.push(nextHopBytes.length);
        attr.push(...nextHopBytes);

        // Reserved
        attr.push(0x00);

        // NLRI
        attr.push(route.mask);
        const prefixBytes = ipToBytes(route.ip);
        const prefixLength = Math.ceil(route.mask / 8);
        attr.push(...prefixBytes.slice(0, prefixLength));

        // 更新长度
        const length = attr.length - lengthPos - 2;
        const lengthBuf = Buffer.alloc(2);
        lengthBuf.writeUInt16BE(length, 0);
        attr[lengthPos] = lengthBuf[0];
        attr[lengthPos + 1] = lengthBuf[1];

        return attr;
    }

    buildMpUnreachNlriAttribute(route) {
        const attr = [];
        attr.push(BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL | BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH);
        attr.push(BgpConst.BGP_PATH_ATTR.MP_UNREACH_NLRI);

        // 记录长度位置，稍后更新
        const lengthPos = attr.length;
        attr.push(0x00, 0x00); // 占位长度

        // AFI and SAFI
        attr.push(...writeUInt16(0x02)); // IPv6
        attr.push(0x01); // Unicast

        // NLRI
        attr.push(route.mask);
        const prefixBytes = ipToBytes(route.ip);
        const prefixLength = Math.ceil(route.mask / 8);
        attr.push(...prefixBytes.slice(0, prefixLength));

        // 更新长度
        const length = attr.length - lengthPos - 2;
        const lengthBuf = Buffer.alloc(2);
        lengthBuf.writeUInt16BE(length, 0);
        attr[lengthPos] = lengthBuf[0];
        attr[lengthPos + 1] = lengthBuf[1];

        return attr;
    }

    buildUpdateMsgIpv6(route, customAttr) {
        try {
            // 构建路径属性
            const pathAttr = [
                ...this.buildOriginAttribute(),
                ...this.buildAsPathAttribute(this.bgpData.localAs),
                ...this.buildMedAttribute(),
                ...this.buildMpReachNlriAttribute(route, this.bgpData.localIp)
            ];

            // 添加自定义属性
            if (customAttr?.trim()) {
                try {
                    const customPathAttr = this.processCustomPkt(customAttr);
                    pathAttr.push(...customPathAttr);
                } catch (error) {
                    this.logger.error(`Error processing custom path attribute: ${error.message}`);
                }
            }

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
            pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
            pathAttrBuf.set(pathAttr, 2);

            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            // 构建消息头
            const bufHeader = this.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + pathAttrBuf.length + withdrawnRoutesBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);
        } catch (error) {
            this.logger.error(`Error building IPv6 UPDATE message: ${error.message}`);
        }
    }

    buildUpdateMsgIpv4(route, customAttr) {
        try {
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
                }
            }

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
            pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
            pathAttrBuf.set(pathAttr, 2);

            // 构建NLRI
            const nlri = [];
            nlri.push(route.mask); // 前缀长度（单位bit）
            const prefixBytes = ipToBytes(route.ip);
            const prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
            nlri.push(...prefixBytes.slice(0, prefixLength));

            const nlriBuf = Buffer.alloc(nlri.length);
            nlriBuf.set(nlri);

            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            // 构建消息头
            const bufHeader = this.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + pathAttrBuf.length + nlriBuf.length + withdrawnRoutesBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf, nlriBuf]);
        } catch (error) {
            this.logger.error(`Error building IPv4 UPDATE message: ${error.message}`);
        }
    }

    sendRoute(messageId, config) {
        if (this.bgpState !== BgpConst.BGP_STATE.ESTABLISHED) {
            this.logger.error('bgp不在Established状态');
            this.messageHandler.sendErrorResponse(messageId, 'bgp不在Established状态');
            return;
        }

        const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
        if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
            routes.forEach(route => {
                const buf = this.buildUpdateMsgIpv4(route, config.customAttr);
                this.bgpSocket.write(buf);
            });
        } else if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
            routes.forEach(route => {
                const buf = this.buildUpdateMsgIpv6(route, config.customAttr);
                this.bgpSocket.write(buf);
            });
        }

        this.messageHandler.sendSuccessResponse(messageId, null, '路由发送成功');
    }

    buildWithdrawMsgIpv4(route) {
        try {
            const withdrawPrefixBufArray = [];
            const prefixBytes = ipToBytes(route.ip);
            const prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
            withdrawPrefixBufArray.push(route.mask);
            withdrawPrefixBufArray.push(...prefixBytes.slice(0, prefixLength));

            const withdrawPrefixBuf = Buffer.alloc(withdrawPrefixBufArray.length + 2);
            withdrawPrefixBuf.writeUInt16BE(withdrawPrefixBufArray.length, 0);
            withdrawPrefixBuf.set(withdrawPrefixBufArray, 2);

            const pathAttrBuf = Buffer.alloc(2);
            pathAttrBuf.writeUInt16BE(0, 0);

            const bufHeader = this.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawPrefixBuf.length + pathAttrBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            return Buffer.concat([bufHeader, withdrawPrefixBuf, pathAttrBuf]);
        } catch (error) {
            this.logger.error(`Error building IPv4 WITHDRAW message: ${error.message}`);
        }
    }

    buildWithdrawMsgIpv6(route) {
        try {
            // 构建路径属性
            const pathAttr = this.buildMpUnreachNlriAttribute(route);

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
            pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
            pathAttrBuf.set(pathAttr, 2);

            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            // 构建消息头
            const bufHeader = this.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);
        } catch (error) {
            this.logger.error(`Error building IPv6 WITHDRAW message: ${error.message}`);
        }
    }

    withdrawRoute(messageId, config) {
        if (this.bgpState !== BgpConst.BGP_STATE.ESTABLISHED) {
            this.logger.error('bgp不在Established状态');
            this.messageHandler.sendErrorResponse(messageId, 'bgp不在Established状态');
            return;
        }

        const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
        if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
            routes.forEach(route => {
                const buf = this.buildWithdrawMsgIpv4(route);
                this.bgpSocket.write(buf);
            });
        } else if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
            routes.forEach(route => {
                const buf = this.buildWithdrawMsgIpv6(route);
                this.bgpSocket.write(buf);
            });
        }

        this.messageHandler.sendSuccessResponse(messageId, null, '路由撤销成功');
    }
}

new BgpSimulatorWorker(); // 启动监听
