/**
 * ARP Packet Parser Test
 *
 * Simple test to verify ARP packet parsing functionality
 */

const { parseArpPacket } = require('../electron/pktParser/arpPacketParser');

// Create a sample ARP request packet (standard Ethernet/IPv4)
function createArpRequestPacket() {
    const buffer = Buffer.alloc(28);
    let offset = 0;

    // Hardware Type (Ethernet = 1)
    buffer.writeUInt16BE(1, offset);
    offset += 2;

    // Protocol Type (IPv4 = 0x0800)
    buffer.writeUInt16BE(0x0800, offset);
    offset += 2;

    // Hardware Address Length (6 for Ethernet)
    buffer[offset] = 6;
    offset += 1;

    // Protocol Address Length (4 for IPv4)
    buffer[offset] = 4;
    offset += 1;

    // Operation (Request = 1)
    buffer.writeUInt16BE(1, offset);
    offset += 2;

    // Sender Hardware Address (AA:BB:CC:DD:EE:FF)
    buffer.writeUInt8(0xaa, offset++);
    buffer.writeUInt8(0xbb, offset++);
    buffer.writeUInt8(0xcc, offset++);
    buffer.writeUInt8(0xdd, offset++);
    buffer.writeUInt8(0xee, offset++);
    buffer.writeUInt8(0xff, offset++);

    // Sender Protocol Address (192.168.1.100)
    buffer.writeUInt8(192, offset++);
    buffer.writeUInt8(168, offset++);
    buffer.writeUInt8(1, offset++);
    buffer.writeUInt8(100, offset++);

    // Target Hardware Address (00:00:00:00:00:00)
    buffer.writeUInt8(0x00, offset++);
    buffer.writeUInt8(0x00, offset++);
    buffer.writeUInt8(0x00, offset++);
    buffer.writeUInt8(0x00, offset++);
    buffer.writeUInt8(0x00, offset++);
    buffer.writeUInt8(0x00, offset++);

    // Target Protocol Address (192.168.1.1)
    buffer.writeUInt8(192, offset++);
    buffer.writeUInt8(168, offset++);
    buffer.writeUInt8(1, offset++);
    buffer.writeUInt8(1, offset++);

    return buffer;
}

// Test ARP parsing
function testArpParsing() {
    console.log('Testing ARP Packet Parser...\n');

    // Create test packet
    const arpPacket = createArpRequestPacket();
    console.log('Created ARP packet:', arpPacket.toString('hex').toUpperCase());
    console.log('Packet length:', arpPacket.length, 'bytes\n');

    // Create tree structure
    const tree = {
        name: 'Root',
        offset: 0,
        length: arpPacket.length,
        value: '',
        children: []
    };

    // Parse the packet
    const result = parseArpPacket(arpPacket, tree, 0);

    if (result.valid) {
        console.log('✅ ARP packet parsed successfully!\n');

        // Display parsing results
        console.log('Parse Tree:');
        printTree(tree.children[0], 0);

        if (result.payload) {
            console.log('\nPayload info:');
            console.log('- Name:', result.payload.name);
            console.log('- Offset:', result.payload.offset);
            console.log('- Length:', result.payload.length);
            console.log('- Next Layer:', result.payload.nextLayer);
        }
    } else {
        console.log('❌ ARP packet parsing failed!');
        console.log('Error:', result.error);
    }
}

// Helper function to print tree structure
function printTree(node, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}${node.name}: ${node.value}`);
    console.log(`${indent}  (offset: ${node.offset}, length: ${node.length})`);

    if (node.children && node.children.length > 0) {
        node.children.forEach(child => printTree(child, depth + 1));
    }
}

// Run the test
if (require.main === module) {
    testArpParsing();
}

module.exports = {
    testArpParsing,
    createArpRequestPacket
};
