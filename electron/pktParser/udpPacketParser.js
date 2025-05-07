/**
 * UDP Packet Parser
 *
 * Parses UDP protocol packets from raw buffers and returns structured data.
 */

/**
 * Parse a UDP packet into a tree structure
 * @param {Buffer} buffer - The raw UDP packet buffer
 * @returns {Object} Tree structure with offsets and lengths for each field
 */
function parseUdpPacketTree(buffer) {
    try {
        // Check if buffer is valid
        if (!Buffer.isBuffer(buffer) || buffer.length < 8) { // UDP header length
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        // Start building the tree structure
        const tree = {
            name: 'UDP Packet',
            offset: 0,
            length: buffer.length,
            value: '',
            children: []
        };

        // Parse UDP Header
        const headerNode = {
            name: 'UDP Header',
            offset: 0,
            length: 8,
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

        // Length
        const length = buffer.readUInt16BE(4);
        const lengthNode = {
            name: 'Length',
            offset: 4,
            length: 2,
            value: length,
            children: []
        };
        headerNode.children.push(lengthNode);

        // Checksum
        const checksum = buffer.readUInt16BE(6);
        const checksumNode = {
            name: 'Checksum',
            offset: 6,
            length: 2,
            value: `0x${checksum.toString(16).padStart(4, '0')}`,
            children: []
        };
        headerNode.children.push(checksumNode);

        // Parse Payload
        if (buffer.length > 8) {
            // 根据端口判断下一层协议
            let nextLayer = null;
            let type = 0;

            if (sourcePort === 53 || destPort === 53) {
                nextLayer = 'dns';
                type = 53;
            } else if (sourcePort === 67 || sourcePort === 68 || destPort === 67 || destPort === 68) {
                nextLayer = 'dhcp';
                type = 67; // Using 67 as the primary DHCP port
            }

            const payloadNode = {
                name: 'Payload',
                offset: 8,
                length: buffer.length - 8,
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
            error: `Error parsing UDP packet: ${error.message}`
        };
    }
}

/**
 * Parse a UDP packet through the registry system
 * @param {Buffer} buffer - The raw UDP packet buffer
 * @param {number} offset - Starting offset in the buffer
 * @returns {Object} Parse result with a valid flag and tree structure
 */
function parseUdpPacket(buffer, offset = 0) {
    // Use the existing parseUdpPacketTree function to do the actual parsing
    const result = parseUdpPacketTree(buffer.subarray(offset));

    // Return in the format expected by the registry system
    return {
        valid: result.valid,
        error: result.error,
        tree: result.tree
    };
}

module.exports = {
    parseUdpPacketTree,
    parseUdpPacket
};
