/**
 * Packet Parser Registry
 *
 * Initializes parsers and registers them with the registry.
 * This file resolves circular dependencies by separating parser registration from registry definition.
 */

// Import registry instance
const registry = require('./registryInstance');

// Import parsers
const { parseEthernetPacket } = require('./ethernetPacketParser');
const { parseIPv4Packet, parseIPv6Packet } = require('./ipPacketParser');
const { parseTcpPacket } = require('./tcpPacketParser');
const { parseUdpPacket } = require('./udpPacketParser');

// Register parsers
// 数据链路层解析器
registry.registerParser('ethernet', 0, parseEthernetPacket);

// 网络层解析器
registry.registerParser('ip', 0x0800, parseIPv4Packet);
registry.registerParser('ip', 0x86dd, parseIPv6Packet);

// 传输层解析器
registry.registerParser('tcp', 6, parseTcpPacket);
registry.registerParser('udp', 17, parseUdpPacket);

// Export the configured registry
module.exports = registry;
