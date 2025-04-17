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
const BGP_OPERATIONS = require('../const/operations');
const { genRouteIps } = require('../utils/ipUtils');
const ipaddr = require('ipaddr.js');

let bgpState = BGP_STATE.IDLE;
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

function buildOpenMsg() {
    const version = BGP_VERSION;

    // 构建消息体部分
    const openBody = [];

    // 版本号
    openBody.push(version);
    // 本地AS号
    openBody.push(...writeUInt16(bgpData.localAs));
    // holdTime
    openBody.push(...writeUInt16(bgpData.holdTime));
    // routerID
    openBody.push(...ipToBytes(bgpData.routerId));

    // 构建可选参数部分
    const optParams = [];
    if (bgpData.openCap && bgpData.openCap.length > 0) {
        // 遍历每个能力
        bgpData.openCap.forEach(cap => {
            const capInfo = BGP_OPEN_CAP_MAP.get(cap);
            if (cap === BGP_CAPABILITY_UI.ADDR_FAMILY) {
                bgpData.addressFamily.forEach(addr => {
                    if (addr === BGP_AFI_TYPE_UI.AFI_IPV4) {
                        optParams.push(0x02);
                        optParams.push(0x06);
                        optParams.push(capInfo);
                        optParams.push(0x04);
                        optParams.push(...writeUInt16(BGP_AFI_TYPE_UI.AFI_IPV4));
                        optParams.push(...writeUInt16(BGP_SAFI_TYPE.SAFI_UNICAST));
                    } else if (addr === BGP_AFI_TYPE_UI.AFI_IPV6) {
                        optParams.push(0x02);
                        optParams.push(0x06);
                        optParams.push(capInfo);
                        optParams.push(0x04);
                        optParams.push(...writeUInt16(BGP_AFI_TYPE_UI.AFI_IPV6));
                        optParams.push(...writeUInt16(BGP_SAFI_TYPE.SAFI_UNICAST));
                    }
                });
            } else if (cap === BGP_CAPABILITY_UI.ROUTE_REFRESH) {
                optParams.push(0x02);
                optParams.push(0x02);
                optParams.push(capInfo);
                optParams.push(0x00);
            } else if (cap === BGP_CAPABILITY_UI.AS4) {
                optParams.push(0x02);
                optParams.push(0x06);
                optParams.push(capInfo);
                optParams.push(0x04);
                optParams.push(...writeUInt32(bgpData.localAs));
            } else if (cap === BGP_CAPABILITY_UI.ROLE) {
                optParams.push(0x02);
                optParams.push(0x03);
                optParams.push(capInfo);
                optParams.push(0x01);
                optParams.push(BGP_ROLE_VALUE_MAP.get(bgpData.role));
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

    // 可选参数长度
    openBody.push(optParams.length);
    // 添加可选参数
    openBody.push(...optParams);

    const totalLength = BGP_HEAD_LEN + openBody.length;
    const buffer = Buffer.alloc(totalLength);

    // 填充 Marker（16 字节 0xff）
    buffer.fill(0xff, 0, BGP_MARKER_LEN);

    // Length (2 bytes)
    buffer.writeUInt16BE(totalLength, BGP_MARKER_LEN);

    // Type (1 byte)
    buffer.writeUInt8(BGP_PACKET_TYPE.OPEN, BGP_MARKER_LEN + 2);

    // 拷贝 OPEN 消息体
    for (let i = 0; i < openBody.length; i++) {
        buffer[BGP_HEAD_LEN + i] = openBody[i];
    }

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
}

function buildUpdateMsgIpv4(route, customAttr) {
    // 构建路径属性
    const pathAttr = [];
    // ORIGIN
    pathAttr.push(0x40);
    pathAttr.push(0x01);
    pathAttr.push(0x01);
    pathAttr.push(0x00);
    // AS_PATH
    pathAttr.push(0x40);
    pathAttr.push(0x02);
    pathAttr.push(0x06);
    pathAttr.push(0x02);
    pathAttr.push(0x01);
    pathAttr.push(...writeUInt32(bgpData.localAs));
    // NEXT_HOP
    pathAttr.push(0x40);
    pathAttr.push(0x03);
    pathAttr.push(0x04);
    pathAttr.push(...ipToBytes(bgpData.localIp));
    // MED
    pathAttr.push(0x80);
    pathAttr.push(0x04);
    pathAttr.push(0x04);
    pathAttr.push(...writeUInt32(0));

    if (customAttr && customAttr.trim() !== '') {
        try {
            const customPathAttr = processCustomPkt(customAttr);
            pathAttr.push(...customPathAttr);
        } catch (error) {
            log.error(`[Thread ${threadId}] Error processing custom path attribute: ${error.message}`);
        }
    }
    const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
    pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
    for (let i = 0; i < pathAttr.length; i++) {
        pathAttrBuf[i + 2] = pathAttr[i];
    }

    // 构建NLRI
    const nlri = [];
    nlri.push(route.mask);
    nlri.push(...ipToBytes(route.ip));

    const nlriBuf = Buffer.alloc(nlri.length);
    for (let i = 0; i < nlri.length; i++) {
        nlriBuf[i] = nlri[i];
    }

    const withdrawnRoutesBuf = Buffer.alloc(2);
    withdrawnRoutesBuf.writeUInt16BE(0, 0);

    const bufHeader = Buffer.alloc(BGP_HEAD_LEN);
    // 填充 Marker（16 字节 0xff）
    bufHeader.fill(0xff, 0, BGP_MARKER_LEN);
    // Length (2 bytes)
    bufHeader.writeUInt16BE(
        BGP_HEAD_LEN + pathAttrBuf.length + nlriBuf.length + withdrawnRoutesBuf.length,
        BGP_MARKER_LEN
    );
    // Type (1 byte)
    bufHeader.writeUInt8(BGP_PACKET_TYPE.UPDATE, BGP_MARKER_LEN + 2);

    return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf, nlriBuf]);
}

function buildUpdateMsgIpv6(route, customAttr) {
    // 构建路径属性
    const pathAttr = [];
    // ORIGIN
    pathAttr.push(0x40);
    pathAttr.push(0x01);
    pathAttr.push(0x01);
    pathAttr.push(0x00);
    // AS_PATH
    pathAttr.push(0x40);
    pathAttr.push(0x02);
    pathAttr.push(0x06);
    pathAttr.push(0x02);
    pathAttr.push(0x01);
    pathAttr.push(...writeUInt32(bgpData.localAs));
    // MED
    pathAttr.push(0x80);
    pathAttr.push(0x04);
    pathAttr.push(0x04);
    pathAttr.push(...writeUInt32(0));
    // MP_REACH_NLRI
    pathAttr.push(0x90);
    pathAttr.push(0x0e);
    pathAttr.push(...writeUInt16(0x26));
    pathAttr.push(...writeUInt16(0x02));
    pathAttr.push(0x01);
    let addr = ipaddr.parse(`::ffff:${bgpData.localIp}`);
    let bytes = addr.toByteArray();
    pathAttr.push(bytes.length);
    pathAttr.push(...bytes);

    pathAttr.push(0x00);

    addr = ipaddr.parse(route.ip);
    bytes = addr.toByteArray();
    pathAttr.push(route.mask);
    pathAttr.push(...bytes);

    if (customAttr && customAttr.trim() !== '') {
        try {
            const customPathAttr = processCustomPkt(customAttr);
            pathAttr.push(...customPathAttr);
        } catch (error) {
            log.error(`[Thread ${threadId}] Error processing custom path attribute: ${error.message}`);
        }
    }
    const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
    pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
    for (let i = 0; i < pathAttr.length; i++) {
        pathAttrBuf[i + 2] = pathAttr[i];
    }

    const withdrawnRoutesBuf = Buffer.alloc(2);
    withdrawnRoutesBuf.writeUInt16BE(0, 0);

    const bufHeader = Buffer.alloc(BGP_HEAD_LEN);
    // 填充 Marker（16 字节 0xff）
    bufHeader.fill(0xff, 0, BGP_MARKER_LEN);
    // Length (2 bytes)
    bufHeader.writeUInt16BE(BGP_HEAD_LEN + pathAttrBuf.length + withdrawnRoutesBuf.length, BGP_MARKER_LEN);
    // Type (1 byte)
    bufHeader.writeUInt8(BGP_PACKET_TYPE.UPDATE, BGP_MARKER_LEN + 2);

    return Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);
}

function sendRoute(config) {
    const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
    if (config.ipType === BGP_AFI_TYPE_UI.AFI_IPV4) {
        routes.forEach(route => {
            const buf = buildUpdateMsgIpv4(route, config.customAttr);
            console.log(buf.toString('hex'));
            bgpSocket.write(buf);
        });
    } else if (config.ipType === BGP_AFI_TYPE_UI.AFI_IPV6) {
        routes.forEach(route => {
            const buf = buildUpdateMsgIpv6(route, config.customAttr);
            console.log(buf.toString('hex'));
            bgpSocket.write(buf);
        });
    }
}

function buildWithdrawMsgIpv4(route) {
    const withdrawPrefixBufArray = [];
    withdrawPrefixBufArray.push(route.mask);
    withdrawPrefixBufArray.push(...ipToBytes(route.ip));

    const withdrawPrefixBuf = Buffer.alloc(withdrawPrefixBufArray.length + 2);
    withdrawPrefixBuf.writeUInt16BE(withdrawPrefixBufArray.length, 0);
    for (let i = 0; i < withdrawPrefixBufArray.length; i++) {
        withdrawPrefixBuf[i + 2] = withdrawPrefixBufArray[i];
    }

    const pathAttrBuf = Buffer.alloc(2);
    pathAttrBuf.writeUInt16BE(0, 0);

    const bufHeader = Buffer.alloc(BGP_HEAD_LEN);
    // 填充 Marker（16 字节 0xff）
    bufHeader.fill(0xff, 0, BGP_MARKER_LEN);
    // Length (2 bytes)
    bufHeader.writeUInt16BE(BGP_HEAD_LEN + withdrawPrefixBuf.length + pathAttrBuf.length, BGP_MARKER_LEN);
    // Type (1 byte)
    bufHeader.writeUInt8(BGP_PACKET_TYPE.UPDATE, BGP_MARKER_LEN + 2);

    return Buffer.concat([bufHeader, withdrawPrefixBuf, pathAttrBuf]);
}

function buildWithdrawMsgIpv6(route) {
    // MP_UN_REACH_NLRI
    const withdrawPrefixBufArray = [];
    withdrawPrefixBufArray.push(0x90);
    withdrawPrefixBufArray.push(0x0f);
    withdrawPrefixBufArray.push(...writeUInt16(0x14));
    withdrawPrefixBufArray.push(...writeUInt16(0x02));
    withdrawPrefixBufArray.push(0x01);
    const addr = ipaddr.parse(route.ip);
    const bytes = addr.toByteArray();
    withdrawPrefixBufArray.push(route.mask);
    withdrawPrefixBufArray.push(...bytes);

    const withdrawPrefixBuf = Buffer.alloc(withdrawPrefixBufArray.length + 2);
    withdrawPrefixBuf.writeUInt16BE(withdrawPrefixBufArray.length, 0);
    for (let i = 0; i < withdrawPrefixBufArray.length; i++) {
        withdrawPrefixBuf[i + 2] = withdrawPrefixBufArray[i];
    }

    const withdrawnRoutesBuf = Buffer.alloc(2);
    withdrawnRoutesBuf.writeUInt16BE(0, 0);

    const bufHeader = Buffer.alloc(BGP_HEAD_LEN);
    // 填充 Marker（16 字节 0xff）
    bufHeader.fill(0xff, 0, BGP_MARKER_LEN);
    // Length (2 bytes)
    bufHeader.writeUInt16BE(BGP_HEAD_LEN + withdrawnRoutesBuf.length + withdrawPrefixBuf.length, BGP_MARKER_LEN);
    // Type (1 byte)
    bufHeader.writeUInt8(BGP_PACKET_TYPE.UPDATE, BGP_MARKER_LEN + 2);

    return Buffer.concat([bufHeader, withdrawnRoutesBuf, withdrawPrefixBuf]);
}

function withdrawRoute(config) {
    const routes = genRouteIps(config.ipType, config.prefix, config.mask, config.count);
    if (config.ipType === BGP_AFI_TYPE_UI.AFI_IPV4) {
        routes.forEach(route => {
            const buf = buildWithdrawMsgIpv4(route);
            console.log(buf.toString('hex'));
            bgpSocket.write(buf);
        });
    } else if (config.ipType === BGP_AFI_TYPE_UI.AFI_IPV6) {
        routes.forEach(route => {
            const buf = buildWithdrawMsgIpv6(route);
            console.log(buf.toString('hex'));
            bgpSocket.write(buf);
        });
    }
}

parentPort.on('message', msg => {
    try {
        if (msg.op === BGP_OPERATIONS.START_BGP) {
            bgpData = msg.data;
            startTcpServer();
            log.info(`[Thread ${threadId}] bgp server start.`);
        } else if (msg.op === BGP_OPERATIONS.STOP_BGP) {
            stopBgp();
        } else if (msg.op === BGP_OPERATIONS.SEND_ROUTE) {
            sendRoute(msg.data);
        } else if (msg.op === BGP_OPERATIONS.WITHDRAW_ROUTE) {
            withdrawRoute(msg.data);
        }
    } catch (err) {
        parentPort.postMessage(errorResponse(err.message));
    }
});
