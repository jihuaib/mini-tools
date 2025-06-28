const crypto = require('crypto');
const logger = require('../log/logger');

class SnmpUtils {
    /**
     * 生成SNMP请求ID
     */
    static generateRequestId() {
        return Math.floor(Math.random() * 2147483647);
    }

    /**
     * 验证SNMP版本
     */
    static validateSnmpVersion(version) {
        const validVersions = ['v1', 'v2c', 'v3'];
        return validVersions.includes(version);
    }

    /**
     * 验证OID格式
     */
    static validateOid(oid) {
        if (!oid || typeof oid !== 'string') {
            return false;
        }

        // OID格式: 数字.数字.数字...
        const oidPattern = /^[0-9]+(\.[0-9]+)*$/;
        return oidPattern.test(oid);
    }

    /**
     * 比较OID
     */
    static compareOid(oid1, oid2) {
        if (!oid1 || !oid2) return false;

        const parts1 = oid1.split('.').map(Number);
        const parts2 = oid2.split('.').map(Number);

        const minLength = Math.min(parts1.length, parts2.length);

        for (let i = 0; i < minLength; i++) {
            if (parts1[i] < parts2[i]) return -1;
            if (parts1[i] > parts2[i]) return 1;
        }

        return parts1.length - parts2.length;
    }

    /**
     * 格式化OID显示
     */
    static formatOid(oid) {
        if (!this.validateOid(oid)) {
            return oid;
        }

        // 常见OID的友好名称映射
        const oidNames = {
            '1.3.6.1.2.1.1.1.0': 'sysDescr',
            '1.3.6.1.2.1.1.2.0': 'sysObjectID',
            '1.3.6.1.2.1.1.3.0': 'sysUpTime',
            '1.3.6.1.2.1.1.4.0': 'sysContact',
            '1.3.6.1.2.1.1.5.0': 'sysName',
            '1.3.6.1.2.1.1.6.0': 'sysLocation',
            '1.3.6.1.6.3.1.1.4.1.0': 'snmpTrapOID'
        };

        return oidNames[oid] || oid;
    }

    /**
     * 解析SNMP数据类型
     */
    static parseSnmpType(typeTag) {
        const types = {
            0x02: 'INTEGER',
            0x04: 'OCTET STRING',
            0x05: 'NULL',
            0x06: 'OBJECT IDENTIFIER',
            0x40: 'IpAddress',
            0x41: 'Counter32',
            0x42: 'Gauge32',
            0x43: 'TimeTicks',
            0x44: 'Opaque',
            0x46: 'Counter64'
        };

        return types[typeTag] || 'Unknown';
    }

    /**
     * 格式化SNMP值
     */
    static formatSnmpValue(value, type) {
        try {
            switch (type) {
                case 'INTEGER':
                case 'Counter32':
                case 'Gauge32':
                    return parseInt(value).toString();

                case 'TimeTicks': {
                    const ticks = parseInt(value);
                    const seconds = Math.floor(ticks / 100);
                    const days = Math.floor(seconds / 86400);
                    const hours = Math.floor((seconds % 86400) / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;

                    if (days > 0) {
                        return `${days}d ${hours}h ${minutes}m ${secs}s`;
                    } else if (hours > 0) {
                        return `${hours}h ${minutes}m ${secs}s`;
                    } else if (minutes > 0) {
                        return `${minutes}m ${secs}s`;
                    } else {
                        return `${secs}s`;
                    }
                }
                case 'IpAddress':
                    if (typeof value === 'string' && value.includes('.')) {
                        return value;
                    }
                    break;

                case 'OCTET STRING':
                    // 尝试解析为可打印字符串
                    if (typeof value === 'string') {
                        return value;
                    }
                    break;

                default:
                    return value.toString();
            }

            return value.toString();
        } catch (error) {
            logger.error('格式化SNMP值失败:', error);
            return value.toString();
        }
    }

    /**
     * 生成Trap ID
     */
    static generateTrapId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `trap_${timestamp}_${random}`;
    }

    /**
     * 验证IP地址
     */
    static validateIpAddress(ip) {
        if (!ip || typeof ip !== 'string') {
            return false;
        }

        // IPv4
        const ipv4Pattern =
            /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (ipv4Pattern.test(ip)) {
            return true;
        }

        // IPv6 (简化验证)
        const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv6Pattern.test(ip);
    }

    /**
     * 验证端口号
     */
    static validatePort(port) {
        const portNum = parseInt(port);
        return portNum >= 1 && portNum <= 65535;
    }

    /**
     * 创建简单的ASN.1 BER编码器（用于测试）
     */
    static encodeAsn1Integer(value) {
        const buffer = Buffer.alloc(6);
        buffer[0] = 0x02; // INTEGER tag
        buffer[1] = 0x04; // length
        buffer.writeInt32BE(value, 2);
        return buffer;
    }

    /**
     * 解析ASN.1 BER编码的整数（简化版）
     */
    static decodeAsn1Integer(buffer, offset = 0) {
        if (buffer[offset] !== 0x02) {
            throw new Error('不是INTEGER类型');
        }

        const length = buffer[offset + 1];
        if (length > 4) {
            throw new Error('INTEGER长度超出范围');
        }

        let value = 0;
        for (let i = 0; i < length; i++) {
            value = (value << 8) + buffer[offset + 2 + i];
        }

        return value;
    }

    /**
     * 计算MD5哈希（用于SNMPv3认证）
     */
    static calculateMD5Hash(data) {
        const hash = crypto.createHash('md5');
        hash.update(data);
        return hash.digest();
    }

    /**
     * 计算SHA哈希（用于SNMPv3认证）
     */
    static calculateSHAHash(data, algorithm = 'sha1') {
        const hash = crypto.createHash(algorithm);
        hash.update(data);
        return hash.digest();
    }

    /**
     * 生成随机字节序列
     */
    static generateRandomBytes(length) {
        return crypto.randomBytes(length);
    }

    /**
     * 获取Trap优先级
     */
    static getTrapPriority(trapType, _enterpriseOid) {
        // 根据Trap类型和企业OID确定优先级
        if (trapType === 'coldStart' || trapType === 'warmStart') {
            return 'high';
        } else if (trapType === 'linkDown' || trapType === 'linkUp') {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * 格式化时间戳
     */
    static formatTimestamp(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toISOString().replace('T', ' ').split('.')[0];
        } catch (error) {
            return timestamp;
        }
    }

    /**
     * 验证Community字符串
     */
    static validateCommunity(community) {
        if (!community || typeof community !== 'string') {
            return false;
        }

        // Community字符串长度限制
        if (community.length > 255) {
            return false;
        }

        // 不能包含特殊字符
        const invalidChars = /[<>"\s]/;
        return !invalidChars.test(community);
    }

    /**
     * 生成SNMP错误响应
     */
    static createErrorResponse(requestId, errorStatus, errorIndex) {
        return {
            requestId: requestId,
            errorStatus: errorStatus,
            errorIndex: errorIndex,
            varbinds: []
        };
    }
}

module.exports = SnmpUtils;
