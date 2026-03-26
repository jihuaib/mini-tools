#!/usr/bin/env node
/**
 * DHCP / DHCPv6 客户端测试脚本
 *
 * DHCPv4：模拟标准四步握手 DISCOVER -> OFFER -> REQUEST -> ACK
 * DHCPv6：模拟标准四步握手 SOLICIT -> ADVERTISE -> REQUEST -> REPLY
 *
 * 服务器会把响应发回请求的来源端口，因此本脚本无需绑定特权端口，
 * 不需要 root / 管理员权限即可运行。
 *
 * 使用方法：
 *   node scripts/testDhcpClient.js [选项]
 *
 * 通用选项：
 *   --v6             使用 DHCPv6 模式（默认 DHCPv4）
 *   --count <n>      模拟多个客户端同时请求，默认 1
 *   --release        租约成功后立即发送 RELEASE
 *   --timeout <ms>   等待响应超时（毫秒），默认 5000
 *
 * DHCPv4 选项：
 *   --server <ip>    服务器地址，默认 255.255.255.255（广播）
 *                    本地测试建议用 127.0.0.1
 *   --port <n>       服务器端口，默认 67
 *   --mac <mac>      指定客户端MAC，例如 02:aa:bb:cc:dd:ee
 *
 * DHCPv6 选项：
 *   --server6 <ip>   服务器地址，默认 ::1（本地回环）
 *                    局域网测试可用 ff02::1:2（链路多播）
 *   --port6 <n>      DHCPv6服务器端口，默认沿用 --port 或 547
 *   --mac <mac>      指定客户端MAC（用于生成DUID），默认随机
 *
 * 示例：
 *   node scripts/testDhcpClient.js --server 127.0.0.1
 *   node scripts/testDhcpClient.js --server 127.0.0.1 --port 1067
 *   node scripts/testDhcpClient.js --server 127.0.0.1 --count 3 --release
 *   node scripts/testDhcpClient.js --v6 --server6 ::1
 *   node scripts/testDhcpClient.js --v6 --server6 ::1 --port6 1547
 *   node scripts/testDhcpClient.js --v6 --server6 ::1 --count 3 --release
 */

'use strict';

const dgram = require('dgram');

// ========== 命令行参数 ==========
const args = process.argv.slice(2);
function getArg(name, def) {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : def;
}
const USE_V6 = args.includes('--v6');
const SERVER_ADDR = getArg('--server', '255.255.255.255');
const SERVER6_ADDR = getArg('--server6', '::1');
const CLIENT_COUNT = parseInt(getArg('--count', '1'), 10);
const TIMEOUT_MS = parseInt(getArg('--timeout', '5000'), 10);
const DO_RELEASE = args.includes('--release');
const CUSTOM_MAC = getArg('--mac', null);
const DHCP_SERVER_PORT = parsePortArg('--port', 67);
const DHCP6_SERVER_PORT = parsePortArg('--port6', DHCP_SERVER_PORT === 67 ? 547 : DHCP_SERVER_PORT);

// ========== 公共工具 ==========
function parseMac(str) {
    const parts = str.split(/[:-]/).map(s => parseInt(s, 16));
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

function parsePortArg(name, defaultValue) {
    const raw = getArg(name, String(defaultValue));
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${name} 端口非法: ${raw}`);
    }
    return port;
}

// ============================================================
// DHCPv4
// ============================================================
const MAGIC_COOKIE = Buffer.from([99, 130, 83, 99]);
const MSG_TYPE = { DISCOVER: 1, OFFER: 2, REQUEST: 3, ACK: 5, NAK: 6, RELEASE: 7 };

function randomXid() {
    return (Math.random() * 0xffffffff) >>> 0;
}

function ipToBuffer(ip) {
    return Buffer.from(ip.split('.').map(Number));
}

function bufToIp(buf, offset = 0) {
    return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
}

function buildPacket(msgType, xid, macBuf, extraOptions = []) {
    const buf = Buffer.alloc(576, 0);
    buf.writeUInt8(1, 0); // op: BOOTREQUEST
    buf.writeUInt8(1, 1); // htype: Ethernet
    buf.writeUInt8(6, 2); // hlen
    buf.writeUInt8(0, 3); // hops
    buf.writeUInt32BE(xid, 4);
    buf.writeUInt16BE(0, 8); // secs
    buf.writeUInt16BE(0x8000, 10); // flags: broadcast
    macBuf.copy(buf, 28); // chaddr
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
    buf.writeUInt8(255, off++); // End

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
    buf.writeUInt8(53, off++);
    buf.writeUInt8(1, off++);
    buf.writeUInt8(MSG_TYPE.RELEASE, off++);
    buf.writeUInt8(54, off++);
    buf.writeUInt8(4, off++);
    ipToBuffer(serverIp).copy(buf, off);
    off += 4;
    buf.writeUInt8(255, off++);

    return buf.slice(0, off);
}

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
    if (pkt.options[1]?.length >= 4) pkt.subnetMask = bufToIp(pkt.options[1], 0);
    if (pkt.options[3]?.length >= 4) pkt.router = bufToIp(pkt.options[3], 0);
    if (pkt.options[6]) {
        pkt.dns = [];
        for (let j = 0; j + 4 <= pkt.options[6].length; j += 4) pkt.dns.push(bufToIp(pkt.options[6], j));
    }

    return pkt;
}

function runDhcp4Session(socket, macBuf, sessionId) {
    const xid = randomXid();
    const tag = `[客户端${sessionId}][DHCPv4][${macStr(macBuf)}]`;

    return new Promise((resolve, reject) => {
        let step = 'discover';
        let timer = null;

        const fail = msg => {
            clearTimeout(timer);
            reject(new Error(`${tag} ${msg}`));
        };
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
                console.log(
                    `       租约时间: ${
                        pkt.leaseTime !== undefined && pkt.leaseTime !== null ? pkt.leaseTime + ' 秒' : '-'
                    }`
                );

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

// ============================================================
// DHCPv6
// ============================================================
const DHCP6_MSG = { SOLICIT: 1, ADVERTISE: 2, REQUEST: 3, REPLY: 7, RELEASE: 8 };
const DHCP6_OPT = { CLIENTID: 1, SERVERID: 2, IA_NA: 3, IAADDR: 5, ORO: 6, ELAPSED_TIME: 8, DNS_SERVERS: 23 };

// DUID-LL: type(2)=3 + hw-type(2)=1 + mac(6)
function buildDuidLL(macBuf) {
    const duid = Buffer.alloc(10);
    duid.writeUInt16BE(3, 0);
    duid.writeUInt16BE(1, 2);
    macBuf.copy(duid, 4);
    return duid;
}

// DHCPv6 TLV option
function buildOpt6(code, data) {
    const buf = Buffer.alloc(4 + data.length);
    buf.writeUInt16BE(code, 0);
    buf.writeUInt16BE(data.length, 2);
    data.copy(buf, 4);
    return buf;
}

// IA_NA option body: IAID(4) + T1(4) + T2(4) + sub-options
function buildIaNA(iaid, subOptBuf) {
    const body = Buffer.alloc(12 + (subOptBuf ? subOptBuf.length : 0));
    body.writeUInt32BE(iaid, 0);
    body.writeUInt32BE(0, 4); // T1 = 0 (server determines)
    body.writeUInt32BE(0, 8); // T2 = 0
    if (subOptBuf) subOptBuf.copy(body, 12);
    return buildOpt6(DHCP6_OPT.IA_NA, body);
}

// IAADDR sub-option: addr(16) + preferred(4) + valid(4) + sub-opts
function buildIaAddr(addrBuf) {
    const body = Buffer.alloc(24);
    addrBuf.copy(body, 0);
    body.writeUInt32BE(0, 16);
    body.writeUInt32BE(0, 20);
    return buildOpt6(DHCP6_OPT.IAADDR, body);
}

// Random 3-byte transaction ID
function randomTxId() {
    return [(Math.random() * 256) >>> 0, (Math.random() * 256) >>> 0, (Math.random() * 256) >>> 0];
}

function txIdMatch(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// Build DHCPv6 message: msgType(1) + txId(3) + options
function buildDhcp6Msg(msgType, txId, optBufs) {
    const optsBuf = Buffer.concat(optBufs);
    const buf = Buffer.alloc(4 + optsBuf.length);
    buf.writeUInt8(msgType, 0);
    buf.writeUInt8(txId[0], 1);
    buf.writeUInt8(txId[1], 2);
    buf.writeUInt8(txId[2], 3);
    optsBuf.copy(buf, 4);
    return buf;
}

// Parse DHCPv6 options from buffer slice [offset, end)
function parseDhcp6Opts(buf, offset, end) {
    const opts = {};
    while (offset + 4 <= end) {
        const code = buf.readUInt16BE(offset);
        const len = buf.readUInt16BE(offset + 2);
        offset += 4;
        opts[code] = buf.slice(offset, offset + len);
        offset += len;
    }
    return opts;
}

// Parse full DHCPv6 packet
function parseDhcp6Pkt(buf) {
    if (buf.length < 4) return null;
    return {
        msgType: buf.readUInt8(0),
        txId: [buf.readUInt8(1), buf.readUInt8(2), buf.readUInt8(3)],
        opts: parseDhcp6Opts(buf, 4, buf.length)
    };
}

// Extract IAADDR info from IA_NA option body
function extractIaAddr(ianaBuf) {
    if (!ianaBuf || ianaBuf.length < 12) return null;
    const subOpts = parseDhcp6Opts(ianaBuf, 12, ianaBuf.length);
    const iaaddrData = subOpts[DHCP6_OPT.IAADDR];
    if (!iaaddrData || iaaddrData.length < 24) return null;
    return {
        addrBuf: iaaddrData.slice(0, 16),
        addrStr: bufToIpv6(iaaddrData.slice(0, 16)),
        preferredLifetime: iaaddrData.readUInt32BE(16),
        validLifetime: iaaddrData.readUInt32BE(20)
    };
}

// 16-byte buffer -> IPv6 string (no compression, but valid)
function bufToIpv6(buf) {
    const groups = [];
    for (let i = 0; i < 16; i += 2) groups.push(buf.readUInt16BE(i).toString(16));
    return groups.join(':');
}

// IPv6 DNS option -> array of address strings
function parseDnsServers(dnsBuf) {
    if (!dnsBuf) return [];
    const addrs = [];
    for (let i = 0; i + 16 <= dnsBuf.length; i += 16) addrs.push(bufToIpv6(dnsBuf.slice(i, i + 16)));
    return addrs;
}

function runDhcp6Session(socket, macBuf, sessionId) {
    const txId = randomTxId();
    const clientDuid = buildDuidLL(macBuf);
    const iaid = (Math.random() * 0xffffffff) >>> 0;
    const tag = `[客户端${sessionId}][DHCPv6][${macStr(macBuf)}]`;

    return new Promise((resolve, reject) => {
        let step = 'solicit';
        let timer = null;
        let serverDuid = null;
        let advertisedAddr = null; // { addrBuf, addrStr, preferredLifetime, validLifetime }

        const fail = msg => {
            clearTimeout(timer);
            reject(new Error(`${tag} ${msg}`));
        };
        const startTimer = label => {
            clearTimeout(timer);
            timer = setTimeout(() => fail(`等待 ${label} 超时 (${TIMEOUT_MS}ms)`), TIMEOUT_MS);
        };

        const onMessage = (msg, _rinfo) => {
            const pkt = parseDhcp6Pkt(msg);
            if (!pkt || !txIdMatch(pkt.txId, txId)) return;

            if (step === 'solicit' && pkt.msgType === DHCP6_MSG.ADVERTISE) {
                clearTimeout(timer);
                serverDuid = pkt.opts[DHCP6_OPT.SERVERID];
                const iana = pkt.opts[DHCP6_OPT.IA_NA];
                advertisedAddr = extractIaAddr(iana);

                console.log(`${tag} [2/4] 收到 ADVERTISE`);
                console.log(`       提供IP:         ${advertisedAddr?.addrStr || '(无)'}`);
                console.log(`       首选生命周期:   ${advertisedAddr?.preferredLifetime ?? '-'} 秒`);
                console.log(`       有效生命周期:   ${advertisedAddr?.validLifetime ?? '-'} 秒`);
                console.log(
                    `       DNS:            ${parseDnsServers(pkt.opts[DHCP6_OPT.DNS_SERVERS]).join(', ') || '-'}`
                );

                if (!advertisedAddr || !serverDuid) {
                    return fail('ADVERTISE 中无可用地址或 ServerID');
                }

                step = 'request';
                const reqPkt = buildDhcp6Msg(DHCP6_MSG.REQUEST, txId, [
                    buildOpt6(DHCP6_OPT.CLIENTID, clientDuid),
                    buildOpt6(DHCP6_OPT.SERVERID, serverDuid),
                    buildIaNA(iaid, buildIaAddr(advertisedAddr.addrBuf)),
                    buildOpt6(DHCP6_OPT.ORO, Buffer.from([0x00, DHCP6_OPT.DNS_SERVERS])),
                    buildOpt6(DHCP6_OPT.ELAPSED_TIME, Buffer.from([0, 0]))
                ]);

                console.log(`${tag} [3/4] 发送 REQUEST -> ${advertisedAddr.addrStr}`);
                socket.send(reqPkt, 0, reqPkt.length, DHCP6_SERVER_PORT, SERVER6_ADDR, err => {
                    if (err) return fail(`发送 REQUEST 失败: ${err.message}`);
                    startTimer('REPLY');
                });
            } else if (step === 'request' && pkt.msgType === DHCP6_MSG.REPLY) {
                clearTimeout(timer);
                const iana = pkt.opts[DHCP6_OPT.IA_NA];
                const assignedAddr = extractIaAddr(iana) || advertisedAddr;

                console.log(`${tag} [4/4] 收到 REPLY -> 租约成功！IP = ${assignedAddr.addrStr}`);
                socket.removeListener('message', onMessage);

                if (DO_RELEASE) {
                    const relPkt = buildDhcp6Msg(DHCP6_MSG.RELEASE, txId, [
                        buildOpt6(DHCP6_OPT.CLIENTID, clientDuid),
                        buildOpt6(DHCP6_OPT.SERVERID, serverDuid),
                        buildIaNA(iaid, buildIaAddr(assignedAddr.addrBuf)),
                        buildOpt6(DHCP6_OPT.ELAPSED_TIME, Buffer.from([0, 0]))
                    ]);
                    socket.send(relPkt, 0, relPkt.length, DHCP6_SERVER_PORT, SERVER6_ADDR, err => {
                        if (err) console.warn(`${tag} RELEASE 发送失败: ${err.message}`);
                        else console.log(`${tag} [+]   发送 RELEASE（${assignedAddr.addrStr} 已归还）`);
                        resolve({
                            duid: clientDuid.toString('hex'),
                            ip: assignedAddr.addrStr,
                            validLifetime: assignedAddr.validLifetime
                        });
                    });
                } else {
                    resolve({
                        duid: clientDuid.toString('hex'),
                        ip: assignedAddr.addrStr,
                        validLifetime: assignedAddr.validLifetime
                    });
                }
            }
        };

        socket.on('message', onMessage);

        const solPkt = buildDhcp6Msg(DHCP6_MSG.SOLICIT, txId, [
            buildOpt6(DHCP6_OPT.CLIENTID, clientDuid),
            buildIaNA(iaid, null),
            buildOpt6(DHCP6_OPT.ORO, Buffer.from([0x00, DHCP6_OPT.DNS_SERVERS])),
            buildOpt6(DHCP6_OPT.ELAPSED_TIME, Buffer.from([0, 0]))
        ]);

        console.log(`${tag} [1/4] 发送 SOLICIT -> ${SERVER6_ADDR}:${DHCP6_SERVER_PORT}`);
        socket.send(solPkt, 0, solPkt.length, DHCP6_SERVER_PORT, SERVER6_ADDR, err => {
            if (err) return fail(`发送 SOLICIT 失败: ${err.message}`);
            startTimer('ADVERTISE');
        });
    });
}

// ============================================================
// 主流程
// ============================================================
async function main() {
    console.log('============================================================');
    console.log(`  DHCP${USE_V6 ? 'v6' : 'v4'} 客户端测试`);
    console.log('============================================================');
    if (USE_V6) {
        console.log(`  服务器地址: ${SERVER6_ADDR}:${DHCP6_SERVER_PORT}`);
    } else {
        console.log(`  服务器地址: ${SERVER_ADDR}:${DHCP_SERVER_PORT}`);
    }
    console.log(`  客户端数量: ${CLIENT_COUNT}`);
    console.log(`  租约后释放: ${DO_RELEASE ? '是' : '否'}`);
    console.log(`  超时时间:   ${TIMEOUT_MS} ms`);
    console.log('============================================================\n');

    const macs =
        CLIENT_COUNT === 1 && CUSTOM_MAC
            ? [parseMac(CUSTOM_MAC)]
            : Array.from({ length: CLIENT_COUNT }, () => randomMac());

    let results;

    if (USE_V6) {
        // DHCPv6: UDP6 socket，绑定到系统分配端口（无需 root）
        const socket = dgram.createSocket({ type: 'udp6', reuseAddr: true });
        const boundPort = await new Promise((resolve, reject) => {
            socket.on('error', reject);
            socket.bind(0, '::', () => resolve(socket.address().port));
        });
        console.log(`套接字就绪，监听端口 ${boundPort}（服务器响应将发回此端口）\n`);

        results = await Promise.allSettled(macs.map((mac, i) => runDhcp6Session(socket, mac, i + 1)));
        socket.close();

        console.log('\n============================================================');
        console.log('  测试结果');
        console.log('============================================================');
        let success = 0,
            failed = 0;
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                const v = r.value;
                console.log(`  [成功] 客户端${i + 1}: IP=${v.ip}  有效生命周期=${v.validLifetime}s`);
                console.log(`         DUID=${v.duid}`);
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
    } else {
        // DHCPv4: UDP4 socket，绑定到系统分配端口（无需 root）
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        const boundPort = await new Promise((resolve, reject) => {
            socket.on('error', reject);
            socket.bind(0, '0.0.0.0', () => {
                socket.setBroadcast(true);
                resolve(socket.address().port);
            });
        });
        console.log(`套接字就绪，监听端口 ${boundPort}（服务器响应将发回此端口）\n`);

        results = await Promise.allSettled(macs.map((mac, i) => runDhcp4Session(socket, mac, i + 1)));
        socket.close();

        console.log('\n============================================================');
        console.log('  测试结果');
        console.log('============================================================');
        let success = 0,
            failed = 0;
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
}

main().catch(err => {
    console.error('\n[错误]', err.message);
    process.exit(1);
});
