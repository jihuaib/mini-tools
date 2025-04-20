const { parentPort, threadId } = require('worker_threads');
const net = require('net');
const BgpConst = require('../const/bgpConst');
const { genRouteIps, writeUInt16, writeUInt32, ipToBytes } = require('../utils/ipUtils');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const { parseBgpPacket, getBgpSummary } = require('../utils/bgpPacketParser');
const log = require('electron-log');
const { BGP_OPERATIONS } = require('../const/bgpOpConst');

let bgpState = BgpConst.BGP_STATE.IDLE;
let bgpData = null;
let server = null;
let bgpSocket = null;

function changeBgpFsmState(_bgpState) {
    log.info(`[Thread ${threadId}] bgp fsm state ${bgpState} -> ${_bgpState}`);

    parentPort.postMessage(
        successResponse({
            op: BGP_OPERATIONS.PEER_STATE,
            state: `${_bgpState}`
        })
    );
    bgpState = _bgpState;
}

function parseBgpHeader(buffer) {
    if (buffer.length < BgpConst.BGP_HEAD_LEN) {
        return null;
    }

    const marker = buffer.subarray(0, 16).toString('hex');
    const length = buffer.readUInt16BE(16);
    const type = buffer.readUInt8(18);

    return { marker, length, type };
}

function handleBgpPacket(buffer) {
    // 可能多个报文
    let packet = buffer;

    while (packet.length > 0) {
        const header = parseBgpHeader(packet);
        const spiltBuffer = packet.subarray(0, header.length); // 剩余报文体
        const parsedPacket = parseBgpPacket(spiltBuffer);

        if (header.type == BgpConst.BGP_PACKET_TYPE.OPEN) {
            log.info(`[BGP Worker ${threadId}] recv open message`);
            sendKeepAliveMsg();
            changeBgpFsmState(BgpConst.BGP_STATE.OPEN_CONFIRM);
        } else if (header.type == BgpConst.BGP_PACKET_TYPE.KEEPALIVE) {
            if (bgpState != BgpConst.BGP_STATE.ESTABLISHED) {
                log.info(`[BGP Worker ${threadId}] recv keepalive message`);
            }
            sendKeepAliveMsg();
            if (bgpState != BgpConst.BGP_STATE.ESTABLISHED) {
                changeBgpFsmState(BgpConst.BGP_STATE.ESTABLISHED);
            }
        } else if (header.type == BgpConst.BGP_PACKET_TYPE.NOTIFICATION) {
            log.info(`[BGP Worker ${threadId}] recv notification message`);
            changeBgpFsmState(BgpConst.BGP_STATE.IDLE);
            if (bgpSocket) {
                bgpSocket.destroy();
                bgpSocket = null;
            }
        } else if (header.type == BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH) {
            log.info(`[BGP Worker ${threadId}] recv route-refresh message`);
        } else if (header.type == BgpConst.BGP_PACKET_TYPE.UPDATE) {
            log.info(`[BGP Worker ${threadId}] recv update message`);
        }

        packet = packet.subarray(header.length);
    }
}

function processCustomPkt(customPkt) {
    // Remove all spaces and newlines
    const cleanHex = customPkt.replace(/\s+/g, '');
    // Convert 0xff format to pure hex string
    const pureHex = cleanHex.replace(/0x/g, '');
    // Convert hex string to buffer
    const buffer = Buffer.from(pureHex, 'hex');
    return buffer;
}

function buildBgpCapability(optType, optLength, capType, capLength, capInfo) {
    const capability = [];
    capability.push(optType); // 可选参数类型
    capability.push(optLength); // 可选参数长度
    capability.push(capType); // 能力代码
    capability.push(capLength); // 能力长度
    capability.push(...capInfo); // 能力信息
    return capability;
}

function buildOpenMessageOptionalParams() {
    const optParams = [];

    if (bgpData.openCap && bgpData.openCap.length > 0) {
        bgpData.openCap.forEach(cap => {
            const capType = BgpConst.BGP_OPEN_CAP_MAP.get(cap);
            if (cap === BgpConst.BGP_CAPABILITY_UI.ADDR_FAMILY) {
                bgpData.addressFamily.forEach(addr => {
                    if (addr === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
                        optParams.push(
                            ...buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                                ...writeUInt16(BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4),
                                ...writeUInt16(BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST)
                            ])
                        );
                    } else if (addr === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
                        optParams.push(
                            ...buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                                ...writeUInt16(BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6),
                                ...writeUInt16(BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST)
                            ])
                        );
                    }
                });
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROUTE_REFRESH) {
                optParams.push(...buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x02, capType, 0x00, []));
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.AS4) {
                optParams.push(
                    ...buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                        ...writeUInt32(bgpData.localAs)
                    ])
                );
            } else if (cap === BgpConst.BGP_CAPABILITY_UI.ROLE) {
                optParams.push(
                    ...buildBgpCapability(BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x03, capType, 0x01, [
                        BgpConst.BGP_ROLE_VALUE_MAP.get(bgpData.role)
                    ])
                );
            }
        });
    }

    if (bgpData.openCapCustom && bgpData.openCapCustom.trim() !== '') {
        try {
            const customCapBuffer = processCustomPkt(bgpData.openCapCustom);
            optParams.push(...customCapBuffer);
        } catch (error) {
            log.error(`[Thread ${threadId}] Error processing custom capability: ${error.message}`);
        }
    }

    return optParams;
}

function buildBgpMessageHeader(totalLength, type) {
    const header = Buffer.alloc(BgpConst.BGP_HEAD_LEN);
    header.fill(0xff, 0, BgpConst.BGP_MARKER_LEN);
    header.writeUInt16BE(totalLength, BgpConst.BGP_MARKER_LEN);
    header.writeUInt8(type, BgpConst.BGP_MARKER_LEN + 2);
    return header;
}

function buildOpenMsg() {
    const openHeadMsg = [];
    // 版本号
    openHeadMsg.push(BgpConst.BGP_VERSION);
    // 本地AS号
    openHeadMsg.push(...writeUInt16(bgpData.localAs));
    // holdTime
    openHeadMsg.push(...writeUInt16(bgpData.holdTime));
    // routerID
    openHeadMsg.push(...ipToBytes(bgpData.routerId));

    const openHeadMsgBuf = Buffer.alloc(openHeadMsg.length);
    openHeadMsgBuf.set(openHeadMsg, 0);

    // 构建可选参数
    const optParams = buildOpenMessageOptionalParams();
    const optParamsBuf = Buffer.alloc(optParams.length + 1);
    optParamsBuf.writeUInt8(optParams.length, 0);
    optParamsBuf.set(optParams, 1);

    const header = buildBgpMessageHeader(
        BgpConst.BGP_HEAD_LEN + openHeadMsgBuf.length + optParamsBuf.length,
        BgpConst.BGP_PACKET_TYPE.OPEN
    );
    const buffer = Buffer.concat([header, openHeadMsgBuf, optParamsBuf]);

    log.info(`[Thread ${threadId}] build open msg: ${buffer.toString('hex')}`);
    return buffer;
}

function buildKeepAliveMsg() {
    const buffer = Buffer.alloc(BgpConst.BGP_HEAD_LEN);

    // 填充 Marker（16 字节 0xff）
    buffer.fill(0xff, 0, BgpConst.BGP_MARKER_LEN);
    // Length (2 bytes)
    buffer.writeUInt16BE(BgpConst.BGP_HEAD_LEN, BgpConst.BGP_MARKER_LEN);
    // Type (1 byte)
    buffer.writeUInt8(BgpConst.BGP_PACKET_TYPE.KEEPALIVE, BgpConst.BGP_MARKER_LEN + 2);

    return buffer;
}

function sendKeepAliveMsg() {
    const buf = buildKeepAliveMsg();
    bgpSocket.write(buf);
    if (bgpState != BgpConst.BGP_STATE.ESTABLISHED) {
        log.info(`[Thread ${threadId}] send keepalive msg`);
    }
}

function sendOpenMsg() {
    const buf = buildOpenMsg();
    bgpSocket.write(buf);
    log.info(`[Thread ${threadId}] send open msg`);
}

function stopBgp() {
    if (bgpSocket) {
        bgpSocket.destroy();
    }

    if (server) {
        server.close(() => {
            log.info(`[Thread ${threadId}] BGP server stopped`);
        });
    }

    bgpSocket = null;
    server = null;

    changeBgpFsmState(BgpConst.BGP_STATE.IDLE);

    bgpData = null;

    log.info(`[Thread ${threadId}] BGP stopped successfully`);

    parentPort.postMessage(
        successResponse({
            op: BGP_OPERATIONS.STOP_BGP,
            status: 'success',
            msg: 'bgp协议停止成功'
        })
    );
}

function startTcpServer() {
    server = net.createServer(socket => {
        const clientAddress = socket.remoteAddress;
        const clientPort = socket.remotePort;

        log.info(`[Thread ${threadId}] Client connected from ${clientAddress}:${clientPort}`);

        bgpSocket = socket;

        changeBgpFsmState(BgpConst.BGP_STATE.CONNECT);
        // 连接建立成功之后就发送open报文
        sendOpenMsg();
        changeBgpFsmState(BgpConst.BGP_STATE.OPEN_SENT);

        // 当接收到数据时处理数据
        bgpSocket.on('data', data => {
            handleBgpPacket(data);
        });

        bgpSocket.on('end', () => {
            log.info(`[Thread ${threadId}] Client ${clientAddress}:${clientPort} end`);
        });

        bgpSocket.on('close', () => {
            log.info(`[Thread ${threadId}] Client ${clientAddress}:${clientPort} close`);
        });

        bgpSocket.on('error', err => {
            log.error(`[Thread ${threadId}] TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
        });
    });

    // 启动服务器并监听端口
    server.listen(BgpConst.BGP_DEFAULT_PORT, bgpData.localIp, () => {
        log.info(
            `[Thread ${threadId}] TCP Server listening on port ${BgpConst.BGP_DEFAULT_PORT} at ${bgpData.localIp}`
        );
    });

    parentPort.postMessage(
        successResponse({
            op: BGP_OPERATIONS.PUSH_MSG,
            status: 'success',
            msg: 'bgp协议启动成功'
        })
    );
}

function buildPathAttribute(type, flags, value) {
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

function buildOriginAttribute() {
    return buildPathAttribute(
        BgpConst.BGP_PATH_ATTR.ORIGIN,
        BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
        [0x00] // IGP
    );
}

function buildAsPathAttribute(localAs) {
    return buildPathAttribute(
        BgpConst.BGP_PATH_ATTR.AS_PATH,
        BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
        [0x02, 0x01, ...writeUInt32(localAs)] // AS_SEQUENCE
    );
}

function buildMedAttribute() {
    return buildPathAttribute(BgpConst.BGP_PATH_ATTR.MED, BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL, writeUInt32(0));
}

function buildMpReachNlriAttribute(route, localIp) {
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
    attr.push(...prefixBytes.subarray(0, prefixLength));

    // 更新长度
    const length = attr.length - lengthPos - 2;
    const lengthBuf = Buffer.alloc(2);
    lengthBuf.writeUInt16BE(length, 0);
    attr[lengthPos] = lengthBuf[0];
    attr[lengthPos + 1] = lengthBuf[1];

    return attr;
}

function buildMpUnreachNlriAttribute(route) {
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
    attr.push(...prefixBytes.subarray(0, prefixLength));

    // 更新长度
    const length = attr.length - lengthPos - 2;
    const lengthBuf = Buffer.alloc(2);
    lengthBuf.writeUInt16BE(length, 0);
    attr[lengthPos] = lengthBuf[0];
    attr[lengthPos + 1] = lengthBuf[1];

    return attr;
}

function buildUpdateMsgIpv6(route, customAttr) {
    try {
        // 构建路径属性
        const pathAttr = [
            ...buildOriginAttribute(),
            ...buildAsPathAttribute(bgpData.localAs),
            ...buildMedAttribute(),
            ...buildMpReachNlriAttribute(route, bgpData.localIp)
        ];

        // 添加自定义属性
        if (customAttr?.trim()) {
            try {
                const customPathAttr = processCustomPkt(customAttr);
                pathAttr.push(...customPathAttr);
            } catch (error) {
                log.error(`[Thread ${threadId}] Error processing custom path attribute: ${error.message}`);
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
        const bufHeader = buildBgpMessageHeader(
            BgpConst.BGP_HEAD_LEN + pathAttrBuf.length + withdrawnRoutesBuf.length,
            BgpConst.BGP_PACKET_TYPE.UPDATE
        );

        return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);
    } catch (error) {
        log.error(`[Thread ${threadId}] Error building IPv6 UPDATE message: ${error.message}`);
    }
}

function buildUpdateMsgIpv4(route, customAttr) {
    try {
        // 构建路径属性
        const pathAttr = [
            ...buildOriginAttribute(),
            ...buildAsPathAttribute(bgpData.localAs),
            ...buildPathAttribute(
                BgpConst.BGP_PATH_ATTR.NEXT_HOP,
                BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                ipToBytes(bgpData.localIp)
            ),
            ...buildMedAttribute()
        ];

        // 添加自定义属性
        if (customAttr?.trim()) {
            try {
                const customPathAttr = processCustomPkt(customAttr);
                pathAttr.push(...customPathAttr);
            } catch (error) {
                log.error(`[Thread ${threadId}] Error processing custom path attribute: ${error.message}`);
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
        nlri.push(...prefixBytes.subarray(0, prefixLength));

        const nlriBuf = Buffer.alloc(nlri.length);
        nlriBuf.set(nlri);

        // 构建撤销路由缓冲区
        const withdrawnRoutesBuf = Buffer.alloc(2);
        withdrawnRoutesBuf.writeUInt16BE(0, 0);

        // 构建消息头
        const bufHeader = buildBgpMessageHeader(
            BgpConst.BGP_HEAD_LEN + pathAttrBuf.length + nlriBuf.length + withdrawnRoutesBuf.length,
            BgpConst.BGP_PACKET_TYPE.UPDATE
        );

        return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf, nlriBuf]);
    } catch (error) {
        log.error(`[Thread ${threadId}] Error building IPv4 UPDATE message: ${error.message}`);
    }
}

function sendRoute(config) {
    const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
    if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
        routes.forEach(route => {
            const buf = buildUpdateMsgIpv4(route, config.customAttr);
            bgpSocket.write(buf);
        });
    } else if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
        routes.forEach(route => {
            const buf = buildUpdateMsgIpv6(route, config.customAttr);
            bgpSocket.write(buf);
        });
    }

    parentPort.postMessage(
        successResponse({
            op: BGP_OPERATIONS.PUSH_MSG,
            status: 'success',
            msg: '路由发送成功'
        })
    );
}

function buildWithdrawMsgIpv4(route) {
    try {
        const withdrawPrefixBufArray = [];
        const prefixBytes = ipToBytes(route.ip);
        const prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
        withdrawPrefixBufArray.push(route.mask);
        withdrawPrefixBufArray.push(...prefixBytes.subarray(0, prefixLength));

        const withdrawPrefixBuf = Buffer.alloc(withdrawPrefixBufArray.length + 2);
        withdrawPrefixBuf.writeUInt16BE(withdrawPrefixBufArray.length, 0);
        withdrawPrefixBuf.set(withdrawPrefixBufArray, 2);

        const pathAttrBuf = Buffer.alloc(2);
        pathAttrBuf.writeUInt16BE(0, 0);

        const bufHeader = buildBgpMessageHeader(
            BgpConst.BGP_HEAD_LEN + withdrawPrefixBuf.length + pathAttrBuf.length,
            BgpConst.BGP_PACKET_TYPE.UPDATE
        );

        return Buffer.concat([bufHeader, withdrawPrefixBuf, pathAttrBuf]);
    } catch (error) {
        log.error(`[Thread ${threadId}] Error building IPv4 WITHDRAW message: ${error.message}`);
    }
}

function buildWithdrawMsgIpv6(route) {
    try {
        // 构建路径属性
        const pathAttr = buildMpUnreachNlriAttribute(route);

        // 构建路径属性缓冲区
        const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
        pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
        pathAttrBuf.set(pathAttr, 2);

        // 构建撤销路由缓冲区
        const withdrawnRoutesBuf = Buffer.alloc(2);
        withdrawnRoutesBuf.writeUInt16BE(0, 0);

        // 构建消息头
        const bufHeader = buildBgpMessageHeader(
            BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length,
            BgpConst.BGP_PACKET_TYPE.UPDATE
        );

        return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);
    } catch (error) {
        log.error(`[Thread ${threadId}] Error building IPv6 WITHDRAW message: ${error.message}`);
    }
}

function withdrawRoute(config) {
    const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
    if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV4) {
        routes.forEach(route => {
            const buf = buildWithdrawMsgIpv4(route);
            bgpSocket.write(buf);
        });
    } else if (config.ipType === BgpConst.BGP_AFI_TYPE_UI.AFI_IPV6) {
        routes.forEach(route => {
            const buf = buildWithdrawMsgIpv6(route);
            bgpSocket.write(buf);
        });
    }

    parentPort.postMessage(
        successResponse({
            op: BGP_OPERATIONS.PUSH_MSG,
            status: 'success',
            msg: '路由撤销成功'
        })
    );
}

parentPort.on('message', msg => {
    log.log(`[Thread ${threadId}] recv msg: ${JSON.stringify(msg)}`);
    try {
        if (msg.op === BGP_OPERATIONS.START_BGP) {
            bgpData = msg.data;
            startTcpServer();
            log.info(`[Thread ${threadId}] bgp server start.`);
        } else if (msg.op === BGP_OPERATIONS.STOP_BGP) {
            stopBgp();
            log.info(`[Thread ${threadId}] bgp server stop.`);
        } else if (msg.op === BGP_OPERATIONS.SEND_ROUTE) {
            if (bgpState !== BgpConst.BGP_STATE.ESTABLISHED) {
                log.error(`[Thread ${threadId}] bgp server not in established state`);
                parentPort.postMessage(
                    successResponse({
                        op: BGP_OPERATIONS.PUSH_MSG,
                        status: 'error',
                        msg: 'bgp状态不在ESTABLISHED状态'
                    })
                );
                return;
            }
            sendRoute(msg.data);
        } else if (msg.op === BGP_OPERATIONS.WITHDRAW_ROUTE) {
            if (bgpState !== BgpConst.BGP_STATE.ESTABLISHED) {
                log.error(`[Thread ${threadId}] bgp server not in established state`);
                parentPort.postMessage(
                    successResponse({
                        op: BGP_OPERATIONS.PUSH_MSG,
                        status: 'error',
                        msg: 'bgp状态不在ESTABLISHED状态'
                    })
                );
                return;
            }
            withdrawRoute(msg.data);
        }
    } catch (err) {
        log.error(`[Thread ${threadId}] Error processing message: ${err}`);
        parentPort.postMessage(errorResponse(err.message));
    }
});
