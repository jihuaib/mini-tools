/**
 * ARP Packet Parser
 *
 * Parses ARP (Address Resolution Protocol) packets from raw buffers and returns structured data.
 * Based on RFC 826.
 */

const ARP_HEADER_LEN = 28; // Standard Ethernet ARP packet length

// ARP Hardware Types
const ARP_HARDWARE_TYPE = {
    ETHERNET: 1,
    IEEE802: 6,
    ARCNET: 7,
    FRAME_RELAY: 15,
    ATM: 16,
    HDLC: 17,
    FIBRE_CHANNEL: 18,
    ATM2: 19,
    SERIAL_LINE: 20
};

// ARP Protocol Types (same as Ethernet types)
const ARP_PROTOCOL_TYPE = {
    IPV4: 0x0800,
    IPV6: 0x86dd
};

// ARP Operations
const ARP_OPERATION = {
    REQUEST: 1,
    REPLY: 2,
    RARP_REQUEST: 3,
    RARP_REPLY: 4,
    DRARP_REQUEST: 5,
    DRARP_REPLY: 6,
    DRARP_ERROR: 7,
    INARP_REQUEST: 8,
    INARP_REPLY: 9
};

/**
 * Get hardware type name
 * @param {number} type - Hardware type number
 * @returns {string} Hardware type name
 */
function getHardwareTypeName(type) {
    const typeMap = {
        [ARP_HARDWARE_TYPE.ETHERNET]: 'Ethernet',
        [ARP_HARDWARE_TYPE.IEEE802]: 'IEEE 802',
        [ARP_HARDWARE_TYPE.ARCNET]: 'ARCNET',
        [ARP_HARDWARE_TYPE.FRAME_RELAY]: 'Frame Relay',
        [ARP_HARDWARE_TYPE.ATM]: 'ATM',
        [ARP_HARDWARE_TYPE.HDLC]: 'HDLC',
        [ARP_HARDWARE_TYPE.FIBRE_CHANNEL]: 'Fibre Channel',
        [ARP_HARDWARE_TYPE.ATM2]: 'ATM',
        [ARP_HARDWARE_TYPE.SERIAL_LINE]: 'Serial Line'
    };
    return typeMap[type] || `Unknown (${type})`;
}

/**
 * Get protocol type name
 * @param {number} type - Protocol type number
 * @returns {string} Protocol type name
 */
function getProtocolTypeName(type) {
    const typeMap = {
        [ARP_PROTOCOL_TYPE.IPV4]: 'IPv4',
        [ARP_PROTOCOL_TYPE.IPV6]: 'IPv6'
    };
    return typeMap[type] || `Unknown (0x${type.toString(16).padStart(4, '0')})`;
}

/**
 * Get operation name
 * @param {number} operation - Operation number
 * @returns {string} Operation name
 */
function getOperationName(operation) {
    const operationMap = {
        [ARP_OPERATION.REQUEST]: 'ARP Request',
        [ARP_OPERATION.REPLY]: 'ARP Reply',
        [ARP_OPERATION.RARP_REQUEST]: 'RARP Request',
        [ARP_OPERATION.RARP_REPLY]: 'RARP Reply',
        [ARP_OPERATION.DRARP_REQUEST]: 'DRARP Request',
        [ARP_OPERATION.DRARP_REPLY]: 'DRARP Reply',
        [ARP_OPERATION.DRARP_ERROR]: 'DRARP Error',
        [ARP_OPERATION.INARP_REQUEST]: 'InARP Request',
        [ARP_OPERATION.INARP_REPLY]: 'InARP Reply'
    };
    return operationMap[operation] || `Unknown (${operation})`;
}

/**
 * Format MAC address from buffer
 * @param {Buffer} buffer - Buffer containing the MAC address
 * @returns {string} Formatted MAC address
 */
function formatMacAddress(buffer) {
    if (buffer.length !== 6) {
        return buffer.toString('hex').toUpperCase();
    }
    return Array.from(buffer)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(':')
        .toUpperCase();
}

/**
 * Format IPv4 address from buffer
 * @param {Buffer} buffer - Buffer containing the IP address
 * @returns {string} Formatted IP address
 */
function formatIPv4Address(buffer) {
    if (buffer.length !== 4) {
        return buffer.toString('hex').toUpperCase();
    }
    return Array.from(buffer)
        .map(byte => byte.toString())
        .join('.');
}

/**
 * Format protocol address based on protocol type
 * @param {Buffer} buffer - Buffer containing the protocol address
 * @param {number} protocolType - Protocol type
 * @param {number} protocolLength - Protocol address length
 * @returns {string} Formatted protocol address
 */
function formatProtocolAddress(buffer, protocolType, protocolLength) {
    if (protocolType === ARP_PROTOCOL_TYPE.IPV4 && protocolLength === 4) {
        return formatIPv4Address(buffer);
    } else if (protocolType === ARP_PROTOCOL_TYPE.IPV6 && protocolLength === 16) {
        // Format IPv6 address
        const groups = [];
        for (let i = 0; i < 16; i += 2) {
            groups.push(buffer.readUInt16BE(i).toString(16).padStart(4, '0'));
        }
        return groups.join(':');
    } else {
        // Unknown protocol, display as hex
        return buffer.toString('hex').toUpperCase();
    }
}

/**
 * Parse an ARP packet into a tree structure
 * @param {Buffer} buffer - The raw ARP packet buffer
 * @param {Object} tree - The tree structure to add nodes to
 * @param {number} offset - The starting offset in the buffer
 * @returns {Object} Parse result with valid flag and optional payload
 */
function parseArpPacket(buffer, tree, offset = 0) {
    try {
        // Check if buffer is valid
        if (!Buffer.isBuffer(buffer) || buffer.length < offset + 8) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small for ARP header'
            };
        }

        let curOffset = offset;

        // Parse ARP Header
        const headerNode = {
            name: 'ARP Packet',
            offset: curOffset,
            length: 0, // Will be calculated based on actual header length
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Parse Hardware Type
        const hardwareType = buffer.readUInt16BE(curOffset);
        const hardwareTypeNode = {
            name: 'Hardware Type',
            offset: curOffset,
            length: 2,
            value: `${hardwareType} (${getHardwareTypeName(hardwareType)})`,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(hardwareTypeNode);

        // Parse Protocol Type
        const protocolType = buffer.readUInt16BE(curOffset);
        const protocolTypeNode = {
            name: 'Protocol Type',
            offset: curOffset,
            length: 2,
            value: `0x${protocolType.toString(16).padStart(4, '0')} (${getProtocolTypeName(protocolType)})`,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(protocolTypeNode);

        // Parse Hardware Address Length
        const hardwareLength = buffer[curOffset];
        const hardwareLengthNode = {
            name: 'Hardware Address Length',
            offset: curOffset,
            length: 1,
            value: `${hardwareLength} bytes`,
            children: []
        };
        curOffset += 1;
        headerNode.children.push(hardwareLengthNode);

        // Parse Protocol Address Length
        const protocolLength = buffer[curOffset];
        const protocolLengthNode = {
            name: 'Protocol Address Length',
            offset: curOffset,
            length: 1,
            value: `${protocolLength} bytes`,
            children: []
        };
        curOffset += 1;
        headerNode.children.push(protocolLengthNode);

        // Calculate total header length
        const totalHeaderLength = 8 + (hardwareLength * 2) + (protocolLength * 2);

        // Check if buffer has enough data for the complete ARP packet
        if (buffer.length < offset + totalHeaderLength) {
            return {
                valid: false,
                error: `Buffer too small for complete ARP packet. Expected ${totalHeaderLength} bytes, got ${buffer.length - offset}`
            };
        }

        // Update header length
        headerNode.length = totalHeaderLength;

        // Parse Operation
        const operation = buffer.readUInt16BE(curOffset);
        const operationNode = {
            name: 'Operation',
            offset: curOffset,
            length: 2,
            value: `${operation} (${getOperationName(operation)})`,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(operationNode);

        // Parse Sender Hardware Address
        const senderHardwareAddr = buffer.subarray(curOffset, curOffset + hardwareLength);
        const senderHardwareNode = {
            name: 'Sender Hardware Address',
            offset: curOffset,
            length: hardwareLength,
            value: formatMacAddress(senderHardwareAddr),
            children: []
        };
        curOffset += hardwareLength;
        headerNode.children.push(senderHardwareNode);

        // Parse Sender Protocol Address
        const senderProtocolAddr = buffer.subarray(curOffset, curOffset + protocolLength);
        const senderProtocolNode = {
            name: 'Sender Protocol Address',
            offset: curOffset,
            length: protocolLength,
            value: formatProtocolAddress(senderProtocolAddr, protocolType, protocolLength),
            children: []
        };
        curOffset += protocolLength;
        headerNode.children.push(senderProtocolNode);

        // Parse Target Hardware Address
        const targetHardwareAddr = buffer.subarray(curOffset, curOffset + hardwareLength);
        const targetHardwareNode = {
            name: 'Target Hardware Address',
            offset: curOffset,
            length: hardwareLength,
            value: formatMacAddress(targetHardwareAddr),
            children: []
        };
        curOffset += hardwareLength;
        headerNode.children.push(targetHardwareNode);

        // Parse Target Protocol Address
        const targetProtocolAddr = buffer.subarray(curOffset, curOffset + protocolLength);
        const targetProtocolNode = {
            name: 'Target Protocol Address',
            offset: curOffset,
            length: protocolLength,
            value: formatProtocolAddress(targetProtocolAddr, protocolType, protocolLength),
            children: []
        };
        curOffset += protocolLength;
        headerNode.children.push(targetProtocolNode);

        // ARP packets typically don't have additional payload after the address fields
        let payload = null;
        if (buffer.length > curOffset) {
            payload = {
                name: 'Additional Data',
                offset: curOffset,
                length: buffer.length - curOffset,
                value: buffer.subarray(curOffset).toString('hex').toUpperCase(),
                children: [],
                type: null,
                nextLayer: null
            };
        }

        return {
            valid: true,
            payload
        };
    } catch (error) {
        return {
            valid: false,
            error: `Error parsing ARP packet: ${error.message}`
        };
    }
}

module.exports = {
    ARP_HARDWARE_TYPE,
    ARP_PROTOCOL_TYPE,
    ARP_OPERATION,
    ARP_HEADER_LEN,
    parseArpPacket
};
