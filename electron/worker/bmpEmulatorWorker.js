const { parentPort, threadId } = require('worker_threads');
const net = require('net');
const log = require('electron-log');
const { BMP_OPERATIONS } = require('../const/bmpOpConst');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const BmpConst = require('../const/bmpConst');

// BMP Server state
let server = null;

// Connected peers data
const peers = new Map(); // Map of peer IP -> peer data
const ipv4Routes = new Map(); // Map of prefix/mask -> route data
const ipv6Routes = new Map(); // Map of prefix/mask -> route data

function startServer(serverConfig) {
    try {
        server = net.createServer(handleClientConnection);

        server.on('error', err => {
            log.error(`[BMP Worker ${threadId}] Server error:`, err);

            try {
                server.close();
            } catch (closeErr) {
                log.error(`[BMP Worker ${threadId}] Error closing server after error:`, closeErr);
            }
        });

        // Start listening
        server.listen(serverConfig.port, () => {
            log.info(`[BMP Worker ${threadId}] BMP server listening on port ${serverConfig.ip}:${serverConfig.port}`);
        });
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Failed to start server:`, err);
    }
}

function stopServer() {
    try {
        // Close all client connections
        server.close(() => {
            log.info(`[BMP Worker ${threadId}] BMP server stopped`);

            // Clear state
            peers.clear();
            ipv4Routes.clear();
            ipv6Routes.clear();

            // Notify main process
            parentPort.postMessage(
                successResponse({
                    op: BMP_OPERATIONS.STOP_SERVER,
                    data: { msg: 'BMP服务器已停止' }
                })
            );
        });
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Failed to stop server:`, err);
    }
}

// Handle client connection
function handleClientConnection(socket) {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    log.info(`[BMP Worker ${threadId}] New client connected: ${clientAddress}`);

    let buffer = Buffer.alloc(0);

    socket.on('data', data => {
        try {
            console.log('data', data);
            buffer = Buffer.concat([buffer, data]);
            console.log('buffer', buffer);
            let processed = 0;
            while (buffer.length >= 6) {
                const version = buffer[0];
                const length = buffer.readUInt32BE(1);

                if (buffer.length < length) {
                    break;
                }

                const message = buffer.subarray(0, length);
                console.log('message', message);
                processMessage(message, socket);

                buffer = buffer.subarray(length);
                processed++;
            }

            if (processed > 0) {
                log.info(`[BMP Worker ${threadId}] Processed ${processed} messages from ${clientAddress}`);
            }
        } catch (err) {
            log.error(`[BMP Worker ${threadId}] Error processing data from ${clientAddress}:`, err);
        }
    });

    // Handle client disconnection
    socket.on('close', () => {
        log.info(`[BMP Worker ${threadId}] Client disconnected: ${clientAddress}`);

        // Clean up peer data for this client (if any)
        for (const [peerIp, peer] of peers.entries()) {
            if (peer.clientAddress === clientAddress) {
                peers.delete(peerIp);

                // Notify about peer disconnection
                sendPeerUpdate();
            }
        }
    });

    // Handle errors
    socket.on('error', err => {
        log.error(`[BMP Worker ${threadId}] Client error (${clientAddress}):`, err);
    });

    // Send BMP initiation message (server information)
    sendInitiationMessage(socket);
}

// Process a BMP message
function processMessage(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;

        // Parse BMP common header
        const version = message[0];
        const length = message.readUInt32BE(1);
        const type = message[5];

        log.info(`[BMP Worker ${threadId}] Received message type ${type} from ${clientAddress}, length ${length}`);

        switch (type) {
            case BmpConst.BMP_MSG_TYPE.ROUTE_MONITORING:
                processRouteMonitoring(message, socket);
                break;

            case BmpConst.BMP_MSG_TYPE.STATISTICS_REPORT:
                processStatisticsReport(message, socket);
                break;

            case BmpConst.BMP_MSG_TYPE.PEER_DOWN_NOTIFICATION:
                processPeerDown(message, socket);
                break;

            case BmpConst.BMP_MSG_TYPE.PEER_UP_NOTIFICATION:
                processPeerUp(message, socket);
                break;

            case BmpConst.BMP_MSG_TYPE.INITIATION:
                processInitiation(message, socket);
                break;

            case BmpConst.BMP_MSG_TYPE.TERMINATION:
                processTermination(message, socket);
                break;

            case BmpConst.BMP_MSG_TYPE.ROUTE_MIRRORING:
                processRouteMirroring(message, socket);
                break;

            default:
                log.warn(`[BMP Worker ${threadId}] Unknown message type: ${type}`);
        }
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error processing message:`, err);
    }
}

// Process peer up notification
function processPeerUp(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;

        // Parse peer header (starts at byte 6)
        const peerHeader = message.slice(6, 6 + 42);
        const peerType = peerHeader[0];
        const peerFlags = peerHeader[1];

        let peerIp;
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            peerIp = message
                .slice(6 + 6, 6 + 6 + 16)
                .toString('hex')
                .match(/.{1,4}/g)
                .join(':');
        } else {
            // IPv4 peer
            peerIp = message.slice(6 + 18, 6 + 18 + 4).join('.');
        }

        const peerAs = peerHeader.readUInt32BE(38);

        // Add peer to our list
        peers.set(peerIp, {
            peerIp,
            peerAs,
            peerType,
            peerFlags,
            clientAddress,
            status: 'connected',
            connectedAt: new Date().toISOString()
        });

        log.info(`[BMP Worker ${threadId}] Peer UP: ${peerIp} (AS${peerAs})`);

        // Notify about peer update
        sendPeerUpdate();
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error processing peer up:`, err);
    }
}

// Process peer down notification
function processPeerDown(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;

        // Parse peer header (starts at byte 6)
        const peerHeader = message.slice(6, 6 + 42);
        const peerType = peerHeader[0];
        const peerFlags = peerHeader[1];

        let peerIp;
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            peerIp = message
                .slice(6 + 6, 6 + 6 + 16)
                .toString('hex')
                .match(/.{1,4}/g)
                .join(':');
        } else {
            // IPv4 peer
            peerIp = message.slice(6 + 18, 6 + 18 + 4).join('.');
        }

        // Update peer status
        if (peers.has(peerIp)) {
            const peer = peers.get(peerIp);
            peer.status = 'disconnected';
            peer.disconnectedAt = new Date().toISOString();
            peers.set(peerIp, peer);

            log.info(`[BMP Worker ${threadId}] Peer DOWN: ${peerIp}`);

            // Notify about peer update
            sendPeerUpdate();
        }
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error processing peer down:`, err);
    }
}

function processRouteMonitoring(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;

        // Parse peer header (starts at byte 6)
        const peerHeader = message.slice(6, 6 + 42);
        const peerType = peerHeader[0];
        const peerFlags = peerHeader[1];

        let peerIp;
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            peerIp = message
                .slice(6 + 6, 6 + 6 + 16)
                .toString('hex')
                .match(/.{1,4}/g)
                .join(':');
        } else {
            // IPv4 peer
            peerIp = message.slice(6 + 18, 6 + 18 + 4).join('.');
        }

        // BGP update starts after the peer header (at byte 6 + 42)
        const bgpUpdate = message.slice(6 + 42);

        // Process BGP update to extract routes (simplified for this example)
        // In a real implementation, you would parse the BGP update message in detail

        // For this simulation, we'll just create a mock route
        const routeType = Math.random() > 0.5 ? 'ipv4' : 'ipv6';
        const prefix =
            routeType === 'ipv4'
                ? `192.168.${Math.floor(Math.random() * 255)}.0`
                : `2001:db8:${Math.floor(Math.random() * 9999).toString(16)}::`;
        const mask = routeType === 'ipv4' ? Math.floor(Math.random() * 16) + 16 : Math.floor(Math.random() * 64) + 32;
        const nextHop =
            routeType === 'ipv4'
                ? `10.0.0.${Math.floor(Math.random() * 254) + 1}`
                : `2001:db8:ffff::${Math.floor(Math.random() * 254) + 1}`;

        const routeKey = `${prefix}/${mask}`;
        const route = {
            prefix,
            mask,
            nextHop,
            peerIp,
            receivedAt: new Date().toISOString(),
            attributes: {
                origin: 'igp',
                asPath: [Math.floor(Math.random() * 65000) + 1]
            }
        };

        // Store route
        if (routeType === 'ipv4') {
            ipv4Routes.set(routeKey, route);
        } else {
            ipv6Routes.set(routeKey, route);
        }

        log.info(`[BMP Worker ${threadId}] Received ${routeType.toUpperCase()} route: ${routeKey} via ${peerIp}`);

        // Notify about route update
        sendRouteUpdate(routeType);
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error processing route monitoring:`, err);
    }
}

// Process statistics report
function processStatisticsReport(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;

        // Parse peer header (starts at byte 6)
        const peerHeader = message.slice(6, 6 + 42);
        const peerType = peerHeader[0];
        const peerFlags = peerHeader[1];

        let peerIp;
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            peerIp = message
                .slice(6 + 6, 6 + 6 + 16)
                .toString('hex')
                .match(/.{1,4}/g)
                .join(':');
        } else {
            // IPv4 peer
            peerIp = message.slice(6 + 18, 6 + 18 + 4).join('.');
        }

        log.info(`[BMP Worker ${threadId}] Received statistics report from peer ${peerIp}`);
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error processing statistics report:`, err);
    }
}

// Process termination message
function processTermination(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
        log.info(`[BMP Worker ${threadId}] Received termination message from ${clientAddress}`);

        // Client is terminating - clean up peer data
        for (const [peerIp, peer] of peers.entries()) {
            if (peer.clientAddress === clientAddress) {
                peers.delete(peerIp);
            }
        }

        // Update peer list
        sendPeerUpdate();
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error processing termination:`, err);
    }
}

// Process route mirroring
function processRouteMirroring(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
        log.info(`[BMP Worker ${threadId}] Received route mirroring message from ${clientAddress}`);
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error processing route mirroring:`, err);
    }
}

// Send BMP initiation message
function sendInitiationMessage(socket) {
    try {
        // Create BMP initiation message
        const headerBuffer = Buffer.alloc(6);
        headerBuffer[0] = 3; // BMP version 3

        // TLV for sysName
        const sysNameType = Buffer.alloc(2);
        sysNameType.writeUInt16BE(1, 0);
        const sysNameValue = Buffer.from('BMP-Simulator');
        const sysNameLength = Buffer.alloc(2);
        sysNameLength.writeUInt16BE(sysNameValue.length, 0);

        // TLV for sysDesc
        const sysDescType = Buffer.alloc(2);
        sysDescType.writeUInt16BE(2, 0);
        const sysDescValue = Buffer.from('BMP Monitor for Mini-Tools');
        const sysDescLength = Buffer.alloc(2);
        sysDescLength.writeUInt16BE(sysDescValue.length, 0);

        // Combine all buffers
        const message = Buffer.concat([
            headerBuffer,
            sysNameType,
            sysNameLength,
            sysNameValue,
            sysDescType,
            sysDescLength,
            sysDescValue
        ]);

        // Update message length
        message.writeUInt32BE(message.length, 1);

        // Set message type (4 = Initiation)
        message[5] = 4;

        // Send message
        socket.write(message);
        log.info(`[BMP Worker ${threadId}] Sent initiation message to ${socket.remoteAddress}:${socket.remotePort}`);
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error sending initiation message:`, err);
    }
}

// Send peer update to main process
function sendPeerUpdate() {
    try {
        const peerList = Array.from(peers.values());
        parentPort.postMessage(
            successResponse({
                op: BMP_OPERATIONS.PEER_CONNECTED,
                data: peerList
            })
        );
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error sending peer update:`, err);
    }
}

// Send route update to main process
function sendRouteUpdate(routeType) {
    try {
        const routes = routeType === 'ipv4' ? Array.from(ipv4Routes.values()) : Array.from(ipv6Routes.values());

        parentPort.postMessage(
            successResponse({
                op: BMP_OPERATIONS.ROUTE_ANNOUNCED,
                data: {
                    type: routeType,
                    routes
                }
            })
        );
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error sending ${routeType} route update:`, err);
    }
}

// Process initiation message
function processInitiation(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
        log.info(`[BMP Worker ${threadId}] Received initiation message from ${clientAddress}`);

        // Parse initiation message (starts at byte 6)
        const initiationData = message.slice(6);
        let position = 0;

        // Store TLV data
        const tlvs = [];

        // Parse all TLVs in the message
        while (position < initiationData.length) {
            // Each TLV consists of Type (2 bytes), Length (2 bytes), and Value (variable)
            if (position + 4 > initiationData.length) {
                break; // Not enough data for TLV header
            }

            const type = initiationData.readUInt16BE(position);
            position += 2;

            const length = initiationData.readUInt16BE(position);
            position += 2;

            if (position + length > initiationData.length) {
                break; // Not enough data for TLV value
            }

            const value = initiationData.slice(position, position + length).toString('utf8');
            position += length;

            tlvs.push({ type, length, value });
        }

        // Extract known TLV types
        let sysName = '';
        let sysDesc = '';
        let sysInfo = {};

        for (const tlv of tlvs) {
            switch (tlv.type) {
                case 1: // sysName
                    sysName = tlv.value;
                    break;
                case 2: // sysDesc
                    sysDesc = tlv.value;
                    break;
                default:
                    // Store other TLVs in sysInfo
                    sysInfo[`tlv${tlv.type}`] = tlv.value;
            }
        }

        // Create an initiation record
        const initiationRecord = {
            clientAddress,
            receivedAt: new Date().toISOString(),
            sysName,
            sysDesc,
            extraInfo: sysInfo,
            rawTlvs: tlvs
        };

        // Send initiation update to main process
        parentPort.postMessage(
            successResponse(
                {
                    op: BMP_OPERATIONS.INITIATION_RECEIVED,
                    data: initiationRecord
                },
                'Received BMP initiation'
            )
        );

        log.info(`[BMP Worker ${threadId}] Processed initiation message: sysName=${sysName}, sysDesc=${sysDesc}`);
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error processing initiation:`, err);
    }
}

// Handle messages from the main process
parentPort.on('message', msg => {
    try {
        log.info(`[BMP Worker ${threadId}] Received message from main process:`, msg);

        const { op, data } = msg;

        switch (op) {
            case BMP_OPERATIONS.START_SERVER:
                startServer(data);
                break;

            case BMP_OPERATIONS.STOP_SERVER:
                stopServer();
                break;

            case 'get_peers':
                // Send current peers list
                sendPeerUpdate();
                break;

            case 'get_routes':
                // Send current routes list
                sendRouteUpdate(data.ipType);
                break;

            default:
                log.warn(`[BMP Worker ${threadId}] Unknown operation: ${op}`);
        }
    } catch (err) {
        log.error(`[BMP Worker ${threadId}] Error handling message from main process:`, err);
        parentPort.postMessage(errorResponse(`Worker error: ${err.message}`));
    }
});
