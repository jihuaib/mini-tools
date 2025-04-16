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
const log = require('electron-log');

let bgpState = BGP_STATE.IDLE;
let bgpData;
let server;

function changeBgpFsmState(_bgpState) {
    log.info(`[Thread ${threadId}] bgp fsm state ${bgpState} -> ${_bgpState}`);

    parentPort.postMessage({
        op: 'peer-state',
        message: `${_bgpState}`
    });
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

function handleBgpPacket(socket, buffer) {
    const header = parseBgpHeader(buffer);
    if (!header) {
        return { error: 'Invalid or incomplete BGP header' };
    }

    const messageBody = buffer.slice(19, header.length); // 剩余报文体

    if (header.type == BGP_PACKET_TYPE.OPEN) {
        log.info(`[Thread ${threadId}] recv open message`);
        sendKeepAliveMsg(socket);
        changeBgpFsmState(BGP_STATE.OPEN_CONFIRM);
    } else if (header.type == BGP_PACKET_TYPE.KEEPALIVE) {
        sendKeepAliveMsg(socket);
        if (bgpState != BGP_STATE.ESTABLISHED) {
            changeBgpFsmState(BGP_STATE.ESTABLISHED);
        }
    } else if (header.type == BGP_PACKET_TYPE.NOTIFICATION) {
        log.info(`[Thread ${threadId}] recv notification message`);
        changeBgpFsmState(BGP_STATE.IDLE);
    } else if (header.type == BGP_PACKET_TYPE.ROUTE_REFRESH) {
        log.info(`[Thread ${threadId}] recv route-refresh message`);
    } else if (header.type == BGP_PACKET_TYPE.UPDATE) {
        log.info(`[Thread ${threadId}] recv update message`);
    }
}

function processCustomCapability(customCap) {
    // Remove all spaces and newlines
    const cleanHex = customCap.replace(/\s+/g, '');
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
                    if (addr === BGP_ADDRESS_FAMILY_UI.IPV4_UNC) {
                        optParams.push(0x02);
                        optParams.push(0x06);
                        optParams.push(capInfo);
                        optParams.push(0x04);
                        optParams.push(...writeUInt16(BGP_AFI_TYPE_UI.AFI_IPV4));
                        optParams.push(...writeUInt16(BGP_SAFI_TYPE.SAFI_UNICAST));
                    } else if (addr === BGP_ADDRESS_FAMILY_UI.IPV6_UNC) {
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
            const customCapBuffer = processCustomCapability(bgpData.openCapCustom);
            // Add the custom data
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

function sendKeepAliveMsg(socket) {
    const buf = buildKeepAliveMsg();
    socket.write(buf);
    log.info(`[Thread ${threadId}] send keepalive msg`);
}

function sendOpenMsg(socket) {
    const buf = buildOpenMsg();
    socket.write(buf);
    log.info(`[Thread ${threadId}] send open msg`);
}

function stopBgp() {
    // Close all active connections
    if (server) {
        server.close(() => {
            log.info(`[Thread ${threadId}] BGP server stopped`);
        });
    }

    // Reset BGP state
    changeBgpFsmState(BGP_STATE.IDLE);

    // Clear any existing data
    bgpData = null;

    log.info(`[Thread ${threadId}] BGP simulator stopped successfully`);
}

function startTcpServer() {
    server = net.createServer(socket => {
        const clientAddress = socket.remoteAddress;
        const clientPort = socket.remotePort;

        log.info(`[Thread ${threadId}] Client connected from ${clientAddress}:${clientPort}`);

        changeBgpFsmState(BGP_STATE.CONNECT);
        // 连接建立成功之后就发送open报文
        sendOpenMsg(socket);
        changeBgpFsmState(BGP_STATE.OPEN_SENT);

        // 当接收到数据时处理数据
        socket.on('data', data => {
            handleBgpPacket(socket, data);
        });

        socket.on('end', () => {
            log.info(`[Thread ${threadId}] Client ${clientAddress}:${clientPort} disconnected`);
        });

        socket.on('error', err => {
            log.error(`[Thread ${threadId}] TCP Error from ${clientAddress}:${clientPort}: ${err.message}`);
        });
    });

    // 启动服务器并监听端口
    server.listen(BGP_DEFAULT_PORT, bgpData.localIp, () => {
        log.info(`[Thread ${threadId}] TCP Server listening on port ${BGP_DEFAULT_PORT} at ${bgpData.localIp}`);
    });
}

function sendRoute(config) {
    log.info(config);
}

function withdrawRoute(config) {
    log.info(config);
}

parentPort.on('message', msg => {
    try {
        if (msg.op === 'start-bgp') {
            bgpData = msg.data;
            startTcpServer();

            log.info(`[Thread ${threadId}] bgp server start.`);
        } else if (msg.op === 'stop-bgp') {
            stopBgp();
        } else if (msg.op === 'send-route') {
            sendRoute(msg.data);
        } else if (msg.op === 'withdraw-route') {
            withdrawRoute(msg.data);
        }
    } catch (err) {
        throw new Error(err.message);
    }
});
