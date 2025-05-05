const { parentPort } = require('worker_threads');
const { parseBgpPacketTree } = require('../utils/bgpPacketTreeParser');
const { hexStringToBuffer } = require('../utils/commonUtils');

// 处理传入的消息
parentPort.on('message', data => {
    try {
        const { packetType, packetData } = data;

        // 转换十六进制字符串为Buffer
        const buffer = hexStringToBuffer(packetData);

        let result;

        switch (packetType) {
            case 'bgp':
                // 解析BGP报文
                result = parseBgpPacketTree(buffer);
                break;
            default:
                result = {
                    status: 'error',
                    msg: `不支持的报文类型: ${packetType}`
                };
        }

        parentPort.postMessage({ status: 'success', data: result });
    } catch (err) {
        parentPort.postMessage({
            status: 'error',
            msg: `解析报文时出错: ${err.message}`
        });
    }
});
