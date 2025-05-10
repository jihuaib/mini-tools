const logger = require('../log/logger');
const RpkiConst = require('../const/rpkiConst');
const { RPKI_EVT_TYPES } = require('../const/rpkiEvtConst');
const BgpConst = require('../const/bgpConst');
const { ipToBytes } = require('../utils/ipUtils');

class RpkiSession {
    constructor(messageHandler, rpkiWorker) {
        this.socket = null;
        this.messageHandler = messageHandler;
        this.rpkiWorker = rpkiWorker;
        this.localIp = null;
        this.localPort = null;
        this.remoteIp = null;
        this.remotePort = null;
        this.messageBuffer = Buffer.alloc(0);
        this.sessionId = null;
        this.protocolVersion = RpkiConst.RPKI_PROTOCOL_VERSION.V0;
    }

    static makeKey(localIp, localPort, remoteIp, remotePort) {
        return `${localIp}|${localPort}|${remoteIp}|${remotePort}`;
    }

    static parseKey(key) {
        const [localIp, localPort, remoteIp, remotePort] = key.split('|');
        return { localIp, localPort, remoteIp, remotePort };
    }

    processMessage(message) {
        try {
            const clientAddress = `${this.remoteIp}:${this.remotePort}`;
            const header = this.parseRpkiHeader(message);

            logger.info(
                `Received message from ${clientAddress}, type: ${RpkiConst.RPKI_MSG_TYPE_NAME[header.type]}, length ${message.length}`
            );

            switch (header.type) {
                case RpkiConst.RPKI_MSG_TYPE.RESET_QUERY:
                    this.handleResetQuery(header, message);
                    break;
                case RpkiConst.RPKI_MSG_TYPE.CACHE_RESPONSE:
                    this.handleCacheResponse(message);
                    break;
                case RpkiConst.RPKI_MSG_TYPE.IPV4_PREFIX:
                    this.handleIPv4Prefix(message);
                    break;
                case RpkiConst.RPKI_MSG_TYPE.IPV6_PREFIX:
                    this.handleIPv6Prefix(message);
                    break;
                case RpkiConst.RPKI_MSG_TYPE.END_OF_DATA:
                    this.handleEndOfData(message);
                    break;
                case RpkiConst.RPKI_MSG_TYPE.CACHE_RESET:
                    this.handleCacheReset(message);
                    break;
                case RpkiConst.RPKI_MSG_TYPE.ROUTER_KEY:
                    this.handleRouterKey(message);
                    break;
                case RpkiConst.RPKI_MSG_TYPE.ERROR_REPORT:
                    this.handleErrorReport(message);
                    break;
                case RpkiConst.RPKI_MSG_TYPE.ERROR:
                    this.handleError(message);
                    break;
                default:
                    logger.error(`Unknown message type: ${header.type}`);
                    this.sendError(RpkiConst.RPKI_ERROR_CODE.UNSUPPORTED_PDU_TYPE);
            }
        } catch (err) {
            logger.error(`Error processing message:`, err);
            this.sendError(RpkiConst.RPKI_ERROR_CODE.INTERNAL_ERROR);
        }
    }

    recvMsg(buffer) {
        this.messageBuffer = Buffer.concat([this.messageBuffer, buffer]);
        this.processBufferedMessages();
    }

    parseRpkiHeader(buffer) {
        const version = buffer[0];
        const type = buffer[1];
        const reserved = buffer.readUInt16BE(2);
        const length = buffer.readUInt32BE(4);
        return { version, type, reserved, length };
    }

    processBufferedMessages() {
        while (this.messageBuffer.length >= RpkiConst.RPKI_HEADER_LENGTH) {
            const header = this.parseRpkiHeader(this.messageBuffer);
            if (this.messageBuffer.length < header.length) {
                logger.info(
                    `Waiting for more data. Have ${this.messageBuffer.length} bytes, need ${header.length} bytes`
                );
                break;
            }

            const completeMessage = this.messageBuffer.subarray(0, header.length);
            this.messageBuffer = this.messageBuffer.subarray(header.length);
            this.processMessage(completeMessage);
        }
    }

    closeSession() {
        this.messageHandler.sendEvent(RPKI_EVT_TYPES.CLIENT_CONNECTION, {
            opType: 'delete',
            data: this.getClientInfo()
        });
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
    }

    // RPKI Message Handling Methods
    handleResetQuery(header, _message) {
        this.protocolVersion = header.version;
        if (this.protocolVersion === RpkiConst.RPKI_PROTOCOL_VERSION.V0) {
            this.sendCacheResponse();
            this.sendRoaData();
            this.sendEndOfData();
        } else {
            logger.error(`Unsupported protocol version: ${this.protocolVersion}`);
            this.sendError(RpkiConst.RPKI_ERROR_CODE.UNSUPPORTED_PROTOCOL_VERSION);
        }
    }

    handleCacheResponse(message) {
        logger.info(`Handling Cache Response message`);
        this.sessionId = message.readUInt16BE(RpkiConst.RPKI_HEADER_LENGTH);
        logger.info(`Session ID: ${this.sessionId}`);
    }

    handleIPv4Prefix(message) {
        const flags = message[RpkiConst.RPKI_HEADER_LENGTH];
        const prefixLength = message[RpkiConst.RPKI_HEADER_LENGTH + 1];
        const maxLength = message[RpkiConst.RPKI_HEADER_LENGTH + 2];
        const asn = message.readUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 4);

        // Read IPv4 address (4 bytes)
        const prefix = message.subarray(RpkiConst.RPKI_HEADER_LENGTH + 8, RpkiConst.RPKI_HEADER_LENGTH + 12);
        const ipv4 = `${prefix[0]}.${prefix[1]}.${prefix[2]}.${prefix[3]}`;

        logger.info(`IPv4 Prefix: ${ipv4}/${prefixLength}, MaxLength: ${maxLength}, ASN: ${asn}, Flags: ${flags}`);

        // Store ROA data
        const roaKey = `${ipv4}/${prefixLength}-${asn}`;
        this.roaData.set(roaKey, {
            type: 'ipv4',
            prefix: ipv4,
            prefixLength,
            maxLength,
            asn,
            flags,
            status: RpkiConst.RPKI_ROA_STATUS.ACTIVE
        });

        // Notify frontend of new ROA data
        this.notifyRoaUpdate();
    }

    handleIPv6Prefix(message) {
        const flags = message[RpkiConst.RPKI_HEADER_LENGTH];
        const prefixLength = message[RpkiConst.RPKI_HEADER_LENGTH + 1];
        const maxLength = message[RpkiConst.RPKI_HEADER_LENGTH + 2];
        const asn = message.readUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 4);

        // Read IPv6 address (16 bytes)
        const prefix = message.subarray(RpkiConst.RPKI_HEADER_LENGTH + 8, RpkiConst.RPKI_HEADER_LENGTH + 24);

        // Format IPv6 address
        let ipv6Parts = [];
        for (let i = 0; i < 16; i += 2) {
            ipv6Parts.push(prefix.readUInt16BE(i).toString(16));
        }
        const ipv6 = ipv6Parts.join(':');

        logger.info(`IPv6 Prefix: ${ipv6}/${prefixLength}, MaxLength: ${maxLength}, ASN: ${asn}, Flags: ${flags}`);

        // Store ROA data
        const roaKey = `${ipv6}/${prefixLength}-${asn}`;
        this.roaData.set(roaKey, {
            type: 'ipv6',
            prefix: ipv6,
            prefixLength,
            maxLength,
            asn,
            flags,
            status: RpkiConst.RPKI_ROA_STATUS.ACTIVE
        });

        // Notify frontend of new ROA data
        this.notifyRoaUpdate();
    }

    handleEndOfData(message) {
        logger.info(`Handling End of Data message`);
        // Process end of data notification
        // The version 1 End of Data PDU has the following format:
        if (this.protocolVersion >= RpkiConst.RPKI_PROTOCOL_VERSION.V0) {
            const sessionId = message.readUInt16BE(RpkiConst.RPKI_HEADER_LENGTH);
            const serial = message.readUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 2);
            const refreshInterval = message.readUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 6);
            const retryInterval = message.readUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 10);
            const expireInterval = message.readUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 14);

            logger.info(`Session ID: ${sessionId}, Serial: ${serial}`);
            logger.info(`Refresh: ${refreshInterval}, Retry: ${retryInterval}, Expire: ${expireInterval}`);
        }

        // Notify frontend that we've received all data
        this.notifyRoaComplete();
    }

    handleCacheReset(_message) {
        logger.info(`Handling Cache Reset message`);
        // Clear all current ROA data
        this.roaData.clear();

        // Send a Reset Query to request fresh data
        this.sendResetQuery();
    }

    handleRouterKey(_message) {
        logger.info(`Handling Router Key message`);
        // Process router key information
    }

    handleErrorReport(message) {
        // Process error report
        const errorCode = message.readUInt16BE(RpkiConst.RPKI_HEADER_LENGTH);

        // Extract length of the erroneous PDU
        const pduLength = message.readUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 2);

        // Extract the erroneous PDU itself
        const erroneousPdu = message.subarray(
            RpkiConst.RPKI_HEADER_LENGTH + 6,
            RpkiConst.RPKI_HEADER_LENGTH + 6 + pduLength
        );

        logger.error(
            `RPKI Error Report: Code ${errorCode}, PDU Length: ${pduLength}, Erroneous PDU: ${Buffer.from(erroneousPdu).toString('hex')}`
        );
    }

    handleError(message) {
        const errorCode = message.readUInt16BE(RpkiConst.RPKI_HEADER_LENGTH);
        logger.error(`RPKI Error: Code ${errorCode}`);
    }

    sendMessage(buffer) {
        if (!this.socket || this.socket.destroyed) {
            logger.error(`Cannot send message: socket is closed or destroyed`);
            return;
        }

        try {
            this.socket.write(buffer);
            logger.info(`Sent message to ${this.remoteIp}:${this.remotePort}, length ${buffer.length}`);
        } catch (err) {
            logger.error(`Error sending message: ${err.message}`);
        }
    }

    sendResetQuery() {
        // Create Reset Query message
        // Header: Version(1) + Type(2) + Reserved(0) + Length(8)
        const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH);

        buffer[0] = this.protocolVersion; // Version
        buffer[1] = RpkiConst.RPKI_MSG_TYPE.RESET_QUERY; // Type
        buffer.writeUInt16BE(0, 2); // Reserved
        buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH, 4); // Length

        this.sendMessage(buffer);
    }

    sendCacheResponse() {
        const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH);

        buffer[0] = this.protocolVersion; // Version
        buffer[1] = RpkiConst.RPKI_MSG_TYPE.CACHE_RESPONSE; // Type
        if (!this.sessionId) {
            this.sessionId = Math.floor(Math.random() * 65536);
        }
        buffer.writeUInt16BE(this.sessionId, 2);
        buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH, 4); // Length

        this.sendMessage(buffer);
    }

    sendIPv4Prefix(rpkiRoa) {
        // Header + Flags(1) + PrefixLength(1) + MaxLength(1) + Padding(1) + ASN(4) + Prefix(4)
        const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH + 12);

        let position = 0;

        buffer[position] = this.protocolVersion; // Version
        position++;
        buffer[position] = RpkiConst.RPKI_MSG_TYPE.IPV4_PREFIX; // Type
        position++;
        buffer.writeUInt16BE(0, position); // Reserved
        position += 2;
        buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 12, position); // Length
        position += 4;

        buffer[position] = RpkiConst.RPKI_FLAGS.UPDATE; // Flags
        position++;
        buffer[position] = rpkiRoa.mask; // Prefix Length
        position++;
        buffer[position] = rpkiRoa.maxLength; // Max Length
        position++;
        buffer[position] = 0; // Padding
        position++;

        // Write IPv4 prefix
        const ipBytesArray = ipToBytes(rpkiRoa.ip);
        for (let i = 0; i < 4; i++) {
            buffer[position + i] = ipBytesArray[i];
        }
        position += 4;

        buffer.writeUInt32BE(rpkiRoa.asn, position); // ASN
        position += 4;

        this.sendMessage(buffer);
    }

    sendIPv6Prefix(rpkiRoa) {
        // Header + Flags(1) + PrefixLength(1) + MaxLength(1) + Padding(1) + ASN(4) + Prefix(16)
        const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH + 24);

        let position = 0;

        buffer[position] = this.protocolVersion; // Version
        position++;
        buffer[position] = RpkiConst.RPKI_MSG_TYPE.IPV6_PREFIX; // Type
        position++;
        buffer.writeUInt16BE(0, position); // Reserved
        position += 2;
        buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 24, position); // Length
        position += 4;

        buffer[position] = RpkiConst.RPKI_FLAGS.UPDATE; // Flags
        position++;
        buffer[position] = rpkiRoa.mask; // Prefix Length
        position++;
        buffer[position] = rpkiRoa.maxLength; // Max Length
        position++;
        buffer[position] = 0; // Padding
        position++;

        // Write IPv6 prefix
        const ipBytesArray = ipToBytes(rpkiRoa.ip);
        for (let i = 0; i < 16; i++) {
            buffer[position + i] = ipBytesArray[i];
        }
        position += 16;

        buffer.writeUInt32BE(rpkiRoa.asn, position); // ASN
        position += 4;

        this.sendMessage(buffer);
    }

    withdrawIPv4Prefix(rpkiRoa) {
        // Header + Flags(1) + PrefixLength(1) + MaxLength(1) + Padding(1) + ASN(4) + Prefix(4)
        const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH + 12);

        let position = 0;

        buffer[position] = this.protocolVersion; // Version
        position++;
        buffer[position] = RpkiConst.RPKI_MSG_TYPE.IPV4_PREFIX; // Type
        position++;
        buffer.writeUInt16BE(0, position); // Reserved
        position += 2;
        buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 12, position); // Length
        position += 4;

        buffer[position] = RpkiConst.RPKI_FLAGS.WITHDRAWAL; // Flags
        position++;
        buffer[position] = rpkiRoa.mask; // Prefix Length
        position++;
        buffer[position] = rpkiRoa.maxLength; // Max Length
        position++;
        buffer[position] = 0; // Padding
        position++;

        // Write IPv4 prefix
        const ipBytesArray = ipToBytes(rpkiRoa.ip);
        for (let i = 0; i < 4; i++) {
            buffer[position + i] = ipBytesArray[i];
        }
        position += 4;

        buffer.writeUInt32BE(rpkiRoa.asn, position); // ASN
        position += 4;

        this.sendMessage(buffer);
    }

    withdrawIPv6Prefix(rpkiRoa) {
        // Header + Flags(1) + PrefixLength(1) + MaxLength(1) + Padding(1) + ASN(4) + Prefix(16)
        const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH + 24);

        let position = 0;

        buffer[position] = this.protocolVersion; // Version
        position++;
        buffer[position] = RpkiConst.RPKI_MSG_TYPE.IPV6_PREFIX; // Type
        position++;
        buffer.writeUInt16BE(0, position); // Reserved
        position += 2;
        buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 24, position); // Length
        position += 4;

        buffer[position] = RpkiConst.RPKI_FLAGS.WITHDRAWAL; // Flags
        position++;
        buffer[position] = rpkiRoa.mask; // Prefix Length
        position++;
        buffer[position] = rpkiRoa.maxLength; // Max Length
        position++;
        buffer[position] = 0; // Padding
        position++;

        // Write IPv6 prefix
        const ipBytesArray = ipToBytes(rpkiRoa.ip);
        for (let i = 0; i < 16; i++) {
            buffer[position + i] = ipBytesArray[i];
        }
        position += 16;

        buffer.writeUInt32BE(rpkiRoa.asn, position); // ASN
        position += 4;

        this.sendMessage(buffer);
    }

    sendEndOfData() {
        if (this.protocolVersion > RpkiConst.RPKI_PROTOCOL_VERSION.V0) {
            // Header + SessionID(2) + Serial(4) + Refresh(4) + Retry(4) + Expire(4)
            const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH + 18);

            buffer[0] = this.protocolVersion; // Version
            buffer[1] = RpkiConst.RPKI_MSG_TYPE.END_OF_DATA; // Type
            buffer.writeUInt16BE(0, 2); // Reserved
            buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 18, 4); // Length

            buffer.writeUInt16BE(this.sessionId, RpkiConst.RPKI_HEADER_LENGTH); // Session ID
            buffer.writeUInt32BE(1, RpkiConst.RPKI_HEADER_LENGTH + 2); // Serial Number

            // Default intervals (in seconds)
            buffer.writeUInt32BE(3600, RpkiConst.RPKI_HEADER_LENGTH + 6); // Refresh: 1 hour
            buffer.writeUInt32BE(600, RpkiConst.RPKI_HEADER_LENGTH + 10); // Retry: 10 minutes
            buffer.writeUInt32BE(7200, RpkiConst.RPKI_HEADER_LENGTH + 14); // Expire: 2 hours

            this.sendMessage(buffer);
        } else {
            const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH + 4);
            let position = 0;

            buffer[position] = this.protocolVersion; // Version
            position++;
            buffer[position] = RpkiConst.RPKI_MSG_TYPE.END_OF_DATA; // Type
            position++;
            buffer.writeUInt16BE(this.sessionId, position); // Reserved
            position += 2;
            buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 4, position); // Length
            position += 4;

            buffer.writeUInt32BE(0, position); // Serial Number
            position += 4;

            this.sendMessage(buffer);
        }
    }

    sendCacheReset() {
        // Create Cache Reset message
        const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH);

        buffer[0] = this.protocolVersion; // Version
        buffer[1] = RpkiConst.RPKI_MSG_TYPE.CACHE_RESET; // Type
        buffer.writeUInt16BE(0, 2); // Reserved
        buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH, 4); // Length

        this.sendMessage(buffer);
    }

    sendError(errorCode) {
        // Create Error message
        // Header + ErrorCode(2)
        const buffer = Buffer.alloc(RpkiConst.RPKI_HEADER_LENGTH + 2);

        buffer[0] = this.protocolVersion; // Version
        buffer[1] = RpkiConst.RPKI_MSG_TYPE.ERROR; // Type
        buffer.writeUInt16BE(0, 2); // Reserved
        buffer.writeUInt32BE(RpkiConst.RPKI_HEADER_LENGTH + 2, 4); // Length

        buffer.writeUInt16BE(errorCode, RpkiConst.RPKI_HEADER_LENGTH); // Error Code

        this.sendMessage(buffer);
    }

    sendRoaData() {
        const roaList = this.rpkiWorker.rpkiRoaMap.values();
        for (const roa of roaList) {
            this.sendSingleRoaData(roa);
        }
    }

    withdrawRoaData() {
        const roaList = this.rpkiWorker.rpkiRoaMap.values();
        for (const roa of roaList) {
            this.withdrawSingleRoaData(roa);
        }
    }

    // Notification methods to inform the front-end
    notifyRoaUpdate() {
        // Convert ROA data to array for easier consumption by front-end
        const roaArray = Array.from(this.roaData.values());

        // Notify front-end of ROA update
        this.messageHandler.sendEvent(RPKI_EVT_TYPES.ROA_UPDATE, {
            serverInfo: `${this.remoteIp}:${this.remotePort}`,
            roaData: roaArray
        });
    }

    notifyRoaComplete() {
        // Notify front-end that all ROA data has been received
        this.messageHandler.sendEvent(RPKI_EVT_TYPES.ROA_COMPLETE, {
            serverInfo: `${this.remoteIp}:${this.remotePort}`,
            totalRoaEntries: this.roaData.size
        });
    }

    sendSingleRoaData(rpkiRoa) {
        if (rpkiRoa.ipType === BgpConst.IP_TYPE.IPV4) {
            this.sendIPv4Prefix(rpkiRoa);
        } else {
            this.sendIPv6Prefix(rpkiRoa);
        }
    }

    withdrawSingleRoaData(rpkiRoa) {
        if (rpkiRoa.ipType === BgpConst.IP_TYPE.IPV4) {
            this.withdrawIPv4Prefix(rpkiRoa);
        } else {
            this.withdrawIPv6Prefix(rpkiRoa);
        }
    }

    getClientInfo() {
        return {
            localIp: this.localIp,
            localPort: this.localPort,
            remoteIp: this.remoteIp,
            remotePort: this.remotePort
        };
    }
}

module.exports = RpkiSession;
