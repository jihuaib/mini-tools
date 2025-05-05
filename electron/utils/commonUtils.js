function BIT_SET(flags, flag) {
    return flags | flag;
}

function BIT_RESET(flags, flag) {
    return flags & ~flag;
}

function BIT_TEST(flags, flag) {
    return (flags & flag) !== 0;
}

/**
 * 将十六进制字符串转换为Buffer对象
 * @param {string} hexString - 十六进制字符串
 * @return {Buffer} - 转换后的Buffer对象
 */
function hexStringToBuffer(hexString) {
    // 移除所有空格
    hexString = hexString.replace(/\s/g, '');

    // 确保字符串长度为偶数
    if (hexString.length % 2 !== 0) {
        hexString = '0' + hexString;
    }

    // 创建Buffer
    const buffer = Buffer.from(hexString, 'hex');
    return buffer;
}

module.exports = { BIT_SET, BIT_RESET, BIT_TEST, hexStringToBuffer };
