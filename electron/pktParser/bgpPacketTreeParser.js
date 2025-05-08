/**
 * BGP Tree Parser
 *
 * Parses BGP protocol packets into a tree structure with field offsets and lengths.
 * Based on RFC 4271 and other BGP extension RFCs.
 */

const BgpConst = require('../const/bgpConst');
const { ipv4BufferToString } = require('../utils/ipUtils');
const {
    getBgpPacketTypeName,
    getBgpOpenCapabilityName,
    getBgpAfiName,
    getBgpSafiName,
    getBgpOpenRoleName,
    getBgpPathAttrTypeName,
    getBgpNotificationErrorName
} = require('../utils/bgpUtils');
/**
 * Parse a BGP packet into a tree structure
 * @param {Buffer} buffer - The raw BGP packet buffer
 * @returns {Object} Tree structure with offsets and lengths for each field
 */
function parseBgpPacketTree(buffer, offset = 0) {
    try {
        // Check if buffer is valid
        if (!Buffer.isBuffer(buffer) || buffer.length < BgpConst.BGP_HEAD_LEN) {
            return {
                valid: false,
                error: 'Invalid buffer or buffer too small'
            };
        }

        let curOffset = offset;

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
        const typeName = getBgpPacketTypeName(type);
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
                parseOpenMessageTree(buffer, headerNode);
                break;
            case BgpConst.BGP_PACKET_TYPE.UPDATE:
                parseUpdateMessageTree(buffer, headerNode);
                break;
            case BgpConst.BGP_PACKET_TYPE.NOTIFICATION:
                parseNotificationMessageTree(buffer, headerNode);
                break;
            case BgpConst.BGP_PACKET_TYPE.KEEPALIVE:
                // Keepalive has no additional data
                break;
            case BgpConst.BGP_PACKET_TYPE.ROUTE_REFRESH:
                parseRouteRefreshMessageTree(buffer, headerNode);
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

    // Version
    const version = buffer[position];
    const versionNode = {
        name: 'Version',
        offset: position,
        length: 1,
        value: version,
        children: []
    };
    parentNode.children.push(versionNode);
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
    parentNode.children.push(asnNode);
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
    parentNode.children.push(holdTimeNode);
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
    parentNode.children.push(routerIdNode);
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
    parentNode.children.push(optParamLenNode);
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
        parentNode.children.push(optParamsNode);

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
                        name: `Capability (Code: ${capCode} - ${getBgpOpenCapabilityName(capCode)})`,
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
                        value: `${capCode} (${getBgpOpenCapabilityName(capCode)})`,
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
                                        value: `${afi} (${getBgpAfiName(afi)})`,
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
                                        value: `${safi} (${getBgpSafiName(safi)})`,
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
                                        value: `${role} (${getBgpOpenRoleName(role)})`,
                                        children: []
                                    };
                                    capabilityNode.children.push(roleNode);
                                }
                                break;

                            default: {
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

    // Withdrawn Routes Length
    const withdrawnRoutesLength = buffer.readUInt16BE(position);
    const withdrawnRoutesLengthNode = {
        name: 'Withdrawn Routes Length',
        offset: position,
        length: 2,
        value: withdrawnRoutesLength,
        children: []
    };
    parentNode.children.push(withdrawnRoutesLengthNode);
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
        parentNode.children.push(withdrawnRoutesNode);

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
    parentNode.children.push(pathAttributesLengthNode);
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
        parentNode.children.push(pathAttributesNode);

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
                name: `Attribute (Type: ${attrTypeCode} - ${getBgpPathAttrTypeName(attrTypeCode)})`,
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
                value: `${attrTypeCode} (${getBgpPathAttrTypeName(attrTypeCode)})`,
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
                default: {
                    const valueNode = {
                        name: 'Value',
                        offset: valueOffset,
                        length: attrLength,
                        value: buffer.subarray(valueOffset, valueOffset + attrLength).toString('hex'),
                        children: []
                    };
                    attrNode.children.push(valueNode);
                }
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
        parentNode.children.push(nlriNode);

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

    // Error Code
    const errorCode = buffer[position];
    const errorCodeNode = {
        name: 'Error Code',
        offset: position,
        length: 1,
        value: errorCode,
        children: []
    };
    parentNode.children.push(errorCodeNode);
    position += 1;

    // Error Subcode
    const errorSubcode = buffer[position];
    const errorSubcodeNode = {
        name: 'Error Subcode',
        offset: position,
        length: 1,
        value: `${errorSubcode} (${getBgpNotificationErrorName(errorCode, errorSubcode)})`,
        children: []
    };
    parentNode.children.push(errorSubcodeNode);
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
        parentNode.children.push(dataNode);
    }
}

/**
 * Parse BGP ROUTE-REFRESH message into a tree structure
 * @param {Buffer} buffer - Raw BGP packet buffer
 * @param {Object} parentNode - Parent tree node to attach the parsing results
 */
function parseRouteRefreshMessageTree(buffer, parentNode) {
    let position = BgpConst.BGP_HEAD_LEN;

    // AFI
    const afi = buffer.readUInt16BE(position);
    const afiNode = {
        name: 'AFI',
        offset: position,
        length: 2,
        value: `${afi} (${getBgpAfiName(afi)})`,
        children: []
    };
    parentNode.children.push(afiNode);
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
    parentNode.children.push(reservedNode);
    position += 1;

    // SAFI
    const safi = buffer[position];
    const safiNode = {
        name: 'SAFI',
        offset: position,
        length: 1,
        value: `${safi} (${getBgpSafiName(safi)})`,
        children: []
    };
    parentNode.children.push(safiNode);
}

module.exports = {
    parseBgpPacketTree
};
