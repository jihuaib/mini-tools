const logger = require('../log/logger');

/**
 * BMP v4 TLV Parser
 * Parses Type-Length-Value data structures for BMP version 4
 */
class BmpTlvParser {
    /**
     * Parse TLV data from buffer
     * @param {Buffer} buffer - Buffer containing TLV data
     * @param {number} offset - Starting offset in buffer
     * @returns {Array} Array of parsed TLV objects
     */
    static parseTlvs(buffer, offset = 0) {
        const tlvs = [];
        let position = offset;

        while (position + 4 <= buffer.length) {
            try {
                // Read Type field (2 bytes)
                // E-bit (MSB) indicates enterprise-specific TLV
                const typeField = buffer.readUInt16BE(position);
                const isEnterprise = (typeField & 0x8000) !== 0;
                const type = typeField & 0x7fff;
                position += 2;

                // Read Length field (2 bytes)
                const length = buffer.readUInt16BE(position);
                position += 2;

                // Read Enterprise Number if E-bit is set (4 bytes)
                let enterpriseNumber = null;
                if (isEnterprise) {
                    if (position + 4 > buffer.length) {
                        logger.error('Incomplete enterprise number in TLV');
                        break;
                    }
                    enterpriseNumber = buffer.readUInt32BE(position);
                    position += 4;
                }

                // Read Value
                if (position + length > buffer.length) {
                    logger.error(`Incomplete TLV value: expected ${length} bytes, got ${buffer.length - position}`);
                    break;
                }

                const value = buffer.slice(position, position + length);
                position += length;

                tlvs.push({
                    type,
                    length,
                    value,
                    isEnterprise,
                    enterpriseNumber
                });
            } catch (err) {
                logger.error(`Error parsing TLV at position ${position}:`, err);
                break;
            }
        }

        return tlvs;
    }

    /**
     * Parse Indexed TLV data
     * @param {Buffer} buffer - Buffer containing indexed TLV data
     * @param {number} offset - Starting offset in buffer
     * @returns {Array} Array of parsed indexed TLV objects
     */
    static parseIndexedTlvs(buffer, offset = 0) {
        const tlvs = [];
        let position = offset;

        while (position + 6 <= buffer.length) {
            try {
                // Read Type field (2 bytes)
                const typeField = buffer.readUInt16BE(position);
                const isEnterprise = (typeField & 0x8000) !== 0;
                const type = typeField & 0x7fff;
                position += 2;

                // Read Index field (2 bytes)
                const index = buffer.readUInt16BE(position);
                position += 2;

                // Read Length field (2 bytes)
                const length = buffer.readUInt16BE(position);
                position += 2;

                // Read Enterprise Number if E-bit is set (4 bytes)
                let enterpriseNumber = null;
                if (isEnterprise) {
                    if (position + 4 > buffer.length) {
                        logger.error('Incomplete enterprise number in indexed TLV');
                        break;
                    }
                    enterpriseNumber = buffer.readUInt32BE(position);
                    position += 4;
                }

                // Read Value
                if (position + length > buffer.length) {
                    logger.error(
                        `Incomplete indexed TLV value: expected ${length} bytes, got ${buffer.length - position}`
                    );
                    break;
                }

                const value = buffer.slice(position, position + length);
                position += length;

                tlvs.push({
                    type,
                    index,
                    length,
                    value,
                    isEnterprise,
                    enterpriseNumber
                });
            } catch (err) {
                logger.error(`Error parsing indexed TLV at position ${position}:`, err);
                break;
            }
        }

        return tlvs;
    }

    /**
     * Extract BGP Message from BGP Message TLV
     * @param {Object} tlv - TLV object containing BGP message
     * @returns {Buffer} BGP Update PDU
     */
    static parseBgpMessageTlv(tlv) {
        return tlv.value;
    }

    /**
     * Parse VRF/Table Name TLV
     * @param {Object} tlv - TLV object containing VRF/Table name
     * @returns {string} VRF/Table name
     */
    static parseVrfTableNameTlv(tlv) {
        return tlv.value.toString('utf8');
    }

    /**
     * Parse Group TLV
     * @param {Object} tlv - TLV object containing group data
     * @returns {Object} Parsed group data with groupIndex and nlriIndexes
     */
    static parseGroupTlv(tlv) {
        const buffer = tlv.value;
        let position = 0;

        // Read Group Index (2 bytes)
        const groupIndex = buffer.readUInt16BE(position);
        position += 2;

        // Read NLRI indexes
        const nlriIndexes = [];
        while (position + 2 <= buffer.length) {
            const nlriIndex = buffer.readUInt16BE(position);
            nlriIndexes.push(nlriIndex);
            position += 2;
        }

        return {
            groupIndex,
            nlriIndexes
        };
    }
}

module.exports = BmpTlvParser;
