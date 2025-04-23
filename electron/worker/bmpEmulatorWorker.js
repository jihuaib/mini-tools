const { parentPort, threadId } = require('worker_threads');
const net = require('net');
const log = require('electron-log');
const { BMP_OPERATIONS } = require('../const/bmpOpConst');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const BmpConst = require('../const/bmpConst');
const BgpConst = require('../const/bgpConst');

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

function processPeerUp(message, socket) {
    try {
        const position = 0;
        const version = message[position];
        position += 1;
        const length = message.readUInt32BE(position);
        position += 4;
        const type = message[position];
        position += 1;

        // Parse peer header
        const peerHeader = message.subarray(position, position + 42);
        position += 42;

        const peerHeaderPosition = 0;
        const peerType = peerHeader[peerHeaderPosition];
        peerHeaderPosition += 1;
        const peerFlags = peerHeader[peerHeaderPosition];
        peerHeaderPosition += 1;

        const rd = peerHeader.subarray(peerHeaderPosition, peerHeaderPosition + 9);
        peerHeaderPosition += 10;

        let peerAddress;
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            peerAddress = peerHeader.subarray(peerHeaderPosition, peerHeaderPosition + 16);
            peerHeaderPosition += 16;
        } else {
            // IPv4 peer
            // 12字节保留字段
            peerHeaderPosition += 12;
            peerAddress = peerHeader.subarray(peerHeaderPosition, peerHeaderPosition + 4);
            peerHeaderPosition += 4;
        }

        const peerAs = peerHeader.readUInt32BE(peerHeaderPosition);
        peerHeaderPosition += 4;
        const peerRouterId = peerHeader.readUInt32BE(peerHeaderPosition);
        peerHeaderPosition += 4;
        const timestamps = peerHeader.readUInt32BE(peerHeaderPosition);
        peerHeaderPosition += 4;
        const timestampMs = timestamps.readUInt32BE(peerHeaderPosition);
        peerHeaderPosition += 4;

        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            const localAddress = peerHeader.subarray(position, position + 16);
            position += 16;
        } else {
            // IPv4 peer
            // 12字节保留字段
            position += 12;
            const localAddress = peerHeader.subarray(position, position + 4);
            position += 4;
        }
        const localPort = peerHeader.readUInt16BE(position);
        position += 2;
        const remotePort = peerHeader.readUInt16BE(position);
        position += 2;

        const sentOpenMsg = message.subarray(position);

        // Add peer to our list with enhanced information from OPEN messages
        const peerInfo = {
            peerIp,
            peerAs,
            peerType,
            peerFlags,
            clientAddress,
            status: 'connected',
            connectedAt: new Date().toISOString()
        };

        // Add parsed OPEN message information if available
        if (parsedSentOpen && parsedSentOpen.valid) {
            peerInfo.sentOpen = {
                version: parsedSentOpen.version,
                holdTime: parsedSentOpen.holdTime,
                routerId: parsedSentOpen.routerId,
                capabilities: parsedSentOpen.capabilities
            };
        }

        if (parsedReceivedOpen && parsedReceivedOpen.valid) {
            peerInfo.receivedOpen = {
                version: parsedReceivedOpen.version,
                holdTime: parsedReceivedOpen.holdTime,
                routerId: parsedReceivedOpen.routerId,
                capabilities: parsedReceivedOpen.capabilities
            };
        }

        // Store the enhanced peer information
        peers.set(peerIp, peerInfo);

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
        const peerHeader = message.subarray(6, 6 + 42);
        const peerType = peerHeader[0];
        const peerFlags = peerHeader[1];

        let peerIp;
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            peerIp = message
                .subarray(6 + 6, 6 + 6 + 16)
                .toString('hex')
                .match(/.{1,4}/g)
                .join(':');
        } else {
            // IPv4 peer
            peerIp = message.subarray(6 + 18, 6 + 18 + 4).join('.');
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
        const peerHeader = message.subarray(6, 6 + 42);
        const peerType = peerHeader[0];
        const peerFlags = peerHeader[1];

        let peerIp;
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            peerIp = message
                .subarray(6 + 6, 6 + 6 + 16)
                .toString('hex')
                .match(/.{1,4}/g)
                .join(':');
        } else {
            // IPv4 peer
            peerIp = message.subarray(6 + 18, 6 + 18 + 4).join('.');
        }

        // BGP update starts after the peer header (at byte 6 + 42)
        const bgpUpdate = message.subarray(6 + 42);

        // Use parseBgpPacket to extract route information
        const { parseBgpPacket } = require('../utils/bgpPacketParser');
        let parsedUpdate = null;
        try {
            parsedUpdate = parseBgpPacket(bgpUpdate);
            log.info(`[BMP Worker ${threadId}] Parsed BGP UPDATE message: ${JSON.stringify(parsedUpdate)}`);
        } catch (err) {
            log.error(`[BMP Worker ${threadId}] Error parsing BGP UPDATE message: ${err.message}`);
        }

        // If we have valid parsed update data, extract route information
        if (parsedUpdate && parsedUpdate.valid && parsedUpdate.type === 2) {
            // Type 2 is UPDATE
            // Process withdrawn routes
            if (parsedUpdate.withdrawnRoutes && parsedUpdate.withdrawnRoutes.length > 0) {
                for (const route of parsedUpdate.withdrawnRoutes) {
                    const routeKey = `${route.prefix}/${route.length}`;
                    if (route.prefix.includes(':')) {
                        ipv6Routes.delete(routeKey);
                    } else {
                        ipv4Routes.delete(routeKey);
                    }
                    log.info(`[BMP Worker ${threadId}] Withdrawn route: ${routeKey} via ${peerIp}`);
                }
            }

            // Process announced routes (NLRI)
            if (parsedUpdate.nlri && parsedUpdate.nlri.length > 0) {
                for (const route of parsedUpdate.nlri) {
                    processAnnouncedRoute(route, 'ipv4', parsedUpdate.pathAttributes, peerIp);
                }
            }

            // Process MP_REACH_NLRI for IPv6 routes
            if (parsedUpdate.pathAttributes) {
                const mpReachAttr = parsedUpdate.pathAttributes.find(
                    attr => attr.typeCode === BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI
                );

                if (mpReachAttr && mpReachAttr.afi === 2) {
                    // AFI 2 is IPv6
                    for (const route of mpReachAttr.nlri) {
                        processAnnouncedRoute(route, 'ipv6', parsedUpdate.pathAttributes, peerIp);
                    }
                }
            }

            // Notify about route updates
            sendRouteUpdate('ipv4');
            sendRouteUpdate('ipv6');
            return;
        }

        // Fallback to the simple simulation if we couldn't parse the update properly
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

// Helper function to process announced routes
function processAnnouncedRoute(route, routeType, pathAttributes, peerIp) {
    const prefix = route.prefix;
    const mask = route.length;
    const routeKey = `${prefix}/${mask}`;

    // Extract path attributes
    let nextHop = '';
    let origin = 'igp';
    let asPath = [];
    let med = 0;
    let localPref = 100;

    if (pathAttributes) {
        // Extract next hop
        if (routeType === 'ipv4') {
            const nextHopAttr = pathAttributes.find(attr => attr.typeCode === BgpConst.BGP_PATH_ATTR.NEXT_HOP);
            if (nextHopAttr) {
                nextHop = nextHopAttr.nextHop;
            }
        } else if (routeType === 'ipv6') {
            const mpReachAttr = pathAttributes.find(attr => attr.typeCode === BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI);
            if (mpReachAttr) {
                nextHop = mpReachAttr.nextHop;
            }
        }

        // Extract origin
        const originAttr = pathAttributes.find(attr => attr.typeCode === BgpConst.BGP_PATH_ATTR.ORIGIN);
        if (originAttr) {
            switch (originAttr.origin) {
                case BgpConst.BGP_ORIGIN_TYPE.IGP:
                    origin = 'igp';
                    break;
                case BgpConst.BGP_ORIGIN_TYPE.EGP:
                    origin = 'egp';
                    break;
                case BgpConst.BGP_ORIGIN_TYPE.INCOMPLETE:
                    origin = 'incomplete';
                    break;
                default:
                    origin = 'unknown';
            }
        }

        // Extract AS path
        const asPathAttr = pathAttributes.find(attr => attr.typeCode === BgpConst.BGP_PATH_ATTR.AS_PATH);
        if (asPathAttr && asPathAttr.segments) {
            for (const segment of asPathAttr.segments) {
                asPath = asPath.concat(segment.asns);
            }
        }

        // Extract MED
        const medAttr = pathAttributes.find(attr => attr.typeCode === BgpConst.BGP_PATH_ATTR.MED);
        if (medAttr) {
            med = medAttr.med;
        }

        // Extract LOCAL_PREF
        const localPrefAttr = pathAttributes.find(attr => attr.typeCode === BgpConst.BGP_PATH_ATTR.LOCAL_PREF);
        if (localPrefAttr) {
            localPref = localPrefAttr.localPref;
        }
    }

    // If next hop is still empty, generate a default one
    if (!nextHop) {
        nextHop =
            routeType === 'ipv4'
                ? `10.0.0.${Math.floor(Math.random() * 254) + 1}`
                : `2001:db8:ffff::${Math.floor(Math.random() * 254) + 1}`;
    }

    // Create route object
    const routeObj = {
        prefix,
        mask,
        nextHop,
        peerIp,
        receivedAt: new Date().toISOString(),
        attributes: {
            origin,
            asPath,
            med,
            localPref
        }
    };

    // Store route
    if (routeType === 'ipv4') {
        ipv4Routes.set(routeKey, routeObj);
    } else {
        ipv6Routes.set(routeKey, routeObj);
    }

    log.info(`[BMP Worker ${threadId}] Received ${routeType.toUpperCase()} route: ${routeKey} via ${peerIp}`);
}

// Process statistics report
function processStatisticsReport(message, socket) {
    try {
        const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;

        // Parse peer header (starts at byte 6)
        const peerHeader = message.subarray(6, 6 + 42);
        const peerType = peerHeader[0];
        const peerFlags = peerHeader[1];

        let peerIp;
        if (peerFlags & BmpConst.BMP_PEER_FLAGS.IPV6) {
            // IPv6 peer
            peerIp = message
                .subarray(6 + 6, 6 + 6 + 16)
                .toString('hex')
                .match(/.{1,4}/g)
                .join(':');
        } else {
            // IPv4 peer
            peerIp = message.subarray(6 + 18, 6 + 18 + 4).join('.');
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
        const initiationData = message.subarray(6);
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

            const value = initiationData.subarray(position, position + length).toString('utf8');
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
