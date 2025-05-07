/**
 * BGP Packet Parser for the ParserRegistry
 *
 * Parses BGP protocol packets from raw buffers and returns structured data.
 * Based on RFC 4271 and other BGP extension RFCs.
 * Designed to be used with the ParserRegistry system.
 */

const { parseBgpPacketTree } = require('./bgpPacketTreeParser');

/**
 * Parse a BGP packet through the registry system
 * @param {Buffer} buffer - The raw BGP packet buffer
 * @param {number} offset - Starting offset in the buffer
 * @returns {Object} Parse result with a valid flag and tree structure
 */
function parseBgpPacket(buffer, offset = 0) {
    // Use the existing parseBgpPacketTree function to do the actual parsing
    const result = parseBgpPacketTree(buffer.subarray(offset));

    // Return in the format expected by the registry system
    return {
        valid: result.valid,
        error: result.error,
        tree: result.tree
    };
}

module.exports = {
    parseBgpPacket
};
