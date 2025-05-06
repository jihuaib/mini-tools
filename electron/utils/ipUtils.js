const ipaddr = require('ipaddr.js');
const BgpConst = require('../const/bgpConst');

/**
 * Generate a list of IP networks based on route type, IP, mask and count
 * @param {number} routeType - IP_TYPE.IPV4 or IP_TYPE.IPV6
 * @param {string} routeIp - Starting IP address
 * @param {number} routeMask - Network mask
 * @param {number} routeCnt - Number of routes to generate
 * @returns {Array} Array of objects containing IP and mask
 */
function genRouteIps(routeType, routeIp, routeMask, routeCnt) {
    const routes = [];

    if (routeType === BgpConst.IP_TYPE.IPV4) {
        const baseAddress = ipaddr.parse(routeIp);
        const baseBytes = baseAddress.toByteArray();
        let baseInt = (baseBytes[0] << 24) | (baseBytes[1] << 16) | (baseBytes[2] << 8) | baseBytes[3];

        const step = routeMask === 32 ? 1 : Math.pow(2, 32 - routeMask);

        for (let i = 0; i < routeCnt; i++) {
            const currentInt = baseInt + i * step;
            const bytes = [
                (currentInt >> 24) & 0xff,
                (currentInt >> 16) & 0xff,
                (currentInt >> 8) & 0xff,
                currentInt & 0xff
            ];
            const ip = ipaddr.fromByteArray(bytes);
            const networkAddress = ipaddr.IPv4.networkAddressFromCIDR(`${ip}/${routeMask}`);
            routes.push({
                ip: networkAddress.toString(),
                mask: routeMask
            });
        }
    } else if (routeType === BgpConst.IP_TYPE.IPV6) {
        const baseAddress = ipaddr.parse(routeIp);
        const baseBytes = baseAddress.toByteArray(); // 16 bytes
        let baseBigInt = BigInt(0);
        for (let i = 0; i < 16; i++) {
            baseBigInt = (baseBigInt << 8n) + BigInt(baseBytes[i]);
        }

        const step = routeMask === 128 ? 1n : 1n << BigInt(128 - routeMask);

        for (let i = 0n; i < BigInt(routeCnt); i++) {
            const currentBigInt = baseBigInt + i * step;
            const bytes = [];
            for (let j = 15; j >= 0; j--) {
                bytes[j] = Number((currentBigInt >> BigInt((15 - j) * 8)) & 0xffn);
            }
            const ip = ipaddr.fromByteArray(bytes);
            const networkAddress = ipaddr.IPv6.networkAddressFromCIDR(`${ip}/${routeMask}`);
            routes.push({
                ip: networkAddress.toString(),
                mask: routeMask
            });
        }
    }

    return routes;
}

/**
 * 将一个 16 位无符号整数转换为两个字节（Big Endian）
 * @param {number} value - 0~65535
 * @returns {number[]} - 两个字节的数组 [high, low]
 */
function writeUInt16(value) {
    return [(value >> 8) & 0xff, value & 0xff];
}

/**
 * 将一个 32 位无符号整数转换为四个字节（Big Endian）
 * @param {number} value - 0~2^32-1
 * @returns {number[]} - 四个字节的数组
 */
function writeUInt32(value) {
    return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * 通用 IP 转字节（支持 IPv4 和 IPv6）
 * @param {string} ip - IP 地址字符串
 * @returns {number[]} - IPv4 返回 4 字节，IPv6 返回 16 字节
 */
function ipToBytes(ip) {
    const addr = ipaddr.parse(ip);
    return addr.toByteArray();
}

/**
 * 将 8 字节 RD Buffer 转换为字符串形式
 * 支持三种格式：Type 0, Type 1, Type 2
 * @param {Buffer} buffer - 长度为 8 的 Buffer
 * @returns {string} - 可读的 RD 字符串（如 '65000:100'）
 */
function rdBufferToString(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length !== 8) {
        throw new Error('RD must be a Buffer of length 8');
    }

    const type = buffer.readUInt16BE(0); // 前2字节是 Type
    let admin, assigned;

    switch (type) {
        case 0:
            // Type 0: Admin (2 bytes) + Assigned (4 bytes)
            admin = buffer.readUInt16BE(2);
            assigned = buffer.readUInt32BE(4);
            return `${admin}:${assigned}`;

        case 1:
            // Type 1: Admin (4 bytes IP) + Assigned (2 bytes)
            admin = Array.from(buffer.slice(2, 6)).join('.');
            assigned = buffer.readUInt16BE(6);
            return `${admin}:${assigned}`;

        case 2:
            // Type 2: Admin (4 bytes ASN) + Assigned (2 bytes)
            admin = buffer.readUInt32BE(2);
            assigned = buffer.readUInt16BE(6);
            return `${admin}:${assigned}`;

        default:
            return `unknown(${type})`;
    }
}

function ipv4BufferToString(buffer, length) {
    const fullBytes = Math.floor(length / 8);
    const remainingBits = length % 8;

    const ipBuffer = Buffer.alloc(4);
    buffer.copy(ipBuffer, 0, 0, buffer.length);

    if (remainingBits > 0 && fullBytes < 4) {
        const mask = 0xff & (0xff << (8 - remainingBits));
        ipBuffer[fullBytes] &= mask;
    }

    return Array.from(ipBuffer).join('.');
}

function ipv6BufferToString(buffer, length) {
    const fullBytes = Math.floor(length / 8);
    const remainingBits = length % 8;

    const ipBuffer = Buffer.alloc(16);
    buffer.copy(ipBuffer, 0, 0, buffer.length);

    if (remainingBits > 0 && fullBytes < 16) {
        const mask = 0xff & (0xff << (8 - remainingBits));
        ipBuffer[fullBytes] &= mask;
    }

    const segments = [];
    for (let i = 0; i < 16; i += 2) {
        segments.push(ipBuffer.readUInt16BE(i).toString(16));
    }

    // 简化为 "::" 格式
    return segments
        .join(':')
        .replace(/(^|:)0(:0)+(:|$)/, '::')
        .replace(/:{3,}/g, '::');
}

// 判断地址是ipv4还是ipv6
function getIpType(ip) {
    if (ipaddr.IPv4.isIPv4(ip)) {
        return BgpConst.IP_TYPE.IPV4;
    } else if (ipaddr.IPv6.isIPv6(ip)) {
        return BgpConst.IP_TYPE.IPV6;
    }

    return null;
}

/**
 * Get IP type name from code
 * @param {Number} ipType - IP type code
 * @returns {String} IP type name
 */
 function getIpTypeName(ipType) {
    return ipType === BgpConst.IP_TYPE.IPV4 ? 'IPv4' : 'IPv6';
}

module.exports = {
    genRouteIps,
    writeUInt16,
    writeUInt32,
    ipToBytes,
    rdBufferToString,
    getIpType,
    ipv4BufferToString,
    ipv6BufferToString,
    getIpTypeName
};
