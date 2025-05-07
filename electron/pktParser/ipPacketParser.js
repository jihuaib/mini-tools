/**
 * IP Packet Parser
 *
 * Parses IPv4 and IPv6 packets from raw buffers and returns structured data.
 */

const IPV4_HEADER_LEN = 20; // Minimum IPv4 header length
const IPV6_HEADER_LEN = 40; // IPv6 header length

// IP Protocol Numbers
const IP_PROTOCOL = {
    ICMP: 1,
    IGMP: 2,
    TCP: 6,
    UDP: 17,
    ICMPV6: 58
};

/**
 * Parse an IPv4 packet into a tree structure
 * @param {Buffer} buffer - The raw IP packet buffer
 * @param {number} offset - The starting offset in the buffer
 * @returns {Object} Tree structure with offsets and lengths for each field
 */
function parseIPv4Packet(buffer, offset = 0) {
    try {
        if (!Buffer.isBuffer(buffer) || buffer.length < offset + IPV4_HEADER_LEN) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        const tree = {
            name: 'IPv4 Packet',
            offset: offset,
            length: buffer.length - offset,
            value: '',
            children: []
        };

        // Parse IP Header
        const headerNode = {
            name: 'IPv4 Header',
            offset: offset,
            length: IPV4_HEADER_LEN,
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Version and IHL
        const versionIhl = buffer[offset];
        const version = (versionIhl >> 4) & 0x0F;
        const ihl = (versionIhl & 0x0F) * 4;

        const versionNode = {
            name: 'Version',
            offset: offset,
            length: 1,
            value: `IPv${version}`,
            children: []
        };
        headerNode.children.push(versionNode);

        // TOS
        const tosNode = {
            name: 'Type of Service',
            offset: offset + 1,
            length: 1,
            value: `0x${buffer[offset + 1].toString(16).padStart(2, '0')}`,
            children: []
        };
        headerNode.children.push(tosNode);

        // Total Length
        const totalLength = buffer.readUInt16BE(offset + 2);
        const lengthNode = {
            name: 'Total Length',
            offset: offset + 2,
            length: 2,
            value: totalLength.toString(),
            children: []
        };
        headerNode.children.push(lengthNode);

        // Protocol
        const protocol = buffer[offset + 9];
        const protocolNode = {
            name: 'Protocol',
            offset: offset + 9,
            length: 1,
            value: getProtocolName(protocol),
            children: []
        };
        headerNode.children.push(protocolNode);

        // Source IP
        const srcIpNode = {
            name: 'Source IP',
            offset: offset + 12,
            length: 4,
            value: formatIPv4Address(buffer.subarray(offset + 12, offset + 16)),
            children: []
        };
        headerNode.children.push(srcIpNode);

        // Destination IP
        const dstIpNode = {
            name: 'Destination IP',
            offset: offset + 16,
            length: 4,
            value: formatIPv4Address(buffer.subarray(offset + 16, offset + 20)),
            children: []
        };
        headerNode.children.push(dstIpNode);

        // Parse Payload
        if (buffer.length > offset + ihl) {
            const payloadNode = {
                name: 'Payload',
                offset: offset + ihl,
                length: buffer.length - (offset + ihl),
                value: '',
                children: [],
                type: protocol,
                nextLayer: getNextLayer(protocol)
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
            error: `Error parsing IPv4 packet: ${error.message}`
        };
    }
}

/**
 * Parse an IPv6 packet into a tree structure
 * @param {Buffer} buffer - The raw IP packet buffer
 * @param {number} offset - The starting offset in the buffer
 * @returns {Object} Tree structure with offsets and lengths for each field
 */
function parseIPv6Packet(buffer, offset = 0) {
    try {
        if (!Buffer.isBuffer(buffer) || buffer.length < offset + IPV6_HEADER_LEN) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        const tree = {
            name: 'IPv6 Packet',
            offset: offset,
            length: buffer.length - offset,
            value: '',
            children: []
        };

        // Parse IP Header
        const headerNode = {
            name: 'IPv6 Header',
            offset: offset,
            length: IPV6_HEADER_LEN,
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Version and Traffic Class
        const versionTc = buffer[offset];
        const version = (versionTc >> 4) & 0x0F;

        const versionNode = {
            name: 'Version',
            offset: offset,
            length: 1,
            value: `IPv${version}`,
            children: []
        };
        headerNode.children.push(versionNode);

        // Next Header (Protocol)
        const nextHeader = buffer[offset + 6];
        const protocolNode = {
            name: 'Next Header',
            offset: offset + 6,
            length: 1,
            value: getProtocolName(nextHeader),
            children: []
        };
        headerNode.children.push(protocolNode);

        // Source IP
        const srcIpNode = {
            name: 'Source IP',
            offset: offset + 8,
            length: 16,
            value: formatIPv6Address(buffer.subarray(offset + 8, offset + 24)),
            children: []
        };
        headerNode.children.push(srcIpNode);

        // Destination IP
        const dstIpNode = {
            name: 'Destination IP',
            offset: offset + 24,
            length: 16,
            value: formatIPv6Address(buffer.subarray(offset + 24, offset + 40)),
            children: []
        };
        headerNode.children.push(dstIpNode);

        // Parse Payload
        if (buffer.length > offset + IPV6_HEADER_LEN) {
            const payloadNode = {
                name: 'Payload',
                offset: offset + IPV6_HEADER_LEN,
                length: buffer.length - (offset + IPV6_HEADER_LEN),
                value: '',
                children: [],
                type: nextHeader,
                nextLayer: getNextLayer(nextHeader)
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
            error: `Error parsing IPv6 packet: ${error.message}`
        };
    }
}

/**
 * Format an IPv4 address from buffer
 * @param {Buffer} buffer - Buffer containing the IP address
 * @returns {string} Formatted IP address
 */
function formatIPv4Address(buffer) {
    return Array.from(buffer)
        .map(byte => byte.toString())
        .join('.');
}

/**
 * Format an IPv6 address from buffer
 * @param {Buffer} buffer - Buffer containing the IP address
 * @returns {string} Formatted IP address
 */
function formatIPv6Address(buffer) {
    const groups = [];
    for (let i = 0; i < 16; i += 2) {
        groups.push(buffer.readUInt16BE(i).toString(16).padStart(4, '0'));
    }
    return groups.join(':');
}

/**
 * Get protocol name from protocol number
 * @param {number} protocol - Protocol number
 * @returns {string} Protocol name
 */
function getProtocolName(protocol) {
    const protocolMap = {
        [IP_PROTOCOL.ICMP]: 'ICMP',
        [IP_PROTOCOL.IGMP]: 'IGMP',
        [IP_PROTOCOL.TCP]: 'TCP',
        [IP_PROTOCOL.UDP]: 'UDP',
        [IP_PROTOCOL.ICMPV6]: 'ICMPv6'
    };
    return protocolMap[protocol] || `Unknown (${protocol})`;
}

/**
 * Determine the next layer based on IP protocol
 * @param {number} protocol - The IP protocol number
 * @returns {string|null} The next layer name or null if unknown
 */
function getNextLayer(protocol) {
    switch (protocol) {
        case IP_PROTOCOL.TCP:
            return 'tcp';
        case IP_PROTOCOL.UDP:
            return 'udp';
        case IP_PROTOCOL.ICMP:
        case IP_PROTOCOL.ICMPV6:
            return 'icmp';
        case IP_PROTOCOL.IGMP:
            return 'igmp';
        default:
            return null;
    }
}

module.exports = {
    IP_PROTOCOL,
    IPV4_HEADER_LEN,
    IPV6_HEADER_LEN,
    parseIPv4Packet,
    parseIPv6Packet
};
