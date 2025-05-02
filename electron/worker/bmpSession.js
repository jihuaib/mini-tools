const Logger = require('../log/logger');
const BmpConst = require('../const/bmpConst');
const { BMP_EVT_TYPES } = require('../const/bmpEvtConst');
const { getInitiationTlvName } = require('../utils/bmpUtils');
class BmpSession {
    constructor(messageHandler) {
        this.socket = null;
        this.logger = new Logger();
        this.messageHandler = messageHandler;

        this.localIp = null;
        this.localPort = null;
        this.remoteIp = null;
        this.remotePort = null;
    }

    static makeKey(localIp, localPort, remoteIp, remotePort) {
        return `${localIp}|${localPort}|${remoteIp}|${remotePort}`;
    }

    static parseKey(key) {
        const [localIp, localPort, remoteIp, remotePort] = key.split('|');
        return { localIp, localPort, remoteIp, remotePort };
    }

    processRouteMonitoring(message) {
        this.logger.info('processRouteMonitoring', message.toString('hex'));
    }

    processInitiation(message) {
        try {
            let position = 0;

            // 存储TLV数据
            const tlvs = [];

            // 解析消息中的所有TLV
            while (position < message.length) {
                // 每个TLV由Type (2字节), Length (2字节)和Value (可变)组成
                if (position + 4 > message.length) {
                    break; // 没有足够的TLV头数据
                }

                const type = message.readUInt16BE(position);
                position += 2;

                const length = message.readUInt16BE(position);
                position += 2;

                if (position + length > message.length) {
                    break; // 没有足够的TLV值数据
                }

                const value = message.subarray(position, position + length).toString('utf8');
                position += length;

                tlvs.push({ type, length, value });
            }

            // 提取已知的TLV类型
            let sysName = '';
            let sysDesc = '';

            for (const tlv of tlvs) {
                switch (tlv.type) {
                    case BmpConst.BMP_INITIATION_TLV_TYPE.SYS_NAME: // sysName
                        sysName = tlv.value;
                        tlv.tlvName = getInitiationTlvName(tlv.type);
                        break;
                    case BmpConst.BMP_INITIATION_TLV_TYPE.SYS_DESC: // sysDesc
                        sysDesc = tlv.value;
                        tlv.tlvName = getInitiationTlvName(tlv.type);
                        break;
                    default:
                        tlv.tlvName = getInitiationTlvName(tlv.type);
                }
            }

            // 创建一个初始化记录
            const initiationRecord = {
                clientAddress: this.remoteIp,
                clientPort: this.remotePort,
                receivedAt: new Date(),
                sysName,
                sysDesc,
                rawTlvs: tlvs
            };

            this.messageHandler.sendEvent(BMP_EVT_TYPES.INITIATION, { data: initiationRecord });
            this.logger.info(`Processed initiation message: sysName=${sysName}, sysDesc=${sysDesc}`);
        } catch (err) {
            this.logger.error(`Error processing initiation:`, err);
        }
    }

    processMessage(message) {
        try {
            const clientAddress = `${this.remoteIp}:${this.remotePort}`;

            const version = message[0];
            const length = message.readUInt32BE(1);
            const type = message[5];

            this.logger.info(
                `Received message type ${BmpConst.BMP_MSG_TYPE_NAME[type]} from ${clientAddress}, length ${length}`
            );

            const msg = message.slice(BmpConst.BMP_HEADER_LENGTH, length);

            switch (type) {
                case BmpConst.BMP_MSG_TYPE.ROUTE_MONITORING:
                    this.processRouteMonitoring(msg);
                    break;

                case BmpConst.BMP_MSG_TYPE.STATISTICS_REPORT:
                    this.processStatisticsReport(msg);
                    break;

                case BmpConst.BMP_MSG_TYPE.PEER_DOWN_NOTIFICATION:
                    this.processPeerDown(msg);
                    break;

                case BmpConst.BMP_MSG_TYPE.PEER_UP_NOTIFICATION:
                    this.processPeerUp(msg);
                    break;

                case BmpConst.BMP_MSG_TYPE.INITIATION:
                    this.processInitiation(msg);
                    break;

                case BmpConst.BMP_MSG_TYPE.TERMINATION:
                    this.processTermination(msg);
                    break;

                case BmpConst.BMP_MSG_TYPE.ROUTE_MIRRORING:
                    this.processRouteMirroring(msg);
                    break;

                default:
                    this.logger.warn(`Unknown message type: ${type}`);
            }
        } catch (err) {
            this.logger.error(`Error processing message:`, err);
        }
    }

    recvMsg(buffer) {
        this.processMessage(buffer);
    }
}

module.exports = BmpSession;
