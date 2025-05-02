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
 * 将 8 字节的 RD buffer 转换为字符串
 * @param {Buffer} buffer - 8 字节的 RD buffer
 * @returns {string} - 格式化的 RD 字符串
 */
function rdBufferToString(buffer) {
    if (buffer.length !== 8) {
        throw new Error('Invalid RD buffer length. Expected 8 bytes.');
    }

    const highOrder = buffer.readUInt32BE(0);
    const lowOrder = buffer.readUInt32BE(4);

    return `${highOrder}:${lowOrder}`;
}

/**
 * 根据地址族和子地址族转为UI的地址组类型
 * @param {BGP_AFI_TYPE} afi 地址族
 * @param {BGP_SAFI_TYPE} safi 子地址族
 */
function getAddrFamilyType(afi, safi) {
    let addrFamily;
    switch (afi) {
        case BgpConst.BGP_AFI_TYPE.AFI_IPV4:
            if (safi == BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST) {
                addrFamily = BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST;
            }
            break;
        case BgpConst.BGP_AFI_TYPE.AFI_IPV6:
            if (safi == BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST) {
                addrFamily = BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST;
            }
            break;
    }

    return addrFamily;
}

function getAfiAndSafi(addrFamily) {
    let afi;
    let safi;
    switch (addrFamily) {
        case BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV4_UNICAST:
            afi = BgpConst.BGP_AFI_TYPE.AFI_IPV4;
            safi = BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST;
            break;
        case BgpConst.BGP_ADDR_FAMILY_UI.ADDR_FAMILY_IPV6_UNICAST:
            afi = BgpConst.BGP_AFI_TYPE.AFI_IPV6;
            safi = BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST;
            break;
    }

    return { afi, safi };
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

module.exports = {
    genRouteIps,
    writeUInt16,
    writeUInt32,
    ipToBytes,
    rdBufferToString,
    getAddrFamilyType,
    getAfiAndSafi,
    getIpType
};
