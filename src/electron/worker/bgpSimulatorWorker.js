const { parentPort } = require('worker_threads');
const net = require('net');
const { BGP_DEFAULT_PORT, BGP_HEAD_LEN, BgpState, BgpPacketType, BgpOpenCapMap, BgpAfiType, BgpSAfiType, BgpRoleValueMap } = require('../../const/bgpConst');
const { writeUInt16, writeUInt32, ipToBytes } = require('../utils/bgpUtils');

let bgpState = BgpState.IDLE;

let bgpData;

function changeBgpFsmState(_bgpState) {
    parentPort.postMessage({
        op: 'log',
        message: `bgp fsm state ${bgpState} -> ${_bgpState}`
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

    if (header.type == BgpPacketType.OPEN) {
        console.log("recv open message, body:", messageBody.toString('hex'));
        parentPort.postMessage({
            op: 'log',
            message: `recv open message`
        });
        sendKeepAliveMsg(socket);
        changeBgpFsmState(BgpState.OPEN_CONFIRM);
    } else if (header.type == BgpPacketType.KEEPALIVE) {
        console.log("recv keepalive message, body:", messageBody.toString('hex'));
        parentPort.postMessage({
            op: 'log',
            message: `recv keepalive message`
        });
        sendKeepAliveMsg(socket);
        if (bgpState != BgpState.ESTABLISHED) {
            changeBgpFsmState(BgpState.ESTABLISHED);
        }
    } else if (header.type == BgpPacketType.NOTIFICATION) {
        console.log("recv notification message, body:", messageBody.toString('hex'));
        parentPort.postMessage({
            op: 'log',
            message: `recv notification message`
        });
        changeBgpFsmState(BgpState.IDLE);
    } else if (header.type == BgpPacketType.ROUTE_REFRESH) {
        console.log("recv route-refresh message, body:", messageBody.toString('hex'));
        parentPort.postMessage({
            op: 'log',
            message: `recv route-refresh message`
        });
    } else if (header.type == BgpPacketType.UPDATE) {
        console.log("recv update message, body:", messageBody.toString('hex'));
        parentPort.postMessage({
            op: 'log',
            message: `recv update message`
        });
    }
}

function buildOpenMsg() {
    const version = 4;
    
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
        bgpData.openCap.forEach((cap) => {
            const capInfo = BgpOpenCapMap.get(cap);
            if (cap === 'Address Family') {
                bgpData.addressFamily.forEach((addr)=>{
                    if (addr === 'Ipv4-UNC') {
                        optParams.push(0x02);
                        optParams.push(0x06);
                        optParams.push(capInfo);
                        optParams.push(0x04);
                        optParams.push(...writeUInt16(BgpAfiType.AFI_IPV4));
                        optParams.push(...writeUInt16(BgpSAfiType.SAFI_UNICAST));
                    } else if (addr === 'Ipv6-UNC') {
                        optParams.push(0x02);
                        optParams.push(0x06);
                        optParams.push(capInfo);
                        optParams.push(0x04);
                        optParams.push(...writeUInt16(BgpAfiType.AFI_IPV6));
                        optParams.push(...writeUInt16(BgpSAfiType.SAFI_UNICAST));
                    }
                });
            } else if (cap === 'Route-Refresh') {
                optParams.push(0x02);
                optParams.push(0x02);
                optParams.push(capInfo);
                optParams.push(0x00);
            } else if (cap === 'AS4') {
                optParams.push(0x02);
                optParams.push(0x06);
                optParams.push(capInfo);
                optParams.push(0x04);
                optParams.push(...writeUInt32(bgpData.localAs));
            } else if (cap === 'Role') {
                optParams.push(0x02);
                optParams.push(0x03);
                optParams.push(capInfo);
                optParams.push(0x01);
                optParams.push(BgpRoleValueMap.get(bgpData.role));
            }
        });
    }

    if (bgpData.openCapCustom != '') {
        console.log(bgpData.openCapCustom);
    }

    // 可选参数长度
    openBody.push(optParams.length);
    // 添加可选参数
    openBody.push(...optParams);

    const totalLength = BGP_HEAD_LEN + openBody.length;
    const buffer = Buffer.alloc(totalLength);

    // 填充 Marker（16 字节 0xff）
    buffer.fill(0xff, 0, 16);

    // Length (2 bytes)
    buffer.writeUInt16BE(totalLength, 16);

    // Type (1 byte)
    buffer.writeUInt8(BgpPacketType.OPEN, 18);

    // 拷贝 OPEN 消息体
    for (let i = 0; i < openBody.length; i++) {
        buffer[BGP_HEAD_LEN + i] = openBody[i];
    }

    console.log("build open msg:", buffer.toString('hex'))

    return buffer;
}

function buildKeepAliveMsg() {
    const buffer = Buffer.alloc(BGP_HEAD_LEN);

    // 填充 Marker（16 字节 0xff）
    buffer.fill(0xff, 0, 16);
    // Length (2 bytes)
    buffer.writeUInt16BE(BGP_HEAD_LEN, 16);
    // Type (1 byte)
    buffer.writeUInt8(BgpPacketType.KEEPALIVE, 18);

    console.log("build keepalive msg:", buffer.toString('hex'))

    return buffer;
}

function sendKeepAliveMsg(socket) {
    const buf = buildKeepAliveMsg();
    socket.write(buf);
    parentPort.postMessage({
        op: 'log',
        message: `send keepalive msg`
    });
}

function sendOpenMsg(socket) {
    const buf = buildOpenMsg();
    socket.write(buf);
    parentPort.postMessage({
        op: 'log',
        message: `send open msg`
    });
}

function startTcpServer() {
    const server = net.createServer((socket) => {
        const clientAddress = socket.remoteAddress;
        const clientPort = socket.remotePort;
        console.log(`Client connected from ${clientAddress}:${clientPort}`);

        parentPort.postMessage({
            op: 'log',
            message: `Client connected from ${clientAddress}:${clientPort}`
        });
        
        changeBgpFsmState(BgpState.CONNECT);
        // 连接建立成功之后就发送open报文
        sendOpenMsg(socket);
        changeBgpFsmState(BgpState.OPEN_SENT);

        // 当接收到数据时处理数据
        socket.on('data', (data) => {
            console.log('Received raw data:', data.toString('hex'));
            handleBgpPacket(socket, data);
        });

        socket.on('end', () => {
            console.log(`Client ${clientAddress}:${clientPort} disconnected`);
        });

        socket.on('error', (err) => {
            console.error(`TCP Error from ${clientAddress}:${clientPort}:`, err.message)
        });
    });

    // 启动服务器并监听端口
    server.listen(BGP_DEFAULT_PORT, bgpData.localIp, () => {
        console.log(`TCP Server listening on port ${BGP_DEFAULT_PORT} at ${bgpData.localIp}`);
        parentPort.postMessage({
            op: 'log',
            message: `TCP Server listening on port ${BGP_DEFAULT_PORT} at ${bgpData.localIp}`
        });
    });
}

parentPort.on('message', (_bgpData) => {
    try {
        bgpData = _bgpData;
        startTcpServer();

        parentPort.postMessage({
            op: 'log',
            message: `bgp server start.`
        });
    } catch (err) {
        throw new Error(err.message);
    }
});
