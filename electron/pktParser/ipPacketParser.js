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
function parseIPv4Packet(buffer, tree, offset = 0) {
    try {
        if (!Buffer.isBuffer(buffer) || buffer.length < offset + IPV4_HEADER_LEN) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        let curOffset = offset;

        // Parse IP Header
        const headerNode = {
            name: 'IPv4 Packet',
            offset: curOffset,
            length: IPV4_HEADER_LEN,
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Version and IHL
        const versionIhl = buffer[curOffset];
        const version = (versionIhl >> 4) & 0x0f;
        const ihl = (versionIhl & 0x0f) * 4;

        const versionNode = {
            name: 'Version',
            offset: curOffset,
            length: 1,
            value: `IPv${version}`,
            children: []
        };
        curOffset += 1;
        headerNode.children.push(versionNode);

        // TOS
        const tosNode = {
            name: 'Type of Service',
            offset: curOffset,
            length: 1,
            value: `0x${buffer[curOffset].toString(16).padStart(2, '0')}`,
            children: []
        };
        curOffset += 1;
        headerNode.children.push(tosNode);

        // Total Length
        const totalLength = buffer.readUInt16BE(curOffset);
        const lengthNode = {
            name: 'Total Length',
            offset: curOffset,
            length: 2,
            value: totalLength.toString(),
            children: []
        };
        curOffset += 2;
        headerNode.children.push(lengthNode);

        // identification
        const identification = buffer.readUInt16BE(curOffset);
        const identificationNode = {
            name: 'Identification',
            offset: curOffset,
            length: 2,
            value: identification,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(identificationNode);

        // flags
        const flags = buffer.readUInt16BE(curOffset);
        const flagsNode = {
            name: 'Flags',
            offset: curOffset,
            length: 2,
            value: flags,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(flagsNode);

        // ttl
        const ttl = buffer[curOffset];
        const ttlNode = {
            name: 'TTL',
            offset: curOffset,
            length: 1,
            value: ttl,
            children: []
        };
        curOffset += 1;
        headerNode.children.push(ttlNode);

        // Protocol
        const protocol = buffer[curOffset];
        const protocolNode = {
            name: 'Protocol',
            offset: curOffset,
            length: 1,
            value: getProtocolName(protocol),
            children: []
        };
        curOffset += 1;
        headerNode.children.push(protocolNode);

        // CheckSum
        const checksum = buffer.readUInt16BE(curOffset);
        const checksumNode = {
            name: 'CheckSum',
            offset: curOffset,
            length: 2,
            value: checksum,
            children: []
        };
        curOffset += 2;
        headerNode.children.push(checksumNode);

        // Source IP
        const srcIpNode = {
            name: 'Source IP',
            offset: offset,
            length: 4,
            value: formatIPv4Address(buffer.subarray(curOffset, curOffset + 4)),
            children: []
        };
        curOffset += 4;
        headerNode.children.push(srcIpNode);

        // Destination IP
        const dstIpNode = {
            name: 'Destination IP',
            offset: curOffset,
            length: 4,
            value: formatIPv4Address(buffer.subarray(curOffset, curOffset + 4)),
            children: []
        };
        curOffset += 4;
        headerNode.children.push(dstIpNode);

        // Options
        if (ihl > IPV4_HEADER_LEN) {
            const optLen = offset + ihl - curOffset;
            const options = {
                name: 'Options',
                offset: curOffset,
                length: optLen,
                value: buffer.subarray(curOffset, curOffset + optLen).toString('hex'),
                children: []
            };
            curOffset += optLen;
            headerNode.children.push(options);
        }
        if (curOffset - offset !== ihl) {
            return {
                valid: false,
                error: 'ipv4 packet parse error'
            };
        }

        // Parse Payload
        let payload = null;
        if (buffer.length > curOffset) {
            payload = {
                name: 'Payload',
                offset: curOffset,
                length: buffer.length - curOffset,
                value: '',
                children: [],
                type: protocol,
                nextLayer: getNextLayer(protocol)
            };
        }

        return {
            valid: true,
            payload
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
 * @param {Object} tree - The tree structure to add nodes to
 * @param {number} offset - The starting offset in the buffer
 * @returns {Object} Tree structure with offsets and lengths for each field
 */
function parseIPv6Packet(buffer, tree, offset = 0) {
    try {
        if (!Buffer.isBuffer(buffer) || buffer.length < offset + IPV6_HEADER_LEN) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        let curOffset = offset;

        // Parse IP Header
        const headerNode = {
            name: 'IPv6 Packet',
            offset: curOffset,
            length: IPV6_HEADER_LEN,
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Version, Traffic Class, and Flow Label
        const versionTc = buffer[curOffset];
        const version = (versionTc >> 4) & 0x0f;

        const versionNode = {
            name: 'Version',
            offset: curOffset,
            length: 1,
            value: `IPv${version}`,
            children: []
        };
        headerNode.children.push(versionNode);

        // Traffic Class & Flow Label (4 bytes total for version + traffic class + flow label)
        const trafficClass = ((buffer[curOffset] & 0x0f) << 4) | ((buffer[curOffset + 1] & 0xf0) >> 4);
        const tcNode = {
            name: 'Traffic Class',
            offset: curOffset,
            length: 1,
            value: `0x${trafficClass.toString(16).padStart(2, '0')}`,
            children: []
        };
        headerNode.children.push(tcNode);

        const flowLabel = ((buffer[curOffset + 1] & 0x0f) << 16) | (buffer[curOffset + 2] << 8) | buffer[curOffset + 3];
        const flowLabelNode = {
            name: 'Flow Label',
            offset: curOffset + 1,
            length: 3,
            value: flowLabel,
            children: []
        };
        curOffset += 4; // Move past version, traffic class, and flow label
        headerNode.children.push(flowLabelNode);

        // Payload Length
        const payloadLength = buffer.readUInt16BE(curOffset);
        const payloadLengthNode = {
            name: 'Payload Length',
            offset: curOffset,
            length: 2,
            value: payloadLength.toString(),
            children: []
        };
        curOffset += 2;
        headerNode.children.push(payloadLengthNode);

        // Next Header (Protocol)
        const nextHeader = buffer[curOffset];
        const protocolNode = {
            name: 'Next Header',
            offset: curOffset,
            length: 1,
            value: getProtocolName(nextHeader),
            children: []
        };
        curOffset += 1;
        headerNode.children.push(protocolNode);

        // Hop Limit
        const hopLimit = buffer[curOffset];
        const hopLimitNode = {
            name: 'Hop Limit',
            offset: curOffset,
            length: 1,
            value: hopLimit,
            children: []
        };
        curOffset += 1;
        headerNode.children.push(hopLimitNode);

        // Source IP
        const srcIpNode = {
            name: 'Source IP',
            offset: curOffset,
            length: 16,
            value: formatIPv6Address(buffer.subarray(curOffset, curOffset + 16)),
            children: []
        };
        curOffset += 16;
        headerNode.children.push(srcIpNode);

        // Destination IP
        const dstIpNode = {
            name: 'Destination IP',
            offset: curOffset,
            length: 16,
            value: formatIPv6Address(buffer.subarray(curOffset, curOffset + 16)),
            children: []
        };
        curOffset += 16;
        headerNode.children.push(dstIpNode);

        // Parse Payload
        let payload = null;
        if (buffer.length > curOffset) {
            payload = {
                name: 'Payload',
                offset: curOffset,
                length: buffer.length - curOffset,
                value: '',
                children: [],
                type: nextHeader,
                nextLayer: getNextLayer(nextHeader)
            };
        }

        return {
            valid: true,
            payload
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
