#!/usr/bin/env node
/**
 * NTP 客户端测试脚本
 *
 * 使用方法：
 *   node scripts/testNtpClient.js [选项]
 *
 * 选项：
 *   --server <ip>    NTP服务器地址，默认 127.0.0.1；使用 --v6 时默认 ::1
 *   --port <n>       NTP服务器端口，默认 123
 *   --count <n>      连续请求次数，默认 1
 *   --timeout <ms>   单次请求超时，默认 3000
 *   --version <n>    NTP版本，默认 4
 *   --v6             强制使用 IPv6 socket
 *
 * 示例：
 *   node scripts/testNtpClient.js --server 127.0.0.1 --port 1123
 *   node scripts/testNtpClient.js --server ::1 --port 1123 --v6
 */

'use strict';

const dgram = require('dgram');
const net = require('net');

const NTP_EPOCH_OFFSET_MS = 2208988800000;
const NTP_FRACTION_SCALE = 0x100000000;
const NTP_SHORT_SCALE = 0x10000;

const args = process.argv.slice(2);

function getArg(name, defaultValue) {
    const index = args.indexOf(name);
    return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

function parsePortArg(name, defaultValue) {
    const raw = getArg(name, String(defaultValue));
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${name} 端口非法: ${raw}`);
    }
    return port;
}

function parsePositiveInt(name, defaultValue) {
    const raw = getArg(name, String(defaultValue));
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} 参数非法: ${raw}`);
    }
    return value;
}

const HAS_V6_FLAG = args.includes('--v6');
const SERVER_ADDR = getArg('--server', HAS_V6_FLAG ? '::1' : '127.0.0.1');
const SERVER_PORT = parsePortArg('--port', 123);
const REQUEST_COUNT = parsePositiveInt('--count', 1);
const TIMEOUT_MS = parsePositiveInt('--timeout', 3000);
const NTP_VERSION = parsePositiveInt('--version', 4);
const USE_IPV6 = HAS_V6_FLAG || net.isIPv6(SERVER_ADDR);

if (NTP_VERSION < 1 || NTP_VERSION > 4) {
    throw new Error(`--version 仅支持 1-4，当前值: ${NTP_VERSION}`);
}
if (USE_IPV6 && net.isIPv4(SERVER_ADDR)) {
    throw new Error(`--v6 模式下 --server 必须是 IPv6 地址，当前值: ${SERVER_ADDR}`);
}

function modeName(mode) {
    const names = {
        0: 'Reserved',
        1: 'Sym Active',
        2: 'Sym Passive',
        3: 'Client',
        4: 'Server',
        5: 'Broadcast',
        6: 'Control',
        7: 'Private'
    };
    return names[mode] || `Mode-${mode}`;
}

function writeTimestamp(buffer, offset, ms) {
    const ntpMs = ms + NTP_EPOCH_OFFSET_MS;
    const seconds = Math.floor(ntpMs / 1000);
    const remainderMs = ntpMs - seconds * 1000;
    const fraction = Math.floor((remainderMs / 1000) * NTP_FRACTION_SCALE);
    buffer.writeUInt32BE(seconds >>> 0, offset);
    buffer.writeUInt32BE(fraction >>> 0, offset + 4);
}

function readTimestamp(buffer, offset) {
    const seconds = buffer.readUInt32BE(offset);
    const fraction = buffer.readUInt32BE(offset + 4);
    if (seconds === 0 && fraction === 0) {
        return null;
    }
    return seconds * 1000 - NTP_EPOCH_OFFSET_MS + Math.round((fraction / NTP_FRACTION_SCALE) * 1000);
}

function readShortFormatMs(buffer, offset) {
    return Math.round((buffer.readUInt32BE(offset) / NTP_SHORT_SCALE) * 1000);
}

function formatTime(ms) {
    if (ms === null || ms === undefined) {
        return '-';
    }
    return new Date(ms).toISOString();
}

function formatReferenceId(buffer) {
    const ascii = buffer.toString('ascii').replace(/[^\x20-\x7e]/g, '.');
    return `${ascii} (0x${buffer.toString('hex')})`;
}

function buildRequestPacket(transmitMs) {
    const packet = Buffer.alloc(48, 0);
    packet.writeUInt8((0 << 6) | (NTP_VERSION << 3) | 3, 0);
    packet.writeUInt8(0, 1);
    packet.writeUInt8(4, 2);
    packet.writeInt8(-20, 3);
    writeTimestamp(packet, 40, transmitMs);
    return packet;
}

function parseResponse(buffer) {
    if (buffer.length < 48) {
        throw new Error(`响应长度不足 48 字节: ${buffer.length}`);
    }

    const firstByte = buffer.readUInt8(0);
    return {
        leapIndicator: firstByte >> 6,
        version: (firstByte >> 3) & 0x07,
        mode: firstByte & 0x07,
        stratum: buffer.readUInt8(1),
        poll: buffer.readUInt8(2),
        precision: buffer.readInt8(3),
        rootDelayMs: readShortFormatMs(buffer, 4),
        rootDispersionMs: readShortFormatMs(buffer, 8),
        referenceId: formatReferenceId(buffer.subarray(12, 16)),
        referenceTimestamp: readTimestamp(buffer, 16),
        originateTimestamp: readTimestamp(buffer, 24),
        receiveTimestamp: readTimestamp(buffer, 32),
        transmitTimestamp: readTimestamp(buffer, 40)
    };
}

function printResponse(index, response, clientSendMs, clientReceiveMs) {
    const t1 = clientSendMs;
    const t2 = response.receiveTimestamp;
    const t3 = response.transmitTimestamp;
    const t4 = clientReceiveMs;

    const offset = t2 !== null && t3 !== null ? ((t2 - t1 + (t3 - t4)) / 2).toFixed(3) : '-';
    const delay = t2 !== null && t3 !== null ? (t4 - t1 - (t3 - t2)).toFixed(3) : '-';

    console.log(`\n[请求 ${index}] 响应成功`);
    console.log(`  服务端模式:     ${modeName(response.mode)} (mode=${response.mode})`);
    console.log(`  版本/层级:      v${response.version} / stratum ${response.stratum}`);
    console.log(`  Poll/Precision: ${response.poll} / ${response.precision}`);
    console.log(`  Reference ID:   ${response.referenceId}`);
    console.log(`  Root Delay:     ${response.rootDelayMs} ms`);
    console.log(`  Root Dispersion:${response.rootDispersionMs} ms`);
    console.log(`  Reference Time: ${formatTime(response.referenceTimestamp)}`);
    console.log(`  Originate Time: ${formatTime(response.originateTimestamp)}`);
    console.log(`  Receive Time:   ${formatTime(response.receiveTimestamp)}`);
    console.log(`  Transmit Time:  ${formatTime(response.transmitTimestamp)}`);
    console.log(`  Client Recv:    ${formatTime(clientReceiveMs)}`);
    console.log(`  Clock Offset:   ${offset} ms`);
    console.log(`  Round Trip:     ${delay} ms`);
}

function requestOnce() {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket({ type: USE_IPV6 ? 'udp6' : 'udp4', reuseAddr: true });
        let timeout = null;
        let clientSendMs = null;

        const cleanup = () => {
            clearTimeout(timeout);
            socket.removeAllListeners();
            socket.close();
        };

        socket.on('error', error => {
            cleanup();
            reject(error);
        });

        socket.once('message', message => {
            const clientReceiveMs = Date.now();
            try {
                const response = parseResponse(message);
                cleanup();
                resolve({ response, clientSendMs, clientReceiveMs });
            } catch (error) {
                cleanup();
                reject(error);
            }
        });

        socket.bind(0, USE_IPV6 ? '::' : '0.0.0.0', () => {
            clientSendMs = Date.now();
            const packet = buildRequestPacket(clientSendMs);

            timeout = setTimeout(() => {
                cleanup();
                reject(new Error(`等待响应超时 (${TIMEOUT_MS} ms)`));
            }, TIMEOUT_MS);

            socket.send(packet, 0, packet.length, SERVER_PORT, SERVER_ADDR, error => {
                if (error) {
                    cleanup();
                    reject(error);
                }
            });
        });
    });
}

async function main() {
    console.log('============================================================');
    console.log('  NTP 客户端测试');
    console.log('============================================================');
    console.log(`  服务器地址: ${SERVER_ADDR}:${SERVER_PORT}`);
    console.log(`  Socket类型: ${USE_IPV6 ? 'UDP6' : 'UDP4'}`);
    console.log(`  请求次数:   ${REQUEST_COUNT}`);
    console.log(`  超时时间:   ${TIMEOUT_MS} ms`);
    console.log(`  NTP版本:    v${NTP_VERSION}`);
    console.log('============================================================');

    let success = 0;
    let failed = 0;

    for (let index = 1; index <= REQUEST_COUNT; index++) {
        try {
            const { response, clientSendMs, clientReceiveMs } = await requestOnce();
            printResponse(index, response, clientSendMs, clientReceiveMs);
            success++;
        } catch (error) {
            console.log(`\n[请求 ${index}] 失败: ${error.message}`);
            failed++;
        }
    }

    console.log('\n============================================================');
    console.log(`  总计: ${success} 成功, ${failed} 失败`);
    console.log('============================================================');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error('执行失败:', error.message);
    process.exit(1);
});
