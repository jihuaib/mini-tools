/**
 * BGP Packet Parser
 *
 * Parses BGP protocol packets from raw buffers and returns structured data.
 * Based on RFC 4271 and other BGP extension RFCs.
 */

// Import constants from existing BGP constants file
const BgpConst = require('../const/bgpConst');

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
 * Get readable packet type name
 * @param {Number} type - BGP packet type number
 * @returns {String} Name of the packet type
 */
function getPacketTypeName(type) {
    switch (type) {
        case BgpConst.BGP_PACKET_TYPE.OPEN:
            return 'OPEN';
        case BgpConst.BGP_PACKET_TYPE.UPDATE:
            return 'UPDATE';
        case BgpConst.BGP_PACKET_TYPE.NOTIFICATION:
            return 'NOTIFICATION';
        case BgpConst.BGP_PACKET_TYPE.KEEPALIVE:
            return 'KEEPALIVE';
        case BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH:
            return 'ROUTE_REFRESH';
        default:
            return 'UNKNOWN';
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
        const prefix = formatIpv4Prefix(prefixBuffer, prefixLength);

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
                attribute.origin = getOriginType(attributeValue[0]);
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
        const prefix = formatIpv4Prefix(prefixBuffer, prefixLength);

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
 * Helper function to format IPv4 prefix from buffer
 * @param {Buffer} buffer - Buffer containing the IP prefix
 * @param {Number} length - Prefix length in bits
 * @returns {String} Formatted IP prefix
 */
function formatIpv4Prefix(buffer, length) {
    const fullBytes = Math.floor(length / 8);
    const remainingBits = length % 8;

    // Create a 4-byte buffer filled with zeros
    const ipBuffer = Buffer.alloc(4);

    // Copy the available bytes
    buffer.copy(ipBuffer, 0, 0, buffer.length);

    // If there are remaining bits, mask the last byte
    if (remainingBits > 0 && fullBytes < 4) {
        const mask = 0xff & (0xff << (8 - remainingBits));
        ipBuffer[fullBytes] &= mask;
    }

    return `${ipBuffer[0]}.${ipBuffer[1]}.${ipBuffer[2]}.${ipBuffer[3]}`;
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
            typeName: getAsPathSegmentTypeName(segmentType),
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
        nextHop = `${buffer[position]}.${buffer[position + 1]}.${buffer[position + 2]}.${buffer[position + 3]}`;
    } else if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6) {
        // IPv6
        nextHop = formatIpv6Address(buffer.subarray(position, position + 16));
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
            prefix = formatIpv4Prefix(prefixBuffer, prefixLength);
        } else if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6) {
            // IPv6
            prefix = formatIpv6Prefix(prefixBuffer, prefixLength);
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
            prefix = formatIpv4Prefix(prefixBuffer, prefixLength);
        } else if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6) {
            // IPv6
            prefix = formatIpv6Prefix(prefixBuffer, prefixLength);
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
 * Format IPv6 address from buffer
 * @param {Buffer} buffer - Buffer containing the IPv6 address
 * @returns {String} Formatted IPv6 address
 */
function formatIpv6Address(buffer) {
    const segments = [];
    for (let i = 0; i < 16; i += 2) {
        segments.push(buffer.readUInt16BE(i).toString(16));
    }
    return segments.join(':');
}

/**
 * Format IPv6 prefix from buffer
 * @param {Buffer} buffer - Buffer containing the IPv6 prefix
 * @param {Number} length - Prefix length in bits
 * @returns {String} Formatted IPv6 prefix
 */
function formatIpv6Prefix(buffer, length) {
    // Create a 16-byte buffer filled with zeros
    const ipBuffer = Buffer.alloc(16);

    // Copy the available bytes
    buffer.copy(ipBuffer, 0, 0, buffer.length);

    // Format as IPv6 address
    return formatIpv6Address(ipBuffer);
}

/**
 * Get capability name from code
 * @param {Number} code - Capability code
 * @returns {String} Capability name
 */
function getCapabilityName(code) {
    switch (code) {
        case BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS:
            return 'Multiprotocol Extensions';
        case BgpConst.BGP_OPEN_CAP_CODE.ROUTE_REFRESH:
            return 'Route Refresh';
        case BgpConst.BGP_OPEN_CAP_CODE.FOUR_OCTET_AS:
            return '4-octet AS Number';
        case BgpConst.BGP_OPEN_CAP_CODE.BGP_ROLE:
            return 'BGP Role';
        default:
            return `Unknown (${code})`;
    }
}

/**
 * Get AFI name from code
 * @param {Number} afi - Address Family Identifier
 * @returns {String} AFI name
 */
function getAfiName(afi) {
    switch (afi) {
        case BgpConst.BGP_AFI_TYPE.AFI_IPV4:
            return 'IPv4';
        case BgpConst.BGP_AFI_TYPE.AFI_IPV6:
            return 'IPv6';
        default:
            return `Unknown (${afi})`;
    }
}

/**
 * Get SAFI name from code
 * @param {Number} safi - Subsequent Address Family Identifier
 * @returns {String} SAFI name
 */
function getSafiName(safi) {
    switch (safi) {
        case BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST:
            return 'Unicast';
        case BgpConst.BGP_SAFI_TYPE.SAFI_MULTICAST:
            return 'Multicast';
        case BgpConst.BGP_SAFI_TYPE.SAFI_MPLS_LABEL:
            return 'MPLS Label';
        case BgpConst.BGP_SAFI_TYPE.SAFI_MPLS_VPN:
            return 'MPLS VPN';
        default:
            return `Unknown (${safi})`;
    }
}

/**
 * Get BGP role name from code
 * @param {Number} role - BGP role code
 * @returns {String} Role name
 */
function getRoleName(role) {
    switch (role) {
        case BgpConst.BGP_ROLE_TYPE.ROLE_PROVIDER:
            return 'Provider';
        case BgpConst.BGP_ROLE_TYPE.ROLE_RS:
            return 'Route Server';
        case BgpConst.BGP_ROLE_TYPE.ROLE_RS_CLIENT:
            return 'Route Server Client';
        case BgpConst.BGP_ROLE_TYPE.ROLE_CUSTOMER:
            return 'Customer';
        case BgpConst.BGP_ROLE_TYPE.ROLE_PEER:
            return 'Lateral Peer';
        default:
            return `Unknown (${role})`;
    }
}

/**
 * Get attribute type name from code
 * @param {Number} typeCode - Attribute type code
 * @returns {String} Attribute type name
 */
function getAttributeTypeName(typeCode) {
    switch (typeCode) {
        case BgpConst.BGP_PATH_ATTR.ORIGIN:
            return 'ORIGIN';
        case BgpConst.BGP_PATH_ATTR.AS_PATH:
            return 'AS_PATH';
        case BgpConst.BGP_PATH_ATTR.NEXT_HOP:
            return 'NEXT_HOP';
        case BgpConst.BGP_PATH_ATTR.MED:
            return 'MULTI_EXIT_DISC';
        case BgpConst.BGP_PATH_ATTR.LOCAL_PREF:
            return 'LOCAL_PREF';
        case BgpConst.BGP_PATH_ATTR.ATOMIC_AGGREGATE:
            return 'ATOMIC_AGGREGATE';
        case BgpConst.BGP_PATH_ATTR.AGGREGATOR:
            return 'AGGREGATOR';
        case BgpConst.BGP_PATH_ATTR.COMMUNITY:
            return 'COMMUNITY';
        case BgpConst.BGP_PATH_ATTR.ORIGINATOR_ID:
            return 'ORIGINATOR_ID';
        case BgpConst.BGP_PATH_ATTR.CLUSTER_LIST:
            return 'CLUSTER_LIST';
        case BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI:
            return 'MP_REACH_NLRI';
        case BgpConst.BGP_PATH_ATTR.MP_UNREACH_NLRI:
            return 'MP_UNREACH_NLRI';
        case BgpConst.BGP_PATH_ATTR.EXTENDED_COMMUNITIES:
            return 'EXTENDED_COMMUNITIES';
        case BgpConst.BGP_PATH_ATTR.AS4_PATH:
            return 'AS4_PATH';
        case BgpConst.BGP_PATH_ATTR.AS4_AGGREGATOR:
            return 'AS4_AGGREGATOR';
        case BgpConst.BGP_PATH_ATTR.PATH_OTC:
            return 'OTC';
        default:
            return `Unknown (${typeCode})`;
    }
}

/**
 * Get origin type from code
 * @param {Number} origin - Origin code
 * @returns {String} Origin name
 */
function getOriginType(origin) {
    switch (origin) {
        case BgpConst.BGP_ORIGIN_TYPE.IGP:
            return 'IGP';
        case BgpConst.BGP_ORIGIN_TYPE.EGP:
            return 'EGP';
        case BgpConst.BGP_ORIGIN_TYPE.INCOMPLETE:
            return 'INCOMPLETE';
        default:
            return `Unknown (${origin})`;
    }
}

/**
 * Get AS_PATH segment type name from code
 * @param {Number} segmentType - AS_PATH segment type code
 * @returns {String} Segment type name
 */
function getAsPathSegmentTypeName(segmentType) {
    switch (segmentType) {
        case BgpConst.BGP_AS_PATH_TYPE.AS_SET:
            return 'AS_SET';
        case BgpConst.BGP_AS_PATH_TYPE.AS_SEQUENCE:
            return 'AS_SEQUENCE';
        case BgpConst.BGP_AS_PATH_TYPE.AS_CONFED_SEQUENCE:
            return 'AS_CONFED_SEQUENCE';
        case BgpConst.BGP_AS_PATH_TYPE.AS_CONFED_SET:
            return 'AS_CONFED_SET';
        default:
            return `Unknown (${segmentType})`;
    }
}

/**
 * Get error name from error code and subcode
 * @param {Number} errorCode - BGP error code
 * @param {Number} errorSubcode - BGP error subcode
 * @returns {String} Error name
 */
function getErrorName(errorCode, errorSubcode) {
    switch (errorCode) {
        case BgpConst.BGP_ERROR_CODE.MESSAGE_HEADER_ERROR: // Message Header Error
            switch (errorSubcode) {
                case BgpConst.BGP_ERROR_SUBCODE.CONNECTION_NOT_SYNCHRONIZED:
                    return 'Connection Not Synchronized';
                case BgpConst.BGP_ERROR_MESSAGE_HEADER_SUBCODE.BAD_MESSAGE_LENGTH:
                    return 'Bad Message Length';
                case BgpConst.BGP_ERROR_MESSAGE_HEADER_SUBCODE.BAD_MESSAGE_TYPE:
                    return 'Bad Message Type';
                default:
                    return `Message Header Error (${errorSubcode})`;
            }
        case BgpConst.BGP_ERROR_CODE.OPEN_MESSAGE_ERROR: // OPEN Message Error
            switch (errorSubcode) {
                case BgpConst.BGP_ERROR_OPEN_MESSAGE_SUBCODE.UNSUPPORTED_VERSION_NUMBER:
                    return 'Unsupported Version Number';
                case BgpConst.BGP_ERROR_OPEN_MESSAGE_SUBCODE.BAD_PEER_AS:
                    return 'Bad Peer AS';
                case BgpConst.BGP_ERROR_OPEN_MESSAGE_SUBCODE.BAD_BGP_IDENTIFIER:
                    return 'Bad BGP Identifier';
                case BgpConst.BGP_ERROR_OPEN_MESSAGE_SUBCODE.UNSUPPORTED_OPTIONAL_PARAMETER:
                    return 'Unsupported Optional Parameter';
                case BgpConst.BGP_ERROR_OPEN_MESSAGE_SUBCODE.AUTHENTICATION_FAILURE:
                    return 'Authentication Failure';
                case BgpConst.BGP_ERROR_OPEN_MESSAGE_SUBCODE.UNACCEPTABLE_HOLD_TIME:
                    return 'Unacceptable Hold Time';
                case BgpConst.BGP_ERROR_OPEN_MESSAGE_SUBCODE.UNSUPPORTED_CAPABILITY:
                    return 'Unsupported Capability';
                default:
                    return `OPEN Message Error (${errorSubcode})`;
            }
        case BgpConst.BGP_ERROR_CODE.UPDATE_MESSAGE_ERROR: // UPDATE Message Error
            switch (errorSubcode) {
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.UNSUPPORTED_ADDRESS_FAMILY:
                    return 'Unsupported Address Family';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.UNSUPPORTED_NEXT_HOP_ADDRESS_FAMILY:
                    return 'Unsupported Next Hop Address Family';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.UNSUPPORTED_MULTICAST_ADDRESS_FAMILY:
                    return 'Unsupported Multicast Address Family';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.ATTRIBUTE_FLAGS_ERROR:
                    return 'Attribute Flags Error';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.ATTRIBUTE_LENGTH_ERROR:
                    return 'Attribute Length Error';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.INVALID_ORIGIN_ATTRIBUTE:
                    return 'Invalid ORIGIN Attribute';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.INVALID_NEXT_HOP_ATTRIBUTE:
                    return 'Invalid NEXT_HOP Attribute';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.OPTIONAL_ATTRIBUTE_ERROR:
                    return 'Optional Attribute Error';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.INVALID_NETWORK_FIELD:
                    return 'Invalid Network Field';
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.MALFORMED_AS_PATH:
                    return 'Malformed AS_PATH';
                default:
                    return `UPDATE Message Error (${errorSubcode})`;
            }
        case BgpConst.BGP_ERROR_CODE.HOLD_TIMER_EXPIRED: // Hold Timer Expired
            return 'Hold Timer Expired';
        case BgpConst.BGP_ERROR_CODE.FINITE_STATE_MACHINE_ERROR: // Finite State Machine Error
            return 'Finite State Machine Error';
        case BgpConst.BGP_ERROR_CODE.CONNECTION_REJECTED: // Cease
            switch (errorSubcode) {
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.MAX_PREFIXES:
                    return 'Maximum Number of Prefixes Reached';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.ADMIN_SHUTDOWN:
                    return 'Administrative Shutdown';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.PEER_DE_CONFIGURED:
                    return 'Peer De-configured';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.ADMIN_RESET:
                    return 'Administrative Reset';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.CONNECTION_REJECTED:
                    return 'Connection Rejected';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.OTHER_CONFIGURATION_CHANGE:
                    return 'Other Configuration Change';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.CONNECTION_COLLISION_RESOLUTION:
                    return 'Connection Collision Resolution';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.OUT_OF_RESOURCES:
                    return 'Out of Resources';
                default:
                    return `Cease (${errorSubcode})`;
            }
        default:
            return `Unknown Error (${errorCode}/${errorSubcode})`;
    }
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

    const typeName = getPacketTypeName(parsedPacket.type);
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
                    const capName = getCapabilityName(cap.code);
                    summary += `\n  - ${capName}`;

                    if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS) {
                        // Multiprotocol
                        const afiName = getAfiName(cap.afi);
                        const safiName = getSafiName(cap.safi);
                        summary += ` (${afiName}/${safiName})`;
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.FOUR_OCTET_AS) {
                        // 4-octet AS
                        summary += ` (AS${cap.as4})`;
                    } else if (cap.code === BgpConst.BGP_OPEN_CAP_CODE.BGP_ROLE) {
                        // BGP Role
                        const roleName = getRoleName(cap.role);
                        summary += ` (${roleName})`;
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
                    const attrName = getAttributeTypeName(attr.typeCode);
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
                        const afiName = getAfiName(attr.mpReach.afi);
                        const safiName = getSafiName(attr.mpReach.safi);
                        summary += `\n    - (${afiName}/${safiName}: ${attr.mpReach.nextHop})`;
                        if (attr.mpReach.nlri && attr.mpReach.nlri.length > 0) {
                            summary += '\n    - Routes:';
                            attr.mpReach.nlri.forEach(route => {
                                summary += `\n      - ${route.prefix}/${route.length}`;
                            });
                        }
                    } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.MP_UNREACH_NLRI) {
                        const afiName = getAfiName(attr.mpUnreach.afi);
                        const safiName = getSafiName(attr.mpUnreach.safi);
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
            const errorName = getErrorName(parsedPacket.errorCode, parsedPacket.errorSubcode);
            summary += `\nError: ${errorName}`;
            summary += `\nError Code: ${parsedPacket.errorCode}`;
            summary += `\nError Subcode: ${parsedPacket.errorSubcode}`;
            break;

        case BgpConst.BGP_PACKET_TYPE.KEEPALIVE: // KEEPALIVE
            // No additional information for keepalive
            break;

        case BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH: // ROUTE-REFRESH
            const afiName = getAfiName(parsedPacket.afi);
            const safiName = getSafiName(parsedPacket.safi);
            summary += `\nAddress Family: ${afiName}`;
            summary += `\nSubsequent Address Family: ${safiName}`;
            break;
    }

    return summary;
}

module.exports = {
    parseBgpPacket,
    getBgpPacketSummary
};
