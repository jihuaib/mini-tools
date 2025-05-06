/**
 * BGP Packet Parser
 *
 * Parses BGP protocol packets from raw buffers and returns structured data.
 * Based on RFC 4271 and other BGP extension RFCs.
 */

// Import constants from existing BGP constants file
const BgpConst = require('../const/bgpConst');
const { ipv4BufferToString, ipv6BufferToString, getIpTypeName } = require('./ipUtils');
const {
    getBgpPacketTypeName,
    getBgpOpenCapabilityName,
    getBgpAfiName,
    getBgpSafiName,
    getBgpOpenRoleName,
    getBgpPathAttrTypeName,
    getBgpOriginType,
    getBgpAsPathTypeName,
    getBgpNotificationErrorName
} = require('./bgpUtils');
/**
 * Parse a BGP packet from a buffer
 * @param {Buffer} buffer - The raw BGP packet buffer
 * @returns {Object} Parsed BGP packet data
 */
function parseBgpPacket(buffer) {
    try {
        // Check if buffer is valid
        if (!Buffer.isBuffer(buffer) || buffer.length < BgpConst.BGP_HEAD_LEN) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        // Check if the BGP marker is valid (16 bytes of 0xFF)
        const marker = buffer.subarray(0, BgpConst.BGP_MARKER_LEN);
        if (!marker.every(byte => byte === 0xff)) {
            return {
                valid: false,
                error: 'Invalid BGP marker'
            };
        }

        // Parse the header
        const length = buffer.readUInt16BE(BgpConst.BGP_MARKER_LEN);
        const type = buffer[BgpConst.BGP_MARKER_LEN + 2];

        // Check if the buffer contains the complete packet
        if (buffer.length < length) {
            return {
                valid: false,
                error: `Incomplete packet: expected ${length} bytes, got ${buffer.length}`
            };
        }

        // Parse the packet based on the message type
        let packet = {
            type,
            length,
            valid: true
        };

        // Add the parsed data based on message type
        switch (type) {
            case BgpConst.BGP_PACKET_TYPE.OPEN:
                packet = { ...packet, ...parseOpenMessage(buffer) };
                break;
            case BgpConst.BGP_PACKET_TYPE.UPDATE:
                packet = { ...packet, ...parseUpdateMessage(buffer) };
                break;
            case BgpConst.BGP_PACKET_TYPE.NOTIFICATION:
                packet = { ...packet, ...parseNotificationMessage(buffer) };
                break;
            case BgpConst.BGP_PACKET_TYPE.KEEPALIVE:
                // Keepalive has no additional data
                break;
            case BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH:
                packet = { ...packet, ...parseRouteRefreshMessage(buffer) };
                break;
            default:
                packet.valid = false;
                packet.error = `Unknown packet type: ${type}`;
        }

        return packet;
    } catch (error) {
        return {
            valid: false,
            error: `Error parsing BGP packet: ${error.message}`
        };
    }
}

/**
 * Parse BGP OPEN message
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @returns {Object} Parsed OPEN message data
 */
function parseOpenMessage(buffer) {
    let position = BgpConst.BGP_HEAD_LEN;
    const version = buffer[position];
    position += 1;
    const asn = buffer.readUInt16BE(position);
    position += 2;
    const holdTime = buffer.readUInt16BE(position);
    position += 2;
    const routerId = `${buffer[position]}.${buffer[position + 1]}.${buffer[position + 2]}.${buffer[position + 3]}`;
    position += 4;
    const optParamLen = buffer[position];
    position += 1;

    const result = {
        version,
        asn,
        holdTime,
        routerId,
        optParamLen,
        capabilities: []
    };

    // Parse optional parameters (capabilities)
    if (optParamLen > 0) {
        const optParamsEnd = position + optParamLen;

        while (position < optParamsEnd) {
            const paramType = buffer[position];
            const paramLen = buffer[position + 1];
            position += 2;

            // Parameter type 2 is capability
            if (paramType === BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE) {
                let capPosition = position;
                let capPositionEnd = capPosition + paramLen;

                // Parse capability value based on capability code
                while (capPosition < capPositionEnd) {
                    const capCode = buffer[capPosition];
                    const capLen = buffer[capPosition + 1];
                    capPosition += 2;

                    const capability = {
                        code: capCode,
                        length: capLen
                    };

                    let tempPosition = capPosition;
                    switch (capCode) {
                        case BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS: // Multiprotocol Extensions
                            if (capLen >= 4) {
                                const afi = buffer.readUInt16BE(tempPosition);
                                tempPosition += 2;
                                // 1字节保留字段
                                tempPosition += 1;
                                const safi = buffer[tempPosition];
                                tempPosition += 1;
                                capability.afi = afi;
                                capability.safi = safi;
                            }
                            break;
                        case BgpConst.BGP_OPEN_CAP_CODE.FOUR_OCTET_AS: // 4-octet AS number
                            if (capLen >= 4) {
                                capability.as4 = buffer.readUInt32BE(tempPosition);
                                tempPosition += 4;
                            }
                            break;
                        case BgpConst.BGP_OPEN_CAP_CODE.BGP_ROLE: // BGP Role Capability
                            if (capLen >= 1) {
                                capability.role = buffer[tempPosition];
                                tempPosition += 1;
                            }
                            break;
                        case BgpConst.BGP_OPEN_CAP_CODE.EXTENDED_NEXT_HOP_ENCODING: // Extended Next Hop Encoding
                            if (capLen >= 6) {
                                capability.afi = buffer.readUInt16BE(tempPosition);
                                tempPosition += 2;
                                capability.safi = buffer.readUInt16BE(tempPosition);
                                tempPosition += 2;
                                capability.ipType = buffer.readUInt16BE(tempPosition);
                                tempPosition += 2;
                            }
                            break;
                        // Other capabilities could be added here
                    }
                    result.capabilities.push(capability);
                    capPosition += capLen;
                }
                position += paramLen;
            } else {
                position += paramLen;
            }
        }
    }

    return result;
}

/**
 * Parse BGP UPDATE message
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @returns {Object} Parsed UPDATE message data
 */
function parseUpdateMessage(buffer) {
    let position = BgpConst.BGP_HEAD_LEN;
    const withdrawnRoutesLength = buffer.readUInt16BE(position);
    position += 2;
    const withdrawnRoutes = [];

    // Parse withdrawn routes
    const withdrawnRoutesEnd = position + withdrawnRoutesLength;
    while (position < withdrawnRoutesEnd) {
        const prefixLength = buffer[position];
        position += 1;

        // Calculate bytes needed for the prefix
        const prefixBytes = Math.ceil(prefixLength / 8);

        // Extract the prefix
        const prefixBuffer = buffer.subarray(position, position + prefixBytes);
        position += prefixBytes;

        // Convert to dotted decimal format for IPv4
        const prefix = ipv4BufferToString(prefixBuffer, prefixLength);

        withdrawnRoutes.push({
            prefix,
            length: prefixLength
        });
    }

    // Parse path attributes
    const pathAttributesLength = buffer.readUInt16BE(position);
    position += 2;

    const pathAttributes = [];
    const pathAttributesEnd = position + pathAttributesLength;

    while (position < pathAttributesEnd) {
        const flags = buffer[position];
        const typeCode = buffer[position + 1];
        position += 2;

        const extendedLength = (flags & BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH) !== 0;
        let attributeLength;

        if (extendedLength) {
            attributeLength = buffer.readUInt16BE(position);
            position += 2;
        } else {
            attributeLength = buffer[position];
            position += 1;
        }

        const attributeValue = buffer.subarray(position, position + attributeLength);
        position += attributeLength;

        const attribute = {
            flags,
            typeCode,
            length: attributeLength,
            value: attributeValue
        };

        // Parse specific attribute types
        switch (typeCode) {
            case BgpConst.BGP_PATH_ATTR.ORIGIN: // ORIGIN
                attribute.origin = getBgpOriginType(attributeValue[0]);
                break;
            case BgpConst.BGP_PATH_ATTR.AS_PATH: // AS_PATH
                attribute.segments = parseAsPath(attributeValue);
                break;
            case BgpConst.BGP_PATH_ATTR.NEXT_HOP: // NEXT_HOP
                attribute.nextHop = `${attributeValue[0]}.${attributeValue[1]}.${attributeValue[2]}.${attributeValue[3]}`;
                break;
            case BgpConst.BGP_PATH_ATTR.MED: // MED
                attribute.med = attributeValue.readUInt32BE(0);
                break;
            case BgpConst.BGP_PATH_ATTR.LOCAL_PREF: // LOCAL_PREF
                attribute.localPref = attributeValue.readUInt32BE(0);
                break;
            case BgpConst.BGP_PATH_ATTR.ATOMIC_AGGREGATE: // ATOMIC_AGGREGATE
                // No value for atomic aggregate
                break;
            case BgpConst.BGP_PATH_ATTR.AGGREGATOR: // AGGREGATOR
                attribute.aggregatorAs = attributeValue.readUInt16BE(0);
                attribute.aggregatorIp = `${attributeValue[2]}.${attributeValue[3]}.${attributeValue[4]}.${attributeValue[5]}`;
                break;
            case BgpConst.BGP_PATH_ATTR.COMMUNITY: // COMMUNITY
                attribute.communities = parseCommunities(attributeValue);
                break;
            case BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI: // MP_REACH_NLRI
                attribute.mpReach = parseMpReachNlri(attributeValue);
                break;
            case BgpConst.BGP_PATH_ATTR.MP_UNREACH_NLRI: // MP_UNREACH_NLRI
                attribute.mpUnreach = parseMpUnreachNlri(attributeValue);
                break;
            case BgpConst.BGP_PATH_ATTR.PATH_OTC: // OTC
                attribute.otc = attributeValue.readUInt32BE(0);
                break;
        }

        pathAttributes.push(attribute);
    }

    // Parse NLRI
    const nlri = [];
    while (position < buffer.length) {
        const prefixLength = buffer[position];
        position += 1;

        // Calculate bytes needed for the prefix
        const prefixBytes = Math.ceil(prefixLength / 8);

        // Extract the prefix
        const prefixBuffer = buffer.subarray(position, position + prefixBytes);
        position += prefixBytes;

        // Convert to dotted decimal format for IPv4
        const prefix = ipv4BufferToString(prefixBuffer, prefixLength);

        nlri.push({
            prefix,
            length: prefixLength
        });
    }

    return {
        withdrawnRoutesLength,
        withdrawnRoutes,
        pathAttributesLength,
        pathAttributes,
        nlri
    };
}

/**
 * Parse BGP NOTIFICATION message
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @returns {Object} Parsed NOTIFICATION message data
 */
function parseNotificationMessage(buffer) {
    let position = BgpConst.BGP_HEAD_LEN;
    const errorCode = buffer[position];
    position += 1;
    const errorSubcode = buffer[position];
    position += 1;

    const data = buffer.subarray(position);

    return {
        errorCode,
        errorSubcode,
        data
    };
}

/**
 * Parse BGP ROUTE-REFRESH message
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @returns {Object} Parsed ROUTE-REFRESH message data
 */
function parseRouteRefreshMessage(buffer) {
    let position = BgpConst.BGP_HEAD_LEN;
    const afi = buffer.readUInt16BE(position);
    position += 2;
    const subType = buffer[position];
    position += 1;
    const safi = buffer[position];

    return {
        afi,
        subType,
        safi
    };
}

/**
 * Parse AS_PATH attribute
 * @param {Buffer} buffer - AS_PATH attribute value
 * @returns {Array} Array of AS path segments
 */
function parseAsPath(buffer) {
    const segments = [];
    let position = 0;

    while (position < buffer.length) {
        const segmentType = buffer[position];
        const segmentLength = buffer[position + 1];
        position += 2;

        const asNumbers = [];
        for (let i = 0; i < segmentLength; i++) {
            asNumbers.push(buffer.readUInt32BE(position));
            position += 4;
        }

        segments.push({
            type: segmentType,
            typeName: getBgpAsPathTypeName(segmentType),
            asNumbers
        });
    }

    return segments;
}

/**
 * Parse COMMUNITIES attribute
 * @param {Buffer} buffer - COMMUNITIES attribute value
 * @returns {Array} Array of community values
 */
function parseCommunities(buffer) {
    const communities = [];

    for (let i = 0; i < buffer.length; i += 4) {
        const value = buffer.readUInt32BE(i);
        const highOrder = (value >> 16) & 0xffff;
        const lowOrder = value & 0xffff;

        communities.push({
            value,
            formatted: `${highOrder}:${lowOrder}`
        });
    }

    return communities;
}

/**
 * Parse MP_REACH_NLRI attribute
 * @param {Buffer} buffer - MP_REACH_NLRI attribute value
 * @returns {Object} Parsed MP_REACH_NLRI data
 */
function parseMpReachNlri(buffer) {
    let position = 0;
    const afi = buffer.readUInt16BE(position);
    position += 2;
    const safi = buffer[position];
    position += 1;
    const nextHopLength = buffer[position];
    position += 1;

    let nextHop = '';

    // Parse next hop based on AFI
    if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4) {
        // IPv4
        nextHop = ipv4BufferToString(buffer.subarray(position, position + 4), 32);
    } else if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6) {
        // IPv6
        nextHop = ipv6BufferToString(buffer.subarray(position, position + 16), 128);
    }

    position += nextHopLength;

    // Skip the reserved byte
    position += 1;

    // Parse NLRI
    const nlri = [];
    while (position < buffer.length) {
        const prefixLength = buffer[position];
        position += 1;

        // Calculate bytes needed for the prefix
        const prefixBytes = Math.ceil(prefixLength / 8);

        // Extract the prefix
        const prefixBuffer = buffer.subarray(position, position + prefixBytes);
        position += prefixBytes;

        // Format the prefix based on AFI
        let prefix;
        if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4) {
            // IPv4
            prefix = ipv4BufferToString(prefixBuffer, prefixLength);
        } else if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6) {
            // IPv6
            prefix = ipv6BufferToString(prefixBuffer, prefixLength);
        }

        nlri.push({
            prefix,
            length: prefixLength
        });
    }

    return {
        afi,
        safi,
        nextHopLength,
        nextHop,
        nlri
    };
}

/**
 * Parse MP_UNREACH_NLRI attribute
 * @param {Buffer} buffer - MP_UNREACH_NLRI attribute value
 * @returns {Object} Parsed MP_UNREACH_NLRI data
 */
function parseMpUnreachNlri(buffer) {
    let position = 0;
    const afi = buffer.readUInt16BE(position);
    position += 2;
    const safi = buffer[position];
    position += 1;

    // Parse withdrawn routes
    const withdrawnRoutes = [];
    while (position < buffer.length) {
        const prefixLength = buffer[position];
        position += 1;

        // Calculate bytes needed for the prefix
        const prefixBytes = Math.ceil(prefixLength / 8);

        // Extract the prefix
        const prefixBuffer = buffer.subarray(position, position + prefixBytes);
        position += prefixBytes;

        // Format the prefix based on AFI
        let prefix;
        if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4) {
            // IPv4
            prefix = ipv4BufferToString(prefixBuffer, prefixLength);
        } else if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6) {
            // IPv6
            prefix = ipv6BufferToString(prefixBuffer, prefixLength);
        }

        withdrawnRoutes.push({
            prefix,
            length: prefixLength
        });
    }

    return {
        afi,
        safi,
        withdrawnRoutes
    };
}

/**
 * Helper function to get a human-readable summary of a BGP packet
 * @param {Object} parsedPacket - The parsed BGP packet object
 * @returns {String} Human-readable summary
 */
function getBgpPacketSummary(parsedPacket) {
    if (!parsedPacket || !parsedPacket.valid) {
        return `Invalid BGP packet: ${parsedPacket?.error || 'Unknown error'}`;
    }

    const typeName = getBgpPacketTypeName(parsedPacket.type);
    let summary = `BGP ${typeName} Message (${parsedPacket.length} bytes)`;

    switch (parsedPacket.type) {
        case BgpConst.BGP_PACKET_TYPE.OPEN: // OPEN
            summary += `\nVersion: ${parsedPacket.version}`;
            summary += `\nAS: ${parsedPacket.asn}`;
            summary += `\nHold Time: ${parsedPacket.holdTime} seconds`;
            summary += `\nRouter ID: ${parsedPacket.routerId}`;

            if (parsedPacket.capabilities && parsedPacket.capabilities.length > 0) {
                summary += '\nCapabilities:';
                parsedPacket.capabilities.forEach(cap => {
                    const capName = getBgpOpenCapabilityName(cap.code);
                    summary += `\n  - ${capName}`;

                    if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS) {
                        // Multiprotocol
                        const afiName = getBgpAfiName(cap.afi);
                        const safiName = getBgpSafiName(cap.safi);
                        summary += ` (${afiName}/${safiName})`;
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.FOUR_OCTET_AS) {
                        // 4-octet AS
                        summary += ` (AS${cap.as4})`;
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.BGP_ROLE) {
                        // BGP Role
                        const roleName = getBgpOpenRoleName(cap.role);
                        summary += ` (${roleName})`;
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.EXTENDED_NEXT_HOP_ENCODING) {
                        // Extended Next Hop Encoding
                        const afiName = getBgpAfiName(cap.afi);
                        const safiName = getBgpSafiName(cap.safi);
                        const ipTypeName = getIpTypeName(cap.ipType);
                        summary += ` (${afiName}/${safiName}/${ipTypeName})`;
                    }
                });
            }
            break;

        case BgpConst.BGP_PACKET_TYPE.UPDATE: // UPDATE
            if (parsedPacket.withdrawnRoutes && parsedPacket.withdrawnRoutes.length > 0) {
                summary += '\nWithdrawn Routes:';
                parsedPacket.withdrawnRoutes.forEach(route => {
                    summary += `\n  - ${route.prefix}/${route.length}`;
                });
            }

            if (parsedPacket.pathAttributes && parsedPacket.pathAttributes.length > 0) {
                summary += '\nPath Attributes:';
                parsedPacket.pathAttributes.forEach(attr => {
                    const attrName = getBgpPathAttrTypeName(attr.typeCode);
                    summary += `\n  - ${attrName}`;

                    if (attr.typeCode === BgpConst.BGP_PATH_ATTR.ORIGIN) {
                        summary += `: ${attr.origin}`;
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.AS_PATH) {
                        if (attr.segments) {
                            summary += ': ';
                            attr.segments.forEach(seg => {
                                if (seg.typeName === 'AS_SEQUENCE') {
                                    summary += seg.asNumbers.join(' ');
                                } else {
                                    summary += `{${seg.asNumbers.join(' ')}}`;
                                }
                            });
                        }
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.NEXT_HOP) {
                        summary += `: ${attr.nextHop}`;
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.LOCAL_PREF) {
                        summary += `: ${attr.localPref}`;
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.COMMUNITY) {
                        if (attr.communities) {
                            summary += `: ${attr.communities.map(c => c.formatted).join(' ')}`;
                        }
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.MED) {
                        summary += `: ${attr.med}`;
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI) {
                        const afiName = getBgpAfiName(attr.mpReach.afi);
                        const safiName = getBgpSafiName(attr.mpReach.safi);
                        summary += `\n    - (${afiName}/${safiName}: ${attr.mpReach.nextHop})`;
                        if (attr.mpReach.nlri && attr.mpReach.nlri.length > 0) {
                            summary += '\n    - Routes:';
                            attr.mpReach.nlri.forEach(route => {
                                summary += `\n      - ${route.prefix}/${route.length}`;
                            });
                        }
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.MP_UNREACH_NLRI) {
                        const afiName = getBgpAfiName(attr.mpUnreach.afi);
                        const safiName = getBgpSafiName(attr.mpUnreach.safi);
                        summary += `\n    - (${afiName}/${safiName})`;
                        if (attr.mpUnreach.withdrawnRoutes && attr.mpUnreach.withdrawnRoutes.length > 0) {
                            summary += '\n    - Routes:';
                            attr.mpUnreach.withdrawnRoutes.forEach(route => {
                                summary += `\n      - ${route.prefix}/${route.length}`;
                            });
                        }
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.PATH_OTC) {
                        summary += `: ${attr.otc}`;
                    }
                });
            }

            if (parsedPacket.nlri && parsedPacket.nlri.length > 0) {
                summary += '\nRoutes:';
                parsedPacket.nlri.forEach(route => {
                    summary += `\n  - ${route.prefix}/${route.length}`;
                });
            }
            break;

        case BgpConst.BGP_PACKET_TYPE.NOTIFICATION: // NOTIFICATION
            {
                const errorName = getBgpNotificationErrorName(parsedPacket.errorCode, parsedPacket.errorSubcode);
                summary += `\nError: ${errorName}`;
                summary += `\nError Code: ${parsedPacket.errorCode}`;
                summary += `\nError Subcode: ${parsedPacket.errorSubcode}`;
            }
            break;

        case BgpConst.BGP_PACKET_TYPE.KEEPALIVE: // KEEPALIVE
            // No additional information for keepalive
            break;

        case BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH: // ROUTE-REFRESH
            {
                const afiName = getBgpAfiName(parsedPacket.afi);
                const safiName = getBgpSafiName(parsedPacket.safi);
                summary += `\nAddress Family: ${afiName}`;
                summary += `\nSubsequent Address Family: ${safiName}`;
            }
            break;
    }

    return summary;
}

module.exports = {
    parseBgpPacket,
    getBgpPacketSummary
};
