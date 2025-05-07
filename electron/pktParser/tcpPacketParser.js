/**
 * TCP Packet Parser
 *
 * Parses TCP protocol packets from raw buffers and returns structured data.
 */

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
function parseTcpPacketTree(buffer) {
    try {
        // Check if buffer is valid
        if (!Buffer.isBuffer(buffer) || buffer.length < 20) { // Minimum TCP header length
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        // Start building the tree structure
        const tree = {
            name: 'TCP Packet',
            offset: 0,
            length: buffer.length,
            value: '',
            children: []
        };

        // Parse TCP Header
        const headerNode = {
            name: 'TCP Header',
            offset: 0,
            length: 20, // Basic TCP header length
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Source Port
        const sourcePort = buffer.readUInt16BE(0);
        const sourcePortNode = {
            name: 'Source Port',
            offset: 0,
            length: 2,
            value: sourcePort,
            children: []
        };
        headerNode.children.push(sourcePortNode);

        // Destination Port
        const destPort = buffer.readUInt16BE(2);
        const destPortNode = {
            name: 'Destination Port',
            offset: 2,
            length: 2,
            value: destPort,
            children: []
        };
        headerNode.children.push(destPortNode);

        // Sequence Number
        const seqNum = buffer.readUInt32BE(4);
        const seqNumNode = {
            name: 'Sequence Number',
            offset: 4,
            length: 4,
            value: seqNum,
            children: []
        };
        headerNode.children.push(seqNumNode);

        // Acknowledgment Number
        const ackNum = buffer.readUInt32BE(8);
        const ackNumNode = {
            name: 'Acknowledgment Number',
            offset: 8,
            length: 4,
            value: ackNum,
            children: []
        };
        headerNode.children.push(ackNumNode);

        // Data Offset and Flags
        const dataOffset = (buffer[12] >> 4) & 0x0F;
        const flags = buffer[13];
        const dataOffsetFlagsNode = {
            name: 'Data Offset/Flags',
            offset: 12,
            length: 2,
            value: `Data Offset: ${dataOffset * 4} bytes, Flags: ${getTcpFlagsString(flags)}`,
            children: []
        };
        headerNode.children.push(dataOffsetFlagsNode);

        // Window Size
        const windowSize = buffer.readUInt16BE(14);
        const windowSizeNode = {
            name: 'Window Size',
            offset: 14,
            length: 2,
            value: windowSize,
            children: []
        };
        headerNode.children.push(windowSizeNode);

        // Checksum
        const checksum = buffer.readUInt16BE(16);
        const checksumNode = {
            name: 'Checksum',
            offset: 16,
            length: 2,
            value: `0x${checksum.toString(16).padStart(4, '0')}`,
            children: []
        };
        headerNode.children.push(checksumNode);

        // Urgent Pointer
        const urgentPtr = buffer.readUInt16BE(18);
        const urgentPtrNode = {
            name: 'Urgent Pointer',
            offset: 18,
            length: 2,
            value: urgentPtr,
            children: []
        };
        headerNode.children.push(urgentPtrNode);

        // Parse Options if present
        const headerLength = dataOffset * 4;
        if (headerLength > 20) {
            const optionsNode = {
                name: 'TCP Options',
                offset: 20,
                length: headerLength - 20,
                value: '',
                children: []
            };
            headerNode.children.push(optionsNode);

            let position = 20;
            while (position < headerLength) {
                const kind = buffer[position];
                let length = 1;

                if (kind === 0) { // End of Options List
                    break;
                } else if (kind === 1) { // No-Operation
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
        }

        // Parse Payload
        if (buffer.length > headerLength) {
            // 根据端口判断下一层协议
            let nextLayer = null;
            let type = 0;

            if (sourcePort === 179 || destPort === 179) {
                nextLayer = 'bgp';
                type = 179; // BGP type，使用端口号
            }

            const payloadNode = {
                name: 'Payload',
                offset: headerLength,
                length: buffer.length - headerLength,
                value: '',
                children: [],
                nextLayer: nextLayer,
                type: type
            };
            tree.children.push(payloadNode);
        }

        return {
            valid: true,
            tree
        };
    } catch (error) {
        return {
            valid: false,
            error: `Error parsing TCP packet: ${error.message}`
        };
    }
}

/**
 * Parse a TCP packet through the registry system
 * @param {Buffer} buffer - The raw TCP packet buffer
 * @param {number} offset - Starting offset in the buffer
 * @returns {Object} Parse result with a valid flag and tree structure
 */
function parseTcpPacket(buffer, offset = 0) {
    // Use the existing parseTcpPacketTree function to do the actual parsing
    const result = parseTcpPacketTree(buffer.subarray(offset));

    // Return in the format expected by the registry system
    return {
        valid: result.valid,
        error: result.error,
        tree: result.tree
    };
}

module.exports = {
    parseTcpPacketTree,
    parseTcpPacket,
    TCP_FLAGS
};
