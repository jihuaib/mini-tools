const { parentPort } = require('worker_threads');
const { parseBgpPacket } = require('../pktParser/bgpPacketParser');
const registry = require('../pktParser/packetParserRegistry');
const { hexStringToBuffer } = require('../utils/commonUtils');
const { PROTOCOL_TYPE, START_LAYER } = require('../const/toolsConst');

// 处理传入的消息
parentPort.on('message', data => {
    try {
        // 转换十六进制字符串为Buffer
        const buffer = hexStringToBuffer(data.packetData);

        let result = {
            status: 'error',
            msg: '不支持的报文类型或解析层级'
        };

        // 如果提供了协议端口，先注册端口解析器
        let customBgpPort = null;
        if (data.protocolType === PROTOCOL_TYPE.BGP) {
            if (data.protocolPort && data.protocolPort !== '') {
                customBgpPort = parseInt(data.protocolPort);
                // 注册BGP解析器到指定端口，第四个参数为true表明这是一个应用层协议
                registry.registerParser('bgp', customBgpPort, parseBgpPacket, true);
            } else {
                // 使用默认BGP端口
                customBgpPort = 179;
                registry.registerParser('bgp', customBgpPort, parseBgpPacket, true);
            }
        } else {
            customBgpPort = 179;
            registry.registerParser('bgp', customBgpPort, parseBgpPacket, true);
        }

        try {
            switch (data.startLayer) {
                case START_LAYER.L5: {
                    // 直接解析应用层协议
                    if (data.protocolType === PROTOCOL_TYPE.BGP) {
                        // 解析BGP报文
                        const tree = {
                            name: 'BGP Packet ' + buffer.length + ' bytes',
                            offset: 0,
                            length: buffer.length,
                            value: '',
                            children: []
                        };

                        const parseResult = parseBgpPacket(buffer, tree, 0);
                        if (parseResult.valid) {
                            result = {
                                status: 'success',
                                tree
                            };
                        } else {
                            result = {
                                status: 'error',
                                msg: `解析BGP报文时出错: ${parseResult.error}`
                            };
                        }
                    }
                    break;
                }
                case START_LAYER.L2: {
                    // 从数据链路层开始解析 (以太网)
                    result = registry.parsePacket(buffer);
                    break;
                }
                case START_LAYER.L3: {
                    // 从网络层开始解析 (IP)
                    // 判断IP版本: 第一个字节的高4位是版本号
                    const ipVersion = (buffer[0] >> 4) & 0x0f;
                    const tree = {
                        name: `IP Packet ${buffer.length} bytes`,
                        offset: 0,
                        length: buffer.length,
                        value: '',
                        children: []
                    };

                    // 根据IP版本选择解析器
                    const ipType = ipVersion === 6 ? 0x86dd : 0x0800; // IPv6 or IPv4
                    const parseResult = registry.parse('ip', ipType, tree, buffer, 0);

                    if (parseResult.valid) {
                        result = {
                            status: 'success',
                            tree
                        };
                    } else {
                        result = {
                            status: 'error',
                            msg: `解析IP报文时出错: ${parseResult.error}`
                        };
                    }
                    break;
                }
                case START_LAYER.L4: {
                    // 从传输层开始解析 (TCP/UDP)
                    // 获取第一个字节的前半部分来判断协议类型
                    const protocol = buffer[0]; // TCP=6, UDP=17
                    const tree = {
                        name: `Transport Protocol ${buffer.length} bytes`,
                        offset: 0,
                        length: buffer.length,
                        value: '',
                        children: []
                    };

                    // 解析TCP/UDP
                    const parseResult = registry.parse('tcp', protocol, tree, buffer, 0);

                    if (parseResult.valid) {
                        result = {
                            status: 'success',
                            tree
                        };
                    } else {
                        result = {
                            status: 'error',
                            msg: `解析传输层报文时出错: ${parseResult.error}`
                        };
                    }
                    break;
                }
                default:
                    result = {
                        status: 'error',
                        msg: `不支持的起始层级: ${data.startLayer}`
                    };
            }
        } finally {
            // 清理注册的解析器，防止影响后续解析
            if (data.protocolType === PROTOCOL_TYPE.BGP && customBgpPort) {
                registry.unregisterParser('bgp', customBgpPort);
            }
        }

        if (result.status === 'success') {
            parentPort.postMessage({
                status: 'success',
                data: { tree: result.tree }
            });
        } else {
            parentPort.postMessage({
                status: 'error',
                msg: result.msg
            });
        }
    } catch (err) {
        parentPort.postMessage({
            status: 'error',
            msg: `解析报文时出错: ${err.message}`
        });
    }
});
