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
        const network = ipaddr.parseCIDR(`${routeIp}/${routeMask}`);
        const baseAddress = network[0];

        for (let i = 0; i < routeCnt; i++) {
            let ip;
            if (routeMask === 32) {
                // For /32, increment the last octet
                const bytes = baseAddress.toByteArray();
                bytes[3] = (bytes[3] + i + 1) % 256;
                ip = ipaddr.fromByteArray(bytes);
            } else {
                // For other masks, calculate the offset in the network
                const offset = i * Math.pow(2, 32 - routeMask);
                const bytes = baseAddress.toByteArray();
                let carry = offset;
                for (let j = 3; j >= 0; j--) {
                    const sum = bytes[j] + carry;
                    bytes[j] = sum % 256;
                    carry = Math.floor(sum / 256);
                }
                ip = ipaddr.fromByteArray(bytes);
            }
            const networkAddress = ipaddr.IPv4.networkAddressFromCIDR(`${ip}/${routeMask}`);
            routes.push({
                ip: networkAddress.toString(),
                mask: routeMask
            });
        }
    } else if (routeType === BGP_AFI_TYPE_UI.AFI_IPV6) {
        const network = ipaddr.parseCIDR(`${routeIp}/${routeMask}`);
        const baseAddress = network[0];

        for (let i = 0; i < routeCnt; i++) {
            let ip;
            if (routeMask === 128) {
                // For /128, increment the last 16 bytes
                const parts = baseAddress.toByteArray();
                parts[15] = (parts[15] + i + 1) % 256;
                ip = ipaddr.fromByteArray(parts);
            } else {
                // For other masks, calculate the offset in the network
                const offset = i * Math.pow(2, 128 - routeMask);
                const parts = baseAddress.toByteArray();
                let carry = offset;
                for (let j = 15; j >= 0; j--) {
                    const sum = parts[j] + carry;
                    parts[j] = sum % 256;
                    carry = Math.floor(sum / 256);
                }
                ip = ipaddr.fromByteArray(parts);
            }
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
