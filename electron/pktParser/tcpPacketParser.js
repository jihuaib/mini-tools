/**
 * TCP Packet Parser
 *
 * Parses TCP protocol packets from raw buffers and returns structured data.
 */

const registry = require('./registryInstance');

const TCP_FLAGS = {
    FIN: 0x01,
    SYN: 0x02,
    RST: 0x04,
    PSH: 0x08,
    ACK: 0x10,
    URG: 0x20,
    ECE: 0x40,
    CWR: 0x80
};

// Helper function to get TCP flags string
function getTcpFlagsString(flags) {
    const flagNames = [];
    if (flags & TCP_FLAGS.FIN) flagNames.push('FIN');
    if (flags & TCP_FLAGS.SYN) flagNames.push('SYN');
    if (flags & TCP_FLAGS.RST) flagNames.push('RST');
    if (flags & TCP_FLAGS.PSH) flagNames.push('PSH');
    if (flags & TCP_FLAGS.ACK) flagNames.push('ACK');
    if (flags & TCP_FLAGS.URG) flagNames.push('URG');
    if (flags & TCP_FLAGS.ECE) flagNames.push('ECE');
    if (flags & TCP_FLAGS.CWR) flagNames.push('CWR');
    return flagNames.join('|') || 'None';
}

/**
 * Parse a TCP packet into a tree structure
 * @param {Buffer} buffer - The raw TCP packet buffer
 * @returns {Object} Tree structure with offsets and lengths for each field
 */
function parseTcpPacket(buffer, tree, offset = 0) {
    try {
        // Check if buffer is valid
        if (!Buffer.isBuffer(buffer) || buffer.length < offset + 20) {
            // Minimum TCP header length
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        let curOffset = offset;

        // Parse TCP Header
        const headerNode = {
            name: 'TCP Packet',
            offset: curOffset,
            length: 0, // 解析完成赋值
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Source Port
        const sourcePort = buffer.readUInt16BE(curOffset);
        const sourcePortNode = {
            name: 'Source Port',
            offset: curOffset,
            length: 2,
            value: sourcePort,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(sourcePortNode);

        // Destination Port
        const destPort = buffer.readUInt16BE(curOffset);
        const destPortNode = {
            name: 'Destination Port',
            offset: curOffset,
            length: 2,
            value: destPort,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(destPortNode);

        // Sequence Number
        const seqNum = buffer.readUInt32BE(curOffset);
        const seqNumNode = {
            name: 'Sequence Number',
            offset: curOffset,
            length: 4,
            value: seqNum,
            children: []
        };
        curOffset += 4;
        headerNode.children.push(seqNumNode);

        // Acknowledgment Number
        const ackNum = buffer.readUInt32BE(curOffset);
        const ackNumNode = {
            name: 'Acknowledgment Number',
            offset: curOffset,
            length: 4,
            value: ackNum,
            children: []
        };
        curOffset += 4;
        headerNode.children.push(ackNumNode);

        // Data Offset and Flags
        const dataOffset = (buffer[curOffset] >> 4) & 0x0f;
        const flags = buffer[curOffset + 1];
        const dataOffsetFlagsNode = {
            name: 'Data Offset/Flags',
            offset: curOffset,
            length: 2,
            value: `Data Offset: ${dataOffset * 4} bytes, Flags: ${getTcpFlagsString(flags)}`,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(dataOffsetFlagsNode);

        const headerLength = dataOffset * 4;
        headerNode.length = headerLength;

        // Window Size
        const windowSize = buffer.readUInt16BE(curOffset);
        const windowSizeNode = {
            name: 'Window Size',
            offset: curOffset,
            length: 2,
            value: windowSize,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(windowSizeNode);

        // Checksum
        const checksum = buffer.readUInt16BE(curOffset);
        const checksumNode = {
            name: 'Checksum',
            offset: curOffset,
            length: 2,
            value: `0x${checksum.toString(16).padStart(4, '0')}`,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(checksumNode);

        // Urgent Pointer
        const urgentPtr = buffer.readUInt16BE(curOffset);
        const urgentPtrNode = {
            name: 'Urgent Pointer',
            offset: curOffset,
            length: 2,
            value: urgentPtr,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(urgentPtrNode);

        // Parse Options if present
        if (headerLength > 20) {
            const optLen = offset + headerLength - curOffset;
            const optionsNode = {
                name: 'TCP Options',
                offset: curOffset,
                length: optLen,
                value: '',
                children: []
            };
            headerNode.children.push(optionsNode);

            let position = curOffset;
            while (position < offset + headerLength) {
                const kind = buffer[position];
                let length = 1;

                if (kind === 0) {
                    // End of Options List
                    break;
                } else if (kind === 1) {
                    // No-Operation
                    position += 1;
                    continue;
                } else {
                    length = buffer[position + 1];
                }

                const optionNode = {
                    name: `Option (Kind: ${kind})`,
                    offset: position,
                    length: length,
                    value: buffer.subarray(position + 2, position + length).toString('hex'),
                    children: []
                };
                optionsNode.children.push(optionNode);

                position += length;
            }
            curOffset += optLen;
        }

        if (curOffset - offset != headerLength) {
            return {
                valid: false,
                error: 'tcp packet parse error'
            };
        }

        // Parse Payload
        let payload = null;
        if (buffer.length > offset + headerLength) {
            // 根据端口判断下一层协议
            let nextLayer = null;
            let type = null;

            // 检查源端口和目的端口是否对应已注册的协议
            if (registry.hasProtocolForPort(sourcePort)) {
                nextLayer = registry.getProtocolByPort(sourcePort);
                type = sourcePort;
            } else if (registry.hasProtocolForPort(destPort)) {
                nextLayer = registry.getProtocolByPort(destPort);
                type = destPort;
            }

            payload = {
                offset: curOffset,
                length: buffer.length - curOffset,
                nextLayer: nextLayer,
                type: type
            };
        }

        return {
            valid: true,
            payload,
            tree
        };
    } catch (error) {
        return {
            valid: false,
            error: `Error parsing TCP packet: ${error.message}`
        };
    }
}

module.exports = {
    parseTcpPacket,
    TCP_FLAGS
};
