/**
 * Ethernet Packet Parser
 *
 * Parses Ethernet protocol packets from raw buffers and returns structured data.
 * Based on IEEE 802.3 standard.
 */

const ETH_HEADER_LEN = 14; // 6 bytes dest MAC + 6 bytes src MAC + 2 bytes type
const ETH_MIN_LEN = 60; // Minimum Ethernet frame length
const ETH_MAX_LEN = 1514; // Maximum Ethernet frame length (excluding FCS)

// Ethernet Type/Length field values
const ETH_TYPE = {
    IPV4: 0x0800,
    IPV6: 0x86DD,
    ARP: 0x0806,
    VLAN: 0x8100,
    MPLS: 0x8847,
    PPPOE_DISCOVERY: 0x8863,
    PPPOE_SESSION: 0x8864,
    LLDP: 0x88CC,
    BGP: 0x0800 // BGP runs over IPv4
};

// Helper function to format MAC address
function formatMacAddress(buffer) {
    return Array.from(buffer)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(':')
        .toUpperCase();
}

// Helper function to get Ethernet type name
function getEthernetTypeName(type) {
    const typeMap = {
        [ETH_TYPE.IPV4]: 'IPv4',
        [ETH_TYPE.IPV6]: 'IPv6',
        [ETH_TYPE.ARP]: 'ARP',
        [ETH_TYPE.VLAN]: 'VLAN',
        [ETH_TYPE.MPLS]: 'MPLS',
        [ETH_TYPE.PPPOE_DISCOVERY]: 'PPPoE Discovery',
        [ETH_TYPE.PPPOE_SESSION]: 'PPPoE Session',
        [ETH_TYPE.LLDP]: 'LLDP'
    };
    return typeMap[type] || `Unknown (0x${type.toString(16).padStart(4, '0')})`;
}

/**
 * Parse an Ethernet packet into a tree structure
 * @param {Buffer} buffer - The raw Ethernet packet buffer
 * @param {number} offset - The starting offset in the buffer
 * @returns {Object} Tree structure with offsets and lengths for each field
 */
function parseEthernetPacket(buffer, offset = 0) {
    try {
        // Check if buffer is valid
        if (!Buffer.isBuffer(buffer) || buffer.length < offset + ETH_HEADER_LEN) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        // Start building the tree structure
        const tree = {
            name: 'Ethernet Frame',
            offset: offset,
            length: buffer.length - offset,
            value: '',
            children: []
        };

        // Parse Ethernet Header
        const headerNode = {
            name: 'Ethernet Header',
            offset: offset,
            length: ETH_HEADER_LEN,
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Parse Destination MAC
        const destMacNode = {
            name: 'Destination MAC',
            offset: offset,
            length: 6,
            value: formatMacAddress(buffer.subarray(offset, offset + 6)),
            children: []
        };
        headerNode.children.push(destMacNode);

        // Parse Source MAC
        const srcMacNode = {
            name: 'Source MAC',
            offset: offset + 6,
            length: 6,
            value: formatMacAddress(buffer.subarray(offset + 6, offset + 12)),
            children: []
        };
        headerNode.children.push(srcMacNode);

        // Parse Type/Length
        const type = buffer.readUInt16BE(offset + 12);
        const typeNode = {
            name: 'Type/Length',
            offset: offset + 12,
            length: 2,
            value: `0x${type.toString(16).padStart(4, '0')} (${getEthernetTypeName(type)})`,
            children: []
        };
        headerNode.children.push(typeNode);

        // Parse Payload
        if (buffer.length > offset + ETH_HEADER_LEN) {
            const payloadNode = {
                name: 'Payload',
                offset: offset + ETH_HEADER_LEN,
                length: buffer.length - (offset + ETH_HEADER_LEN),
                value: '',
                children: [],
                type: type,
                nextLayer: getNextLayer(type)
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
            error: `Error parsing Ethernet packet: ${error.message}`
        };
    }
}

/**
 * Determine the next layer based on Ethernet type
 * @param {number} type - The Ethernet type
 * @returns {string|null} The next layer name or null if unknown
 */
function getNextLayer(type) {
    switch (type) {
        case ETH_TYPE.IPV4:
        case ETH_TYPE.IPV6:
            return 'ip';
        case ETH_TYPE.ARP:
            return 'arp';
        case ETH_TYPE.VLAN:
            return 'vlan';
        case ETH_TYPE.MPLS:
            return 'mpls';
        case ETH_TYPE.PPPOE_DISCOVERY:
        case ETH_TYPE.PPPOE_SESSION:
            return 'pppoe';
        case ETH_TYPE.LLDP:
            return 'lldp';
        default:
            return null;
    }
}

module.exports = {
    ETH_TYPE,
    ETH_HEADER_LEN,
    ETH_MIN_LEN,
    ETH_MAX_LEN,
    parseEthernetPacket
};
