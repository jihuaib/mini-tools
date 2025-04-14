// bgpUtils.js

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
    return [
        (value >> 24) & 0xff,
        (value >> 16) & 0xff,
        (value >> 8) & 0xff,
        value & 0xff
    ];
}

/**
 * 将 IPv4 字符串地址（如 '192.168.1.1'）转换为字节数组 [192, 168, 1, 1]
 * @param {string} ip - 点分十进制 IP 地址
 * @returns {number[]}
 */
function ipToBytes(ip) {
    return ip.split('.').map(octet => parseInt(octet, 10));
}

module.exports = {
    writeUInt16,
    writeUInt32,
    ipToBytes
};
