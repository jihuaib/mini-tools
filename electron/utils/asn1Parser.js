const logger = require('../log/logger');
const SnmpConst = require('../const/snmpConst');

/**
 * ASN.1 BER解析器类
 */
class Asn1Parser {
    constructor(buffer) {
        this.buffer = buffer;
        this.position = 0;
    }

    /**
     * 解析序列
     */
    parseSequence() {
        const tag = this.readByte();
        if (tag !== SnmpConst.SNMP_BER_ASN1_TAG.SEQUENCE) {
            logger.error(`期望序列标记0x30，但得到0x${tag.toString(16)}`);
            return null;
        }

        const length = this.parseLength();
        if (length === null) return null;

        return { tag, length };
    }

    /**
     * 解析整数
     */
    parseInteger() {
        const tag = this.readByte();
        if (tag !== SnmpConst.SNMP_BER_ASN1_TAG.INTEGER) {
            logger.error(`期望整数标记0x02，但得到0x${tag.toString(16)}`);
            return null;
        }

        const length = this.parseLength();
        if (length === null || length === 0) return null;

        let value = 0;
        for (let i = 0; i < length; i++) {
            value = (value << 8) | this.readByte();
        }

        // 处理负数（二进制补码）
        if (length > 0 && this.buffer[this.position - length] & 0x80) {
            value = value - Math.pow(2, length * 8);
        }

        return value;
    }

    /**
     * 解析八位字节串
     */
    parseOctetString() {
        const tag = this.readByte();
        if (tag !== SnmpConst.SNMP_BER_ASN1_TAG.OCTET_STRING) {
            logger.error(`期望八位字节串标记0x04，但得到0x${tag.toString(16)}`);
            return null;
        }

        const length = this.parseLength();
        if (length === null) return null;

        const bytes = [];
        for (let i = 0; i < length; i++) {
            bytes.push(this.readByte());
        }

        return Buffer.from(bytes).toString('utf8');
    }

    /**
     * 解析对象标识符
     */
    parseObjectIdentifier() {
        const tag = this.readByte();
        if (tag !== SnmpConst.SNMP_BER_ASN1_TAG.OBJECT_IDENTIFIER) {
            logger.error(`期望对象标识符标记0x06，但得到0x${tag.toString(16)}`);
            return null;
        }

        const length = this.parseLength();
        if (length === null || length === 0) return null;

        const end = this.position + length;
        const oid = [];

        // 读取首字节（包含前两个 OID 节点）
        const firstByte = this.readByte();
        const first = Math.floor(firstByte / 40);
        const second = firstByte % 40;

        // 修正：当 first >= 2 时，第二部分不限制必须 < 40
        oid.push(first);
        oid.push(second);

        let value = 0;

        while (this.position < end) {
            const byte = this.readByte();
            value = (value << 7) | (byte & 0x7f);

            if ((byte & 0x80) === 0) {
                // 最高位为 0 表示这是最后一个字节
                oid.push(value);
                value = 0;
            }
        }

        return oid.join('.');
    }

    /**
     * 解析PDU
     */
    parsePdu() {
        const tag = this.readByte();
        const length = this.parseLength();
        if (length === null) return null;

        const pduResult = {
            type: tag,
            varbinds: []
        };

        // 根据PDU类型解析
        if (tag === SnmpConst.SNMP_PDU_TYPE.TRAP) {
            // SNMPv1 Trap PDU
            pduResult.enterprise = this.parseObjectIdentifier();
            pduResult.agentAddr = this.parseIpAddress();
            pduResult.genericTrap = this.parseInteger();
            pduResult.specificTrap = this.parseInteger();
            pduResult.timeStamp = this.parseTimeTicks();
            pduResult.varbinds = this.parseVarBindList();
        } else if (tag === SnmpConst.SNMP_PDU_TYPE.SNMPV2_TRAP || tag === SnmpConst.SNMP_PDU_TYPE.INFORM_REQUEST) {
            // SNMPv2 Trap PDU 或 Inform Request
            pduResult.requestId = this.parseInteger();
            pduResult.errorStatus = this.parseInteger();
            pduResult.errorIndex = this.parseInteger();
            pduResult.varbinds = this.parseVarBindList();
        } else {
            // 其他PDU类型
            pduResult.requestId = this.parseInteger();
            pduResult.errorStatus = this.parseInteger();
            pduResult.errorIndex = this.parseInteger();
            pduResult.varbinds = this.parseVarBindList();
        }

        return pduResult;
    }

    /**
     * 解析IP地址
     */
    parseIpAddress() {
        const tag = this.readByte();
        if (tag !== SnmpConst.SNMP_BER_ASN1_TAG.IP_ADDRESS) {
            // IpAddress tag
            this.position--; // 回退
            return '0.0.0.0';
        }

        const length = this.parseLength();
        if (length !== 4) return '0.0.0.0';

        const ip = [];
        for (let i = 0; i < 4; i++) {
            ip.push(this.readByte());
        }

        return ip.join('.');
    }

    /**
     * 解析TimeTicks
     */
    parseTimeTicks() {
        const tag = this.readByte();
        if (tag !== SnmpConst.SNMP_BER_ASN1_TAG.TIME_TICKS) {
            // TimeTicks tag
            this.position--; // 回退
            return this.parseInteger(); // 作为普通整数解析
        }

        const length = this.parseLength();
        if (length === null) return 0;

        let value = 0;
        for (let i = 0; i < length; i++) {
            value = (value << 8) | this.readByte();
        }

        return value;
    }

    /**
     * 解析变量绑定列表
     */
    parseVarBindList() {
        const tag = this.readByte();
        if (tag !== SnmpConst.SNMP_BER_ASN1_TAG.SEQUENCE) {
            logger.error(`期望变量绑定列表序列标记0x30，但得到0x${tag.toString(16)}`);
            return [];
        }

        const length = this.parseLength();
        if (length === null) return [];

        const varbinds = [];
        const endPosition = this.position + length;

        while (this.position < endPosition && this.position < this.buffer.length) {
            const varbind = this.parseVarBind();
            if (varbind) {
                varbinds.push(varbind);
            } else {
                break;
            }
        }

        return varbinds;
    }

    /**
     * 解析单个变量绑定
     */
    parseVarBind() {
        if (this.position >= this.buffer.length) return null;

        const tag = this.readByte();
        if (tag !== SnmpConst.SNMP_BER_ASN1_TAG.SEQUENCE) {
            logger.error(`期望变量绑定序列标记0x30，但得到0x${tag.toString(16)}`);
            return null;
        }

        const length = this.parseLength();
        if (length === null) return null;

        const oid = this.parseObjectIdentifier();
        if (!oid) return null;

        const value = this.parseValue();

        return {
            oid: oid,
            type: value.type,
            value: value.value
        };
    }

    /**
     * 解析值
     */
    parseValue() {
        if (this.position >= this.buffer.length) {
            return { type: 'Unknown', value: null };
        }

        const startPosition = this.position; // 记录开始位置
        const tag = this.readByte();
        const length = this.parseLength();

        if (length === null) {
            return { type: 'Unknown', value: null };
        }

        switch (tag) {
            case SnmpConst.SNMP_BER_ASN1_TAG.INTEGER: // INTEGER
                this.position = startPosition; // 回退到开始位置
                return { type: 'Integer', value: this.parseInteger() };

            case SnmpConst.SNMP_BER_ASN1_TAG.OCTET_STRING: // OCTET STRING
                this.position = startPosition; // 回退到开始位置
                return { type: 'OctetString', value: this.parseOctetString() };

            case SnmpConst.SNMP_BER_ASN1_TAG.OBJECT_IDENTIFIER: // OBJECT IDENTIFIER
                this.position = startPosition; // 回退到开始位置
                return { type: 'ObjectIdentifier', value: this.parseObjectIdentifier() };

            case SnmpConst.SNMP_BER_ASN1_TAG.IP_ADDRESS: // IpAddress
                const ip = [];
                for (let i = 0; i < Math.min(length, 4); i++) {
                    ip.push(this.readByte());
                }
                return { type: 'IpAddress', value: ip.join('.') };

            case SnmpConst.SNMP_BER_ASN1_TAG.COUNTER32: // Counter32
                let counter = 0;
                for (let i = 0; i < length; i++) {
                    counter = (counter << 8) | this.readByte();
                }
                return { type: 'Counter32', value: counter };

            case SnmpConst.SNMP_BER_ASN1_TAG.GAUGE32: // Gauge32
                let gauge = 0;
                for (let i = 0; i < length; i++) {
                    gauge = (gauge << 8) | this.readByte();
                }
                return { type: 'Gauge32', value: gauge };

            case SnmpConst.SNMP_BER_ASN1_TAG.TIME_TICKS: // TimeTicks
                let ticks = 0;
                for (let i = 0; i < length; i++) {
                    ticks = (ticks << 8) | this.readByte();
                }
                return { type: 'TimeTicks', value: ticks };

            case SnmpConst.SNMP_BER_ASN1_TAG.OPAQUE: // Opaque
                const opaque = [];
                for (let i = 0; i < length; i++) {
                    opaque.push(this.readByte());
                }
                return { type: 'Opaque', value: Buffer.from(opaque).toString('hex') };

            case SnmpConst.SNMP_BER_ASN1_TAG.COUNTER64: // Counter64
                let counter64 = 0;
                for (let i = 0; i < length; i++) {
                    counter64 = (counter64 << 8) | this.readByte();
                }
                return { type: 'Counter64', value: counter64 };

            case SnmpConst.SNMP_BER_ASN1_TAG.NULL: // NULL
                return { type: 'Null', value: null };

            default:
                // 跳过未知类型的数据
                for (let i = 0; i < length; i++) {
                    this.readByte();
                }
                return { type: `Unknown(0x${tag.toString(16)})`, value: null };
        }
    }

    /**
     * 解析长度字段
     */
    parseLength() {
        if (this.position >= this.buffer.length) return null;

        const firstByte = this.readByte();

        if ((firstByte & 0x80) === 0) {
            // 短格式：长度在7位内
            return firstByte;
        } else {
            // 长格式：后续字节表示长度
            const lengthBytes = firstByte & 0x7f;
            if (lengthBytes === 0) {
                // 不定长度格式，不支持
                logger.error('不支持不定长度格式');
                return null;
            }

            if (lengthBytes > 4) {
                logger.error('长度字段太长');
                return null;
            }

            let length = 0;
            for (let i = 0; i < lengthBytes; i++) {
                if (this.position >= this.buffer.length) return null;
                length = (length << 8) | this.readByte();
            }

            return length;
        }
    }

    /**
     * 读取一个字节
     */
    readByte() {
        if (this.position >= this.buffer.length) {
            throw new Error('缓冲区越界');
        }
        return this.buffer[this.position++];
    }

    /**
     * 检查是否还有数据
     */
    hasMoreData() {
        return this.position < this.buffer.length;
    }
}

module.exports = Asn1Parser;
