/**
 * Parser Registry
 *
 * Registry for managing packet parsers for different protocol layers
 */

class ParserRegistry {
    constructor() {
        this.parsers = new Map();
        this.protocolPorts = new Map();
    }

    /**
     * Register a parser for a specific protocol type
     * @param {string} layer - The protocol layer (e.g., 'ethernet', 'ip', 'tcp')
     * @param {number} type - The protocol type identifier
     * @param {Function} parser - The parser function
     * @param {boolean} isProtocol - 是否是应用层协议，如果是则会记录到protocolPorts中
     */
    registerParser(layer, type, parser, isProtocol = false) {
        if (!this.parsers.has(layer)) {
            this.parsers.set(layer, new Map());
        }
        this.parsers.get(layer).set(type, parser);
        if (isProtocol) {
            // 记录协议对应的端口号
            this.protocolPorts.set(type, layer);
        }
    }

    /**
     * 获取指定端口对应的协议层
     * @param {number} port - 端口号
     * @returns {string|null} - 协议层名称，例如'bgp'
     */
    getProtocolByPort(port) {
        return this.protocolPorts.get(port) || null;
    }

    /**
     * 判断端口是否对应某个已注册的应用层协议
     * @param {number} port - 端口号
     * @returns {boolean} - 是否找到对应协议
     */
    hasProtocolForPort(port) {
        return this.protocolPorts.has(port);
    }

    /**
     * 取消注册某个协议解析器
     * @param {string} layer - 协议层名称
     * @param {number} port - 端口号（如果是应用层协议）
     */
    unregisterParser(layer, port = null) {
        if (port !== null) {
            // 如果提供了端口号，只删除该端口号对应的协议
            if (this.protocolPorts.has(port) && this.protocolPorts.get(port) === layer) {
                this.protocolPorts.delete(port);
            }

            // 如果该层有解析器，也从解析器中删除
            if (this.parsers.has(layer)) {
                this.parsers.get(layer).delete(port);
            }
        } else {
            // 如果没有提供端口号，尝试删除整个层的解析器
            if (this.parsers.has(layer)) {
                this.parsers.delete(layer);
            }

            // 删除所有对应该层的端口
            for (const [port, protocol] of this.protocolPorts.entries()) {
                if (protocol === layer) {
                    this.protocolPorts.delete(port);
                }
            }
        }
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
            };
        }
        return {
            status: 'success',
            tree
        };
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
            const payload = result.payload;
            if (payload) {
                if (payload.type && payload.nextLayer) {
                    const result = this.parse(payload.nextLayer, payload.type, tree, buffer, payload.offset);
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

module.exports = ParserRegistry;
