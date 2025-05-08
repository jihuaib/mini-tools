const { parseEthernetPacket } = require('./ethernetPacketParser');
const { parseIPv4Packet, parseIPv6Packet } = require('./ipPacketParser');
const { parseTcpPacket } = require('./tcpPacketParser');
const { parseUdpPacket } = require('./udpPacketParser');
const { parseBgpPacket } = require('./bgpPacketParser');

class ParserRegistry {
    constructor() {
        this.parsers = new Map();

        // 注册解析器
        // 数据链路层解析器
        this.registerParser('ethernet', 0, parseEthernetPacket);

        // 网络层解析器
        this.registerParser('ip', 0x0800, parseIPv4Packet);
        this.registerParser('ip', 0x86DD, parseIPv6Packet);

        // 传输层解析器
        this.registerParser('tcp', 6, parseTcpPacket);
        this.registerParser('udp', 17, parseUdpPacket);

        // 协议层解析器
        this.registerParser('bgp', 179, parseBgpPacket);  // BGP使用TCP端口179
    }

    /**
     * Register a parser for a specific protocol type
     * @param {string} layer - The protocol layer (e.g., 'ethernet', 'ip', 'tcp')
     * @param {number} type - The protocol type identifier
     * @param {Function} parser - The parser function
     */
    registerParser(layer, type, parser) {
        if (!this.parsers.has(layer)) {
            this.parsers.set(layer, new Map());
        }
        this.parsers.get(layer).set(type, parser);
    }

    parsePacket(buffer) {
        let curOffset = 0;
        const tree = {
            name: `Ethernet Frame ${buffer.length} bytes`,
            offset: curOffset,
            length: buffer.length - curOffset,
            value: '',
            children: []
        };

        const result = this.parse('ethernet', 0, tree, buffer, curOffset);
        if (!result.valid) {
            return {
                status: 'error',
                msg: result.error
            }
        }
        return {
            status: 'success',
            tree
        }
    }

    /**
     * Get a parser for a specific protocol type
     * @param {string} layer - The protocol layer
     * @param {number} type - The protocol type identifier
     * @returns {Function|null} The parser function or null if not found
     */
    getParser(layer, type) {
        const layerParsers = this.parsers.get(layer);
        if (!layerParsers) return null;
        return layerParsers.get(type) || null;
    }

    /**
     * Parse a packet using registered parsers
     * @param {string} layer - The starting protocol layer
     * @param {number} type - The protocol type
     * @param {Buffer} buffer - The packet buffer
     * @param {number} offset - The starting offset in the buffer
     * @returns {Object} The parse result
     */
    parse(layer, type, tree, buffer, offset = 0) {
        const parser = this.getParser(layer, type);
        if (!parser) {
            return {
                valid: false,
                error: `No parser registered for ${layer} type 0x${type.toString(16)}`
            };
        }

        try {
            const result = parser(buffer, tree, offset);
            if (!result.valid) return result;
            const payload = result.payload
            if (payload) {
                if (payload.type && payload.nextLayer) {
                    const result = this.parse(
                        payload.nextLayer,
                        payload.type,
                        tree,
                        buffer,
                        payload.offset
                    );
                    if (!result.valid) return result;
                }
            }

            return result;
        } catch (error) {
            return {
                valid: false,
                error: `Error parsing ${layer} packet: ${error.message}`
            };
        }
    }
}

// 创建并导出一个单例实例
const registry = new ParserRegistry();
module.exports = registry;
