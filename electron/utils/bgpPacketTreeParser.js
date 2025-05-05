/**
 * BGP Tree Parser
 *
 * Parses BGP protocol packets into a tree structure with field offsets and lengths.
 * Based on RFC 4271 and other BGP extension RFCs.
 */

const BgpConst = require('../const/bgpConst');
const { ipv4BufferToString, ipv6BufferToString } = require('./ipUtils');

/**
 * Parse a BGP packet into a tree structure
 * @param {Buffer} buffer - The raw BGP packet buffer
 * @returns {Object} Tree structure with offsets and lengths for each field
 */
function parseBgpPacketTree(buffer) {
    try {
        // Check if buffer is valid
        if (!Buffer.isBuffer(buffer) || buffer.length < BgpConst.BGP_HEAD_LEN) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        // Start building the tree structure
        const tree = {
            name: 'BGP Packet',
            offset: 0,
            length: buffer.length,
            value: '',
            children: []
        };

        // Parse BGP Header
        const headerNode = {
            name: 'BGP Header',
            offset: 0,
            length: BgpConst.BGP_HEAD_LEN,
            value: '',
            children: []
        };
        tree.children.push(headerNode);

        // Parse Marker
        const markerNode = {
            name: 'Marker',
            offset: 0,
            length: BgpConst.BGP_MARKER_LEN,
            value: 'All ones (0xFF)',
            children: []
        };
        headerNode.children.push(markerNode);

        // Check if the BGP marker is valid (16 bytes of 0xFF)
        const marker = buffer.subarray(0, BgpConst.BGP_MARKER_LEN);
        if (!marker.every(byte => byte === 0xff)) {
            return {
                valid: false,
                error: 'Invalid BGP marker',
                tree
            };
        }

        // Parse Length
        const length = buffer.readUInt16BE(BgpConst.BGP_MARKER_LEN);
        const lengthNode = {
            name: 'Length',
            offset: BgpConst.BGP_MARKER_LEN,
            length: 2,
            value: length,
            children: []
        };
        headerNode.children.push(lengthNode);

        // Parse Type
        const type = buffer[BgpConst.BGP_MARKER_LEN + 2];
        const typeName = getPacketTypeName(type);
        const typeNode = {
            name: 'Type',
            offset: BgpConst.BGP_MARKER_LEN + 2,
            length: 1,
            value: `${type} (${typeName})`,
            children: []
        };
        headerNode.children.push(typeNode);

        // Check if the buffer contains the complete packet
        if (buffer.length < length) {
            return {
                valid: false,
                error: `Incomplete packet: expected ${length} bytes, got ${buffer.length}`,
                tree
            };
        }

        // Parse message body based on message type
        switch (type) {
            case BgpConst.BGP_PACKET_TYPE.OPEN:
                parseOpenMessageTree(buffer, tree);
                break;
            case BgpConst.BGP_PACKET_TYPE.UPDATE:
                parseUpdateMessageTree(buffer, tree);
                break;
            case BgpConst.BGP_PACKET_TYPE.NOTIFICATION:
                parseNotificationMessageTree(buffer, tree);
                break;
            case BgpConst.BGP_PACKET_TYPE.KEEPALIVE:
                // Keepalive has no additional data
                break;
            case BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH:
                parseRouteRefreshMessageTree(buffer, tree);
                break;
            default:
                return {
                    valid: false,
                    error: `Unknown packet type: ${type}`,
                    tree
                };
        }

        return {
            valid: true,
            tree
        };
    } catch (error) {
        return {
            valid: false,
            error: `Error parsing BGP packet: ${error.message}`
        };
    }
}

/**
 * Parse BGP OPEN message into a tree structure
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @param {Object} parentNode - Parent tree node to attach the parsing results
 */
function parseOpenMessageTree(buffer, parentNode) {
    let position = BgpConst.BGP_HEAD_LEN;

    // Create Open Message node
    const openNode = {
        name: 'OPEN Message',
        offset: position,
        length: buffer.length - position,
        value: '',
        children: []
    };
    parentNode.children.push(openNode);

    // Version
    const version = buffer[position];
    const versionNode = {
        name: 'Version',
        offset: position,
        length: 1,
        value: version,
        children: []
    };
    openNode.children.push(versionNode);
    position += 1;

    // ASN
    const asn = buffer.readUInt16BE(position);
    const asnNode = {
        name: 'ASN',
        offset: position,
        length: 2,
        value: asn,
        children: []
    };
    openNode.children.push(asnNode);
    position += 2;

    // Hold Time
    const holdTime = buffer.readUInt16BE(position);
    const holdTimeNode = {
        name: 'Hold Time',
        offset: position,
        length: 2,
        value: holdTime,
        children: []
    };
    openNode.children.push(holdTimeNode);
    position += 2;

    // BGP Identifier (Router ID)
    const routerId = `${buffer[position]}.${buffer[position + 1]}.${buffer[position + 2]}.${buffer[position + 3]}`;
    const routerIdNode = {
        name: 'BGP Identifier',
        offset: position,
        length: 4,
        value: routerId,
        children: []
    };
    openNode.children.push(routerIdNode);
    position += 4;

    // Optional Parameters Length
    const optParamLen = buffer[position];
    const optParamLenNode = {
        name: 'Optional Parameters Length',
        offset: position,
        length: 1,
        value: optParamLen,
        children: []
    };
    openNode.children.push(optParamLenNode);
    position += 1;

    // Optional Parameters
    if (optParamLen > 0) {
        const optParamsNode = {
            name: 'Optional Parameters',
            offset: position,
            length: optParamLen,
            value: '',
            children: []
        };
        openNode.children.push(optParamsNode);

        const optParamsEnd = position + optParamLen;

        while (position < optParamsEnd) {
            const paramType = buffer[position];
            const paramLen = buffer[position + 1];

            const paramNode = {
                name: `Parameter (Type: ${paramType})`,
                offset: position,
                length: paramLen + 2, // Including type and length fields
                value: '',
                children: []
            };
            optParamsNode.children.push(paramNode);

            // Parameter Type
            const paramTypeNode = {
                name: 'Parameter Type',
                offset: position,
                length: 1,
                value: paramType,
                children: []
            };
            paramNode.children.push(paramTypeNode);

            // Parameter Length
            const paramLenNode = {
                name: 'Parameter Length',
                offset: position + 1,
                length: 1,
                value: paramLen,
                children: []
            };
            paramNode.children.push(paramLenNode);

            position += 2;

            // Parameter type 2 is capability
            if (paramType === BgpConst.BGP_OPEN_OPT_TYPE.OPT_TYPE) {
                const capabilitiesNode = {
                    name: 'Capabilities',
                    offset: position,
                    length: paramLen,
                    value: '',
                    children: []
                };
                paramNode.children.push(capabilitiesNode);

                let capPosition = position;
                let capPositionEnd = capPosition + paramLen;

                while (capPosition < capPositionEnd) {
                    const capCode = buffer[capPosition];
                    const capLen = buffer[capPosition + 1];

                    const capabilityNode = {
                        name: `Capability (Code: ${capCode} - ${getCapabilityName(capCode)})`,
                        offset: capPosition,
                        length: capLen + 2, // Including code and length fields
                        value: '',
                        children: []
                    };
                    capabilitiesNode.children.push(capabilityNode);

                    // Capability Code
                    const capCodeNode = {
                        name: 'Code',
                        offset: capPosition,
                        length: 1,
                        value: `${capCode} (${getCapabilityName(capCode)})`,
                        children: []
                    };
                    capabilityNode.children.push(capCodeNode);

                    // Capability Length
                    const capLenNode = {
                        name: 'Length',
                        offset: capPosition + 1,
                        length: 1,
                        value: capLen,
                        children: []
                    };
                    capabilityNode.children.push(capLenNode);

                    capPosition += 2;

                    // Capability Value
                    if (capLen > 0) {
                        let valueOffset = capPosition;

                        // Parse capability-specific data
                        switch (capCode) {
                            case BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS:
                                if (capLen >= 4) {
                                    const afi = buffer.readUInt16BE(valueOffset);
                                    const afiNode = {
                                        name: 'AFI',
                                        offset: valueOffset,
                                        length: 2,
                                        value: `${afi} (${getAfiName(afi)})`,
                                        children: []
                                    };
                                    capabilityNode.children.push(afiNode);
                                    valueOffset += 2;

                                    const reserved = buffer[valueOffset];
                                    const reservedNode = {
                                        name: 'Reserved',
                                        offset: valueOffset,
                                        length: 1,
                                        value: reserved,
                                        children: []
                                    };
                                    capabilityNode.children.push(reservedNode);
                                    valueOffset += 1;

                                    const safi = buffer[valueOffset];
                                    const safiNode = {
                                        name: 'SAFI',
                                        offset: valueOffset,
                                        length: 1,
                                        value: `${safi} (${getSafiName(safi)})`,
                                        children: []
                                    };
                                    capabilityNode.children.push(safiNode);
                                }
                                break;

                            case BgpConst.BGP_OPEN_CAP_CODE.FOUR_OCTET_AS:
                                if (capLen >= 4) {
                                    const as4 = buffer.readUInt32BE(valueOffset);
                                    const as4Node = {
                                        name: '4-Octet AS Number',
                                        offset: valueOffset,
                                        length: 4,
                                        value: as4,
                                        children: []
                                    };
                                    capabilityNode.children.push(as4Node);
                                }
                                break;

                            case BgpConst.BGP_OPEN_CAP_CODE.BGP_ROLE:
                                if (capLen >= 1) {
                                    const role = buffer[valueOffset];
                                    const roleNode = {
                                        name: 'Role',
                                        offset: valueOffset,
                                        length: 1,
                                        value: `${role} (${getRoleName(role)})`,
                                        children: []
                                    };
                                    capabilityNode.children.push(roleNode);
                                }
                                break;

                            default:
                                const valueNode = {
                                    name: 'Value',
                                    offset: valueOffset,
                                    length: capLen,
                                    value: buffer.subarray(valueOffset, valueOffset + capLen).toString('hex'),
                                    children: []
                                };
                                capabilityNode.children.push(valueNode);
                        }
                    }

                    capPosition += capLen;
                }
            } else {
                // Other parameter types
                const paramValueNode = {
                    name: 'Parameter Value',
                    offset: position,
                    length: paramLen,
                    value: buffer.subarray(position, position + paramLen).toString('hex'),
                    children: []
                };
                paramNode.children.push(paramValueNode);
            }

            position += paramLen;
        }
    }
}

/**
 * Parse BGP UPDATE message into a tree structure
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @param {Object} parentNode - Parent tree node to attach the parsing results
 */
function parseUpdateMessageTree(buffer, parentNode) {
    let position = BgpConst.BGP_HEAD_LEN;

    // Create Update Message node
    const updateNode = {
        name: 'UPDATE Message',
        offset: position,
        length: buffer.length - position,
        value: '',
        children: []
    };
    parentNode.children.push(updateNode);

    // Withdrawn Routes Length
    const withdrawnRoutesLength = buffer.readUInt16BE(position);
    const withdrawnRoutesLengthNode = {
        name: 'Withdrawn Routes Length',
        offset: position,
        length: 2,
        value: withdrawnRoutesLength,
        children: []
    };
    updateNode.children.push(withdrawnRoutesLengthNode);
    position += 2;

    // Withdrawn Routes
    if (withdrawnRoutesLength > 0) {
        const withdrawnRoutesNode = {
            name: 'Withdrawn Routes',
            offset: position,
            length: withdrawnRoutesLength,
            value: '',
            children: []
        };
        updateNode.children.push(withdrawnRoutesNode);

        const withdrawnRoutesEnd = position + withdrawnRoutesLength;
        let routeIndex = 0;

        while (position < withdrawnRoutesEnd) {
            const prefixLength = buffer[position];
            const prefixNode = {
                name: `Route ${routeIndex + 1}`,
                offset: position,
                length: 1 + Math.ceil(prefixLength / 8), // Length field + prefix bytes
                value: '',
                children: []
            };
            withdrawnRoutesNode.children.push(prefixNode);

            // Prefix Length
            const prefixLengthNode = {
                name: 'Prefix Length',
                offset: position,
                length: 1,
                value: prefixLength,
                children: []
            };
            prefixNode.children.push(prefixLengthNode);
            position += 1;

            // Calculate bytes needed for the prefix
            const prefixBytes = Math.ceil(prefixLength / 8);

            // Extract the prefix
            if (prefixBytes > 0) {
                const prefixBuffer = buffer.subarray(position, position + prefixBytes);
                const prefix = ipv4BufferToString(prefixBuffer, prefixLength);

                const prefixValueNode = {
                    name: 'Prefix',
                    offset: position,
                    length: prefixBytes,
                    value: prefix,
                    children: []
                };
                prefixNode.children.push(prefixValueNode);
                position += prefixBytes;
            }

            prefixNode.value = `${prefixLength} bits: ${prefixNode.children[1]?.value || '0.0.0.0'}`;
            routeIndex++;
        }
    } else {
        position += 0; // No withdrawn routes
    }

    // Path Attributes Length
    const pathAttributesLength = buffer.readUInt16BE(position);
    const pathAttributesLengthNode = {
        name: 'Path Attributes Length',
        offset: position,
        length: 2,
        value: pathAttributesLength,
        children: []
    };
    updateNode.children.push(pathAttributesLengthNode);
    position += 2;

    // Path Attributes
    if (pathAttributesLength > 0) {
        const pathAttributesNode = {
            name: 'Path Attributes',
            offset: position,
            length: pathAttributesLength,
            value: '',
            children: []
        };
        updateNode.children.push(pathAttributesNode);

        const pathAttributesEnd = position + pathAttributesLength;

        while (position < pathAttributesEnd) {
            const attrFlags = buffer[position];
            const attrTypeCode = buffer[position + 1];

            // Check if extended length bit is set
            const extendedLength = (attrFlags & BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH) !== 0;
            const attrLengthSize = extendedLength ? 2 : 1;
            const attrLength = extendedLength ? buffer.readUInt16BE(position + 2) : buffer[position + 2];

            const headerLength = 2 + attrLengthSize; // Flags + Type + Length field

            const attrNode = {
                name: `Attribute (Type: ${attrTypeCode} - ${getAttributeTypeName(attrTypeCode)})`,
                offset: position,
                length: headerLength + attrLength,
                value: '',
                children: []
            };
            pathAttributesNode.children.push(attrNode);

            // Attribute Flags
            const flagsStr = [
                attrFlags & BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL ? 'OPTIONAL' : '',
                attrFlags & BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE ? 'TRANSITIVE' : '',
                attrFlags & BgpConst.BGP_PATH_ATTR_FLAGS.PARTIAL ? 'PARTIAL' : '',
                attrFlags & BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH ? 'EXTENDED_LENGTH' : ''
            ]
                .filter(Boolean)
                .join('|');

            const attrFlagsNode = {
                name: 'Flags',
                offset: position,
                length: 1,
                value: `0x${attrFlags.toString(16)} (${flagsStr})`,
                children: []
            };
            attrNode.children.push(attrFlagsNode);

            // Attribute Type
            const attrTypeNode = {
                name: 'Type',
                offset: position + 1,
                length: 1,
                value: `${attrTypeCode} (${getAttributeTypeName(attrTypeCode)})`,
                children: []
            };
            attrNode.children.push(attrTypeNode);

            // Attribute Length
            const attrLengthNode = {
                name: 'Length',
                offset: position + 2,
                length: attrLengthSize,
                value: attrLength,
                children: []
            };
            attrNode.children.push(attrLengthNode);

            // Attribute Value
            const valueOffset = position + headerLength;

            // Parse attribute value based on type
            switch (attrTypeCode) {
                // Add specific attribute parsing if needed
                // For brevity, many specific attribute parsers are omitted in this example
                default:
                    const valueNode = {
                        name: 'Value',
                        offset: valueOffset,
                        length: attrLength,
                        value: buffer.subarray(valueOffset, valueOffset + attrLength).toString('hex'),
                        children: []
                    };
                    attrNode.children.push(valueNode);
            }

            position += headerLength + attrLength;
        }
    } else {
        position += 0; // No path attributes
    }

    // NLRI (Network Layer Reachability Information)
    const nlriLength = buffer.length - position;
    if (nlriLength > 0) {
        const nlriNode = {
            name: 'NLRI',
            offset: position,
            length: nlriLength,
            value: '',
            children: []
        };
        updateNode.children.push(nlriNode);

        let routeIndex = 0;
        while (position < buffer.length) {
            const prefixLength = buffer[position];
            const prefixBytes = Math.ceil(prefixLength / 8);

            const prefixNode = {
                name: `Route ${routeIndex + 1}`,
                offset: position,
                length: 1 + prefixBytes,
                value: '',
                children: []
            };
            nlriNode.children.push(prefixNode);

            // Prefix Length
            const prefixLengthNode = {
                name: 'Prefix Length',
                offset: position,
                length: 1,
                value: prefixLength,
                children: []
            };
            prefixNode.children.push(prefixLengthNode);
            position += 1;

            // Prefix
            if (prefixBytes > 0) {
                const prefixBuffer = buffer.subarray(position, position + prefixBytes);
                const prefix = ipv4BufferToString(prefixBuffer, prefixLength);

                const prefixValueNode = {
                    name: 'Prefix',
                    offset: position,
                    length: prefixBytes,
                    value: prefix,
                    children: []
                };
                prefixNode.children.push(prefixValueNode);
                position += prefixBytes;

                prefixNode.value = `${prefixLength} bits: ${prefix}`;
            } else {
                prefixNode.value = `${prefixLength} bits: 0.0.0.0`;
            }

            routeIndex++;
        }
    }
}

/**
 * Parse BGP NOTIFICATION message into a tree structure
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @param {Object} parentNode - Parent tree node to attach the parsing results
 */
function parseNotificationMessageTree(buffer, parentNode) {
    let position = BgpConst.BGP_HEAD_LEN;

    // Create Notification Message node
    const notificationNode = {
        name: 'NOTIFICATION Message',
        offset: position,
        length: buffer.length - position,
        value: '',
        children: []
    };
    parentNode.children.push(notificationNode);

    // Error Code
    const errorCode = buffer[position];
    const errorCodeNode = {
        name: 'Error Code',
        offset: position,
        length: 1,
        value: errorCode,
        children: []
    };
    notificationNode.children.push(errorCodeNode);
    position += 1;

    // Error Subcode
    const errorSubcode = buffer[position];
    const errorSubcodeNode = {
        name: 'Error Subcode',
        offset: position,
        length: 1,
        value: `${errorSubcode} (${getErrorName(errorCode, errorSubcode)})`,
        children: []
    };
    notificationNode.children.push(errorSubcodeNode);
    position += 1;

    // Data
    const dataLength = buffer.length - position;
    if (dataLength > 0) {
        const dataNode = {
            name: 'Data',
            offset: position,
            length: dataLength,
            value: buffer.subarray(position, buffer.length).toString('hex'),
            children: []
        };
        notificationNode.children.push(dataNode);
    }
}

/**
 * Parse BGP ROUTE-REFRESH message into a tree structure
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @param {Object} parentNode - Parent tree node to attach the parsing results
 */
function parseRouteRefreshMessageTree(buffer, parentNode) {
    let position = BgpConst.BGP_HEAD_LEN;

    // Create Route Refresh Message node
    const routeRefreshNode = {
        name: 'ROUTE-REFRESH Message',
        offset: position,
        length: buffer.length - position,
        value: '',
        children: []
    };
    parentNode.children.push(routeRefreshNode);

    // AFI
    const afi = buffer.readUInt16BE(position);
    const afiNode = {
        name: 'AFI',
        offset: position,
        length: 2,
        value: `${afi} (${getAfiName(afi)})`,
        children: []
    };
    routeRefreshNode.children.push(afiNode);
    position += 2;

    // Reserved
    const reserved = buffer[position];
    const reservedNode = {
        name: 'Reserved',
        offset: position,
        length: 1,
        value: reserved,
        children: []
    };
    routeRefreshNode.children.push(reservedNode);
    position += 1;

    // SAFI
    const safi = buffer[position];
    const safiNode = {
        name: 'SAFI',
        offset: position,
        length: 1,
        value: `${safi} (${getSafiName(safi)})`,
        children: []
    };
    routeRefreshNode.children.push(safiNode);
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
 * Get readable capability name
 * @param {Number} code - Capability code
 * @returns {String} Name of the capability
 */
function getCapabilityName(code) {
    switch (code) {
        case BgpConst.BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS:
            return 'Multiprotocol Extensions';
        case BgpConst.BGP_OPEN_CAP_CODE.ROUTE_REFRESH:
            return 'Route Refresh';
        case BgpConst.BGP_OPEN_CAP_CODE.EXTENDED_NEXT_HOP_ENCODING:
            return 'Extended Next Hop Encoding';
        case BgpConst.BGP_OPEN_CAP_CODE.FOUR_OCTET_AS:
            return '4-octet AS Number';
        case BgpConst.BGP_OPEN_CAP_CODE.BGP_ROLE:
            return 'BGP Role';
        default:
            return 'Unknown';
    }
}

/**
 * Get readable AFI name
 * @param {Number} afi - Address Family Identifier
 * @returns {String} Name of the AFI
 */
function getAfiName(afi) {
    switch (afi) {
        case BgpConst.BGP_AFI_TYPE.AFI_IPV4:
            return 'IPv4';
        case BgpConst.BGP_AFI_TYPE.AFI_IPV6:
            return 'IPv6';
        default:
            return 'Unknown';
    }
}

/**
 * Get readable SAFI name
 * @param {Number} safi - Subsequent Address Family Identifier
 * @returns {String} Name of the SAFI
 */
function getSafiName(safi) {
    switch (safi) {
        case BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST:
            return 'Unicast';
        default:
            return 'Unknown';
    }
}

/**
 * Get readable Role name
 * @param {Number} role - BGP Role value
 * @returns {String} Name of the Role
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
            return 'Peer';
        default:
            return 'Unknown';
    }
}

/**
 * Get readable Attribute Type name
 * @param {Number} typeCode - Path Attribute Type Code
 * @returns {String} Name of the Attribute Type
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
            return 'PATH_OTC';
        default:
            return 'Unknown';
    }
}

/**
 * Get readable Error name based on code and subcode
 * @param {Number} errorCode - Error Code
 * @param {Number} errorSubcode - Error Subcode
 * @returns {String} Name of the Error
 */
function getErrorName(errorCode, errorSubcode) {
    switch (errorCode) {
        case BgpConst.BGP_ERROR_CODE.MESSAGE_HEADER_ERROR:
            switch (errorSubcode) {
                case BgpConst.BGP_ERROR_MESSAGE_HEADER_SUBCODE.CONNECTION_NOT_SYNCHRONIZED:
                    return 'Connection Not Synchronized';
                case BgpConst.BGP_ERROR_MESSAGE_HEADER_SUBCODE.BAD_MESSAGE_LENGTH:
                    return 'Bad Message Length';
                case BgpConst.BGP_ERROR_MESSAGE_HEADER_SUBCODE.BAD_MESSAGE_TYPE:
                    return 'Bad Message Type';
                default:
                    return 'Unknown Message Header Error';
            }
        case BgpConst.BGP_ERROR_CODE.OPEN_MESSAGE_ERROR:
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
                    return 'Unknown Open Message Error';
            }
        case BgpConst.BGP_ERROR_CODE.UPDATE_MESSAGE_ERROR:
            switch (errorSubcode) {
                case BgpConst.BGP_ERROR_UPDATE_MESSAGE_SUBCODE.MALFORMED_AS_PATH:
                    return 'Malformed AS_PATH';
                default:
                    return 'Unknown Update Message Error';
            }
        case BgpConst.BGP_ERROR_CODE.HOLD_TIMER_EXPIRED:
            return 'Hold Timer Expired';
        case BgpConst.BGP_ERROR_CODE.FINITE_STATE_MACHINE_ERROR:
            return 'Finite State Machine Error';
        case BgpConst.BGP_ERROR_CODE.CONNECTION_REJECTED:
            switch (errorSubcode) {
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.MAX_PREFIXES:
                    return 'Maximum Number of Prefixes Reached';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.ADMIN_SHUTDOWN:
                    return 'Administrative Shutdown';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.ADMIN_RESET:
                    return 'Administrative Reset';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.PEER_DE_CONFIGURED:
                    return 'Peer De-configured';
                case BgpConst.BGP_ERROR_CONNECTION_REJECTED_SUBCODE.CONNECTION_REJECTED:
                    return 'Connection Rejected';
                default:
                    return 'Unknown Connection Rejection';
            }
        default:
            return 'Unknown Error';
    }
}

module.exports = {
    parseBgpPacketTree
};
