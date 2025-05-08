const { parentPort } = require('worker_threads');
const { parseBgpPacketTree } = require('../pktParser/bgpPacketTreeParser');
const registry = require('../pktParser/packetParserRegistry');
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
            case 'ethernet': {
                // 解析以太网报文
                result = registry.parsePacket(buffer);
                break;
            }
            default:
                result = {
                    status: 'error',
                    msg: `不支持的报文类型: ${packetType}`
                };
        }
        if (result.status === 'success') {
            parentPort.postMessage({ status: 'success', data: result.tree });
        } else {
            parentPort.postMessage({
                status: 'error',
                msg: `解析报文时出错: ${result.msg}`
            });
        }
    } catch (err) {
        parentPort.postMessage({
            status: 'error',
            msg: `解析报文时出错: ${err.message}`
        });
    }
});
