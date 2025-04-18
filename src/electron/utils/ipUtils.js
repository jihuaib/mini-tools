const ipaddr = require('ipaddr.js');
const { BGP_AFI_TYPE_UI } = require('../const/bgpConst');

/**
 * Generate a list of IP networks based on route type, IP, mask and count
 * @param {number} routeType - BGP_AFI_TYPE_UI.AFI_IPV4 or BGP_AFI_TYPE_UI.AFI_IPV6
 * @param {string} routeIp - Starting IP address
 * @param {number} routeMask - Network mask
 * @param {number} routeCnt - Number of routes to generate
 * @returns {Array} Array of objects containing IP and mask
 */
function genRouteIps(routeType, routeIp, routeMask, routeCnt) {
    const routes = [];

    if (routeType === BGP_AFI_TYPE_UI.AFI_IPV4) {
        const baseAddress = ipaddr.parse(routeIp);
        const baseBytes = baseAddress.toByteArray();
        let baseInt = (
            (baseBytes[0] << 24) |
            (baseBytes[1] << 16) |
            (baseBytes[2] << 8) |
            baseBytes[3]
        );

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
    }

    else if (routeType === BGP_AFI_TYPE_UI.AFI_IPV6) {
        const baseAddress = ipaddr.parse(routeIp);
        const baseBytes = baseAddress.toByteArray(); // 16 bytes
        let baseBigInt = BigInt(0);
        for (let i = 0; i < 16; i++) {
            baseBigInt = (baseBigInt << 8n) + BigInt(baseBytes[i]);
        }

        const step = routeMask === 128 ? 1n : (1n << BigInt(128 - routeMask));

        for (let i = 0n; i < BigInt(routeCnt); i++) {
            const currentBigInt = baseBigInt + i * step;
            const bytes = [];
            for (let j = 15; j >= 0; j--) {
                bytes[j] = Number(currentBigInt >> BigInt((15 - j) * 8) & 0xffn);
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

module.exports = {
    genRouteIps
};
