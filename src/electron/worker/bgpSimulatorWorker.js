const { parentPort, threadId } = require('worker_threads');
const net = require('net');
const {
    BGP_DEFAULT_PORT,
    BGP_HEAD_LEN,
    BGP_STATE,
    BGP_PACKET_TYPE,
    BGP_CAPABILITY_UI,
    BGP_AFI_TYPE_UI,
    BGP_SAFI_TYPE,
    BGP_OPEN_CAP_MAP,
    BGP_ROLE_VALUE_MAP,
    BGP_VERSION,
    BGP_MARKER_LEN
} = require('../const/bgpConst');
const { writeUInt16, writeUInt32, ipToBytes } = require('../utils/bgpUtils');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const log = require('electron-log');
const { BGP_OPERATIONS } = require('../const/operations');
const { genRouteIps } = require('../utils/ipUtils');

let bgpState = BGP_STATE.IDLE;
let bgpData = null;
let server = null;
let bgpSocket = null;

// BGP Path Attribute Types
const BGP_PATH_ATTR = {
    ORIGIN: 0x01,
    AS_PATH: 0x02,
    NEXT_HOP: 0x03,
    MED: 0x04,
    MP_REACH_NLRI: 0x0e,
    MP_UNREACH_NLRI: 0x0f
};

// BGP Path Attribute Flags
const BGP_PATH_ATTR_FLAGS = {
    OPTIONAL: 0x80,
    TRANSITIVE: 0x40,
    PARTIAL: 0x20,
    EXTENDED_LENGTH: 0x10
};

const BGP_OPEN_OPT_TYPE = {
    OPT_TYPE: 0x02
};

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
    if (buffer.length < BGP_HEAD_LEN) {
        return null;
    }

    const marker = buffer.slice(0, 16).toString('hex');
    const length = buffer.readUInt16BE(16);
    const type = buffer.readUInt8(18);

    return { marker, length, type };
}

function handleBgpPacket(buffer) {
    const header = parseBgpHeader(buffer);
    if (!header) {
        log.error(`[Thread ${threadId}] Invalid or incomplete BGP header`);
        return;
    }

    const messageBody = buffer.slice(19, header.length); // 剩余报文体

    if (header.type == BGP_PACKET_TYPE.OPEN) {
        log.info(`[Thread ${threadId}] recv open message`);
        sendKeepAliveMsg();
        changeBgpFsmState(BGP_STATE.OPEN_CONFIRM);
    } else if (header.type == BGP_PACKET_TYPE.KEEPALIVE) {
        if (bgpState != BGP_STATE.ESTABLISHED) {
            log.info(`[Thread ${threadId}] recv keepalive message`);
        }
        sendKeepAliveMsg();
        if (bgpState != BGP_STATE.ESTABLISHED) {
            changeBgpFsmState(BGP_STATE.ESTABLISHED);
        }
    } else if (header.type == BGP_PACKET_TYPE.NOTIFICATION) {
        log.info(`[Thread ${threadId}] recv notification message`);
        changeBgpFsmState(BGP_STATE.IDLE);
        if (bgpSocket) {
            bgpSocket.destroy();
            bgpSocket = null;
        }
    } else if (header.type == BGP_PACKET_TYPE.ROUTE_REFRESH) {
        log.info(`[Thread ${threadId}] recv route-refresh message`);
    } else if (header.type == BGP_PACKET_TYPE.UPDATE) {
        log.info(`[Thread ${threadId}] recv update message`);
        if (bgpState != BGP_STATE.ESTABLISHED) {
            changeBgpFsmState(BGP_STATE.ESTABLISHED);
        }
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
            const capType = BGP_OPEN_CAP_MAP.get(cap);
            if (cap === BGP_CAPABILITY_UI.ADDR_FAMILY) {
                bgpData.addressFamily.forEach(addr => {
                    if (addr === BGP_AFI_TYPE_UI.AFI_IPV4) {
                        optParams.push(
                            ...buildBgpCapability(BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                                ...writeUInt16(BGP_AFI_TYPE_UI.AFI_IPV4),
                                ...writeUInt16(BGP_SAFI_TYPE.SAFI_UNICAST)
                            ])
                        );
                    } else if (addr === BGP_AFI_TYPE_UI.AFI_IPV6) {
                        optParams.push(
                            ...buildBgpCapability(BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                                ...writeUInt16(BGP_AFI_TYPE_UI.AFI_IPV6),
                                ...writeUInt16(BGP_SAFI_TYPE.SAFI_UNICAST)
                            ])
                        );
                    }
                });
            } else if (cap === BGP_CAPABILITY_UI.ROUTE_REFRESH) {
                optParams.push(...buildBgpCapability(BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x02, capType, 0x00, []));
            } else if (cap === BGP_CAPABILITY_UI.AS4) {
                optParams.push(
                    ...buildBgpCapability(BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x06, capType, 0x04, [
                        ...writeUInt32(bgpData.localAs)
                    ])
                );
            } else if (cap === BGP_CAPABILITY_UI.ROLE) {
                optParams.push(
                    ...buildBgpCapability(BGP_OPEN_OPT_TYPE.OPT_TYPE, 0x03, capType, 0x01, [
                        BGP_ROLE_VALUE_MAP.get(bgpData.role)
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
    const header = Buffer.alloc(BGP_HEAD_LEN);
    header.fill(0xff, 0, BGP_MARKER_LEN);
    header.writeUInt16BE(totalLength, BGP_MARKER_LEN);
    header.writeUInt8(type, BGP_MARKER_LEN + 2);
    return header;
}

function buildOpenMsg() {
    const openHeadMsg = [];
    // 版本号
    openHeadMsg.push(BGP_VERSION);
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
        BGP_HEAD_LEN + openHeadMsgBuf.length + optParamsBuf.length,
        BGP_PACKET_TYPE.OPEN
    );
    const buffer = Buffer.concat([header, openHeadMsgBuf, optParamsBuf]);

    log.info(`[Thread ${threadId}] build open msg: ${buffer.toString('hex')}`);
    return buffer;
}

function buildKeepAliveMsg() {
    const buffer = Buffer.alloc(BGP_HEAD_LEN);

    // 填充 Marker（16 字节 0xff）
    buffer.fill(0xff, 0, BGP_MARKER_LEN);
    // Length (2 bytes)
    buffer.writeUInt16BE(BGP_HEAD_LEN, BGP_MARKER_LEN);
    // Type (1 byte)
    buffer.writeUInt8(BGP_PACKET_TYPE.KEEPALIVE, BGP_MARKER_LEN + 2);

    return buffer;
}

function sendKeepAliveMsg() {
    const buf = buildKeepAliveMsg();
    bgpSocket.write(buf);
    if (bgpState != BGP_STATE.ESTABLISHED) {
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

    changeBgpFsmState(BGP_STATE.IDLE);

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

        changeBgpFsmState(BGP_STATE.CONNECT);
        // 连接建立成功之后就发送open报文
        sendOpenMsg();
        changeBgpFsmState(BGP_STATE.OPEN_SENT);

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
    server.listen(BGP_DEFAULT_PORT, bgpData.localIp, () => {
        log.info(`[Thread ${threadId}] TCP Server listening on port ${BGP_DEFAULT_PORT} at ${bgpData.localIp}`);
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
        BGP_PATH_ATTR.ORIGIN,
        BGP_PATH_ATTR_FLAGS.TRANSITIVE,
        [0x00] // IGP
    );
}

function buildAsPathAttribute(localAs) {
    return buildPathAttribute(
        BGP_PATH_ATTR.AS_PATH,
        BGP_PATH_ATTR_FLAGS.TRANSITIVE,
        [0x02, 0x01, ...writeUInt32(localAs)] // AS_SEQUENCE
    );
}

function buildMedAttribute() {
    return buildPathAttribute(BGP_PATH_ATTR.MED, BGP_PATH_ATTR_FLAGS.OPTIONAL, writeUInt32(0));
}

function buildMpReachNlriAttribute(route, localIp) {
    const attr = [];
    attr.push(BGP_PATH_ATTR_FLAGS.OPTIONAL | BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH);
    attr.push(BGP_PATH_ATTR.MP_REACH_NLRI);

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

function buildMpUnreachNlriAttribute(route) {
    const attr = [];
    attr.push(BGP_PATH_ATTR_FLAGS.OPTIONAL | BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH);
    attr.push(BGP_PATH_ATTR.MP_UNREACH_NLRI);

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
            BGP_HEAD_LEN + pathAttrBuf.length + withdrawnRoutesBuf.length,
            BGP_PACKET_TYPE.UPDATE
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
            ...buildPathAttribute(BGP_PATH_ATTR.NEXT_HOP, BGP_PATH_ATTR_FLAGS.TRANSITIVE, ipToBytes(bgpData.localIp)),
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
        nlri.push(...prefixBytes.slice(0, prefixLength));

        const nlriBuf = Buffer.alloc(nlri.length);
        nlriBuf.set(nlri);

        // 构建撤销路由缓冲区
        const withdrawnRoutesBuf = Buffer.alloc(2);
        withdrawnRoutesBuf.writeUInt16BE(0, 0);

        // 构建消息头
        const bufHeader = buildBgpMessageHeader(
            BGP_HEAD_LEN + pathAttrBuf.length + nlriBuf.length + withdrawnRoutesBuf.length,
            BGP_PACKET_TYPE.UPDATE
        );

        return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf, nlriBuf]);
    } catch (error) {
        log.error(`[Thread ${threadId}] Error building IPv4 UPDATE message: ${error.message}`);
    }
}

function sendRoute(config) {
    const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
    if (config.ipType === BGP_AFI_TYPE_UI.AFI_IPV4) {
        routes.forEach(route => {
            const buf = buildUpdateMsgIpv4(route, config.customAttr);
            bgpSocket.write(buf);
        });
    } else if (config.ipType === BGP_AFI_TYPE_UI.AFI_IPV6) {
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
        withdrawPrefixBufArray.push(...prefixBytes.slice(0, prefixLength));

        const withdrawPrefixBuf = Buffer.alloc(withdrawPrefixBufArray.length + 2);
        withdrawPrefixBuf.writeUInt16BE(withdrawPrefixBufArray.length, 0);
        withdrawPrefixBuf.set(withdrawPrefixBufArray, 2);

        const pathAttrBuf = Buffer.alloc(2);
        pathAttrBuf.writeUInt16BE(0, 0);

        const bufHeader = buildBgpMessageHeader(
            BGP_HEAD_LEN + withdrawPrefixBuf.length + pathAttrBuf.length,
            BGP_PACKET_TYPE.UPDATE
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
            BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length,
            BGP_PACKET_TYPE.UPDATE
        );

        return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);
    } catch (error) {
        log.error(`[Thread ${threadId}] Error building IPv6 WITHDRAW message: ${error.message}`);
    }
}

function withdrawRoute(config) {
    const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
    if (config.ipType === BGP_AFI_TYPE_UI.AFI_IPV4) {
        routes.forEach(route => {
            const buf = buildWithdrawMsgIpv4(route);
            bgpSocket.write(buf);
        });
    } else if (config.ipType === BGP_AFI_TYPE_UI.AFI_IPV6) {
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
            if (bgpState !== BGP_STATE.ESTABLISHED) {
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
            if (bgpState !== BGP_STATE.ESTABLISHED) {
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
