#!/usr/bin/env node
/**
 * DHCP 客户端测试脚本
 * 模拟标准 DHCP 四步握手：DISCOVER -> OFFER -> REQUEST -> ACK
 *
 * 服务器会把响应发回请求的来源端口，因此本脚本无需绑定特权端口 68，
 * 不需要 root / 管理员权限即可运行。
 *
 * 使用方法：
 *   node scripts/testDhcpClient.js [选项]
 *
 * 选项：
 *   --server <ip>    DHCP服务器地址，默认 255.255.255.255（广播）
 *                    本地测试建议用 127.0.0.1
 *   --mac <mac>      指定客户端MAC，例如 02:aa:bb:cc:dd:ee
 *   --count <n>      模拟多个客户端同时请求，默认 1
 *   --release        租约成功后立即发送 RELEASE
 *   --timeout <ms>   等待响应超时（毫秒），默认 5000
 *
 * 示例：
 *   node scripts/testDhcpClient.js --server 127.0.0.1
 *   node scripts/testDhcpClient.js --server 127.0.0.1 --count 3
 *   node scripts/testDhcpClient.js --server 127.0.0.1 --release
 */

'use strict';

const dgram = require('dgram');

// ========== 命令行参数 ==========
const args = process.argv.slice(2);
function getArg(name, def) {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : def;
}
const SERVER_ADDR = getArg('--server', '255.255.255.255');
const CLIENT_COUNT = parseInt(getArg('--count', '1'), 10);
const TIMEOUT_MS = parseInt(getArg('--timeout', '5000'), 10);
const DO_RELEASE = args.includes('--release');
const CUSTOM_MAC = getArg('--mac', null);

// ========== 协议常量 ==========
const DHCP_SERVER_PORT = 67;
const MAGIC_COOKIE = Buffer.from([99, 130, 83, 99]);
const MSG_TYPE = { DISCOVER: 1, OFFER: 2, REQUEST: 3, ACK: 5, NAK: 6, RELEASE: 7 };

// ========== 工具函数 ==========
function randomXid() {
    return (Math.random() * 0xffffffff) >>> 0;
}

function parseMac(str) {
    const parts = str.split(/[:\-]/).map(s => parseInt(s, 16));
    if (parts.length !== 6 || parts.some(isNaN)) throw new Error(`无效MAC地址: ${str}`);
    return Buffer.from(parts);
}

function randomMac() {
    const mac = Buffer.alloc(6);
    mac[0] = 0x02; // 本地管理位，单播
    for (let i = 1; i < 6; i++) mac[i] = Math.floor(Math.random() * 256);
    return mac;
}

function macStr(buf) {
    return Array.from(buf)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(':');
}

function ipToBuffer(ip) {
    return Buffer.from(ip.split('.').map(Number));
}

function bufToIp(buf, offset = 0) {
    return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
}

// ========== DHCP 报文构建 ==========
function buildPacket(msgType, xid, macBuf, extraOptions = []) {
    const buf = Buffer.alloc(576, 0);

    buf.writeUInt8(1, 0);           // op: BOOTREQUEST
    buf.writeUInt8(1, 1);           // htype: Ethernet
    buf.writeUInt8(6, 2);           // hlen
    buf.writeUInt8(0, 3);           // hops
    buf.writeUInt32BE(xid, 4);
    buf.writeUInt16BE(0, 8);        // secs
    buf.writeUInt16BE(0x8000, 10);  // flags: broadcast（让服务器广播响应）
    macBuf.copy(buf, 28);           // chaddr
    MAGIC_COOKIE.copy(buf, 236);

    let off = 240;
    const writeOpt = (code, data) => {
        buf.writeUInt8(code, off++);
        buf.writeUInt8(data.length, off++);
        data.copy(buf, off);
        off += data.length;
    };

    writeOpt(53, Buffer.from([msgType]));
    for (const { code, data } of extraOptions) writeOpt(code, data);
    writeOpt(55, Buffer.from([1, 3, 6, 51, 54])); // Parameter Request List
    buf.writeUInt8(255, off++);     // End

    return buf.slice(0, off);
}

function buildRelease(xid, macBuf, assignedIp, serverIp) {
    const buf = Buffer.alloc(300, 0);
    buf.writeUInt8(1, 0);
    buf.writeUInt8(1, 1);
    buf.writeUInt8(6, 2);
    buf.writeUInt32BE(xid, 4);
    ipToBuffer(assignedIp).copy(buf, 12); // ciaddr
    macBuf.copy(buf, 28);
    MAGIC_COOKIE.copy(buf, 236);

    let off = 240;
    buf.writeUInt8(53, off++); buf.writeUInt8(1, off++); buf.writeUInt8(MSG_TYPE.RELEASE, off++);
    buf.writeUInt8(54, off++); buf.writeUInt8(4, off++); ipToBuffer(serverIp).copy(buf, off); off += 4;
    buf.writeUInt8(255, off++);

    return buf.slice(0, off);
}

// ========== DHCP 响应解析 ==========
function parseResponse(buf) {
    if (buf.length < 240) return null;
    if (!buf.slice(236, 240).equals(MAGIC_COOKIE)) return null;
    if (buf.readUInt8(0) !== 2) return null; // BOOTREPLY

    const pkt = { xid: buf.readUInt32BE(4), yiaddr: bufToIp(buf, 16), options: {} };

    let i = 240;
    while (i < buf.length) {
        const code = buf.readUInt8(i++);
        if (code === 255) break;
        if (code === 0) continue;
        const len = buf.readUInt8(i++);
        pkt.options[code] = buf.slice(i, i + len);
        i += len;
    }

    if (pkt.options[53]) pkt.msgType = pkt.options[53].readUInt8(0);
    if (pkt.options[54]?.length >= 4) pkt.serverId = bufToIp(pkt.options[54], 0);
    if (pkt.options[51]?.length >= 4) pkt.leaseTime = pkt.options[51].readUInt32BE(0);
    if (pkt.options[1]?.length >= 4)  pkt.subnetMask = bufToIp(pkt.options[1], 0);
    if (pkt.options[3]?.length >= 4)  pkt.router = bufToIp(pkt.options[3], 0);
    if (pkt.options[6]) {
        pkt.dns = [];
        for (let j = 0; j + 4 <= pkt.options[6].length; j += 4) pkt.dns.push(bufToIp(pkt.options[6], j));
    }

    return pkt;
}

// ========== 单次 DHCP 会话 ==========
function runSession(socket, macBuf, sessionId) {
    const xid = randomXid();
    const tag = `[客户端${sessionId}][${macStr(macBuf)}]`;

    return new Promise((resolve, reject) => {
        let step = 'discover';
        let timer = null;

        const fail = msg => { clearTimeout(timer); reject(new Error(`${tag} ${msg}`)); };
        const startTimer = label => {
            clearTimeout(timer);
            timer = setTimeout(() => fail(`等待 ${label} 超时 (${TIMEOUT_MS}ms)`), TIMEOUT_MS);
        };

        const onMessage = (msg, _rinfo) => {
            const pkt = parseResponse(msg);
            if (!pkt || pkt.xid !== xid) return;

            if (step === 'discover' && pkt.msgType === MSG_TYPE.OFFER) {
                clearTimeout(timer);
                const offerIp = pkt.yiaddr;
                const serverId = pkt.serverId;

                console.log(`${tag} [2/4] 收到 OFFER`);
                console.log(`       提供IP:   ${offerIp}`);
                console.log(`       服务器:   ${serverId}`);
                console.log(`       子网掩码: ${pkt.subnetMask || '-'}`);
                console.log(`       网关:     ${pkt.router || '-'}`);
                console.log(`       DNS:      ${pkt.dns?.join(', ') || '-'}`);
                console.log(`       租约时间: ${pkt.leaseTime != null ? pkt.leaseTime + ' 秒' : '-'}`);

                step = 'request';
                const reqPkt = buildPacket(MSG_TYPE.REQUEST, xid, macBuf, [
                    { code: 50, data: ipToBuffer(offerIp) },
                    { code: 54, data: ipToBuffer(serverId) }
                ]);
                console.log(`${tag} [3/4] 发送 REQUEST -> ${offerIp}`);
                socket.send(reqPkt, 0, reqPkt.length, DHCP_SERVER_PORT, SERVER_ADDR, err => {
                    if (err) return fail(`发送REQUEST失败: ${err.message}`);
                    startTimer('ACK');
                });

            } else if (step === 'request') {
                clearTimeout(timer);
                if (pkt.msgType === MSG_TYPE.ACK) {
                    console.log(`${tag} [4/4] 收到 ACK -> 租约成功！IP = ${pkt.yiaddr}`);
                    socket.removeListener('message', onMessage);

                    if (DO_RELEASE) {
                        const relPkt = buildRelease(xid, macBuf, pkt.yiaddr, pkt.serverId);
                        socket.send(relPkt, 0, relPkt.length, DHCP_SERVER_PORT, SERVER_ADDR, err => {
                            if (err) console.warn(`${tag} RELEASE发送失败: ${err.message}`);
                            else console.log(`${tag} [+]   发送 RELEASE（${pkt.yiaddr} 已归还）`);
                            resolve({ mac: macStr(macBuf), ip: pkt.yiaddr, leaseTime: pkt.leaseTime });
                        });
                    } else {
                        resolve({ mac: macStr(macBuf), ip: pkt.yiaddr, leaseTime: pkt.leaseTime });
                    }
                } else if (pkt.msgType === MSG_TYPE.NAK) {
                    socket.removeListener('message', onMessage);
                    reject(new Error(`${tag} 服务器返回NAK，拒绝分配`));
                }
            }
        };

        socket.on('message', onMessage);

        const discPkt = buildPacket(MSG_TYPE.DISCOVER, xid, macBuf);
        console.log(`${tag} [1/4] 发送 DISCOVER -> ${SERVER_ADDR}:${DHCP_SERVER_PORT}`);
        socket.send(discPkt, 0, discPkt.length, DHCP_SERVER_PORT, SERVER_ADDR, err => {
            if (err) return fail(`发送DISCOVER失败: ${err.message}`);
            startTimer('OFFER');
        });
    });
}

// ========== 主流程 ==========
async function main() {
    console.log('============================================================');
    console.log('  DHCP 客户端测试');
    console.log('============================================================');
    console.log(`  服务器地址: ${SERVER_ADDR}:${DHCP_SERVER_PORT}`);
    console.log(`  客户端数量: ${CLIENT_COUNT}`);
    console.log(`  租约后释放: ${DO_RELEASE ? '是' : '否'}`);
    console.log(`  超时时间:   ${TIMEOUT_MS} ms`);
    console.log('============================================================\n');

    // 绑定到系统自动分配的端口（非特权），无需 root/管理员
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    const boundPort = await new Promise((resolve, reject) => {
        socket.on('error', reject);
        socket.bind(0, '0.0.0.0', () => {
            socket.setBroadcast(true);
            resolve(socket.address().port);
        });
    });

    console.log(`套接字就绪，监听端口 ${boundPort}（服务器响应将发回此端口）\n`);

    // 生成各客户端 MAC
    const macs = (CLIENT_COUNT === 1 && CUSTOM_MAC)
        ? [parseMac(CUSTOM_MAC)]
        : Array.from({ length: CLIENT_COUNT }, () => randomMac());

    // 并发发起所有会话
    const results = await Promise.allSettled(macs.map((mac, i) => runSession(socket, mac, i + 1)));

    socket.close();

    console.log('\n============================================================');
    console.log('  测试结果');
    console.log('============================================================');
    let success = 0, failed = 0;
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
            const v = r.value;
            console.log(`  [成功] 客户端${i + 1}: MAC=${v.mac}  IP=${v.ip}  租约=${v.leaseTime}s`);
            success++;
        } else {
            console.log(`  [失败] 客户端${i + 1}: ${r.reason.message}`);
            failed++;
        }
    });
    console.log('============================================================');
    console.log(`  总计: ${success} 成功, ${failed} 失败`);
    console.log('============================================================');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('\n[错误]', err.message);
    process.exit(1);
});
