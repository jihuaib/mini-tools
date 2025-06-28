/**
 * SNMP Trap 测试脚本
 * 使用方法: node snmp_test.js [target_ip] [target_port]
 *
 * 示例:
 * node snmp_test.js 127.0.0.1 162
 *
 * 此脚本将发送模拟的SNMP v2c Trap到指定的目标地址
 */

const dgram = require('dgram');
const crypto = require('crypto');

// 默认参数
const DEFAULT_TARGET_IP = '127.0.0.1';
const DEFAULT_TARGET_PORT = 162;
const COMMUNITY = 'public';

// 从命令行参数获取目标IP和端口
const targetIp = process.argv[2] || DEFAULT_TARGET_IP;
const targetPort = parseInt(process.argv[3]) || DEFAULT_TARGET_PORT;

console.log(`SNMP Trap 测试脚本`);
console.log(`目标地址: ${targetIp}:${targetPort}`);
console.log(`Community: ${COMMUNITY}`);
console.log('-----------------------------------');

/**
 * 创建简单的ASN.1 BER编码
 */
class SimpleAsn1 {
    static encodeInteger(value) {
        const buffer = Buffer.alloc(6);
        buffer[0] = 0x02; // INTEGER tag
        buffer[1] = 0x04; // length
        buffer.writeInt32BE(value, 2);
        return buffer;
    }

    static encodeOctetString(str) {
        const strBuffer = Buffer.from(str, 'utf8');
        const buffer = Buffer.alloc(2 + strBuffer.length);
        buffer[0] = 0x04; // OCTET STRING tag
        buffer[1] = strBuffer.length; // length
        strBuffer.copy(buffer, 2);
        return buffer;
    }

    static encodeOid(oidStr) {
        const parts = oidStr.split('.').map(Number);
        if (parts.length < 2) {
            throw new Error('OID must have at least 2 components');
        }

        const oidBytes = [];

        // 第一个字节编码前两个子标识符
        // 第一个子标识符 * 40 + 第二个子标识符
        const firstByte = parts[0] * 40 + parts[1];
        oidBytes.push(firstByte);

        // 编码剩余的子标识符
        for (let i = 2; i < parts.length; i++) {
            const value = parts[i];
            if (value < 128) {
                // 单字节编码
                oidBytes.push(value);
            } else {
                // 多字节变长编码
                const bytes = this.encodeSubidentifier(value);
                oidBytes.push(...bytes);
            }
        }

        // 创建完整的OID缓冲区
        const buffer = Buffer.alloc(2 + oidBytes.length);
        buffer[0] = 0x06; // OBJECT IDENTIFIER tag
        buffer[1] = oidBytes.length; // length

        for (let i = 0; i < oidBytes.length; i++) {
            buffer[2 + i] = oidBytes[i];
        }

        return buffer;
    }

    // 辅助方法：编码大于127的子标识符
    static encodeSubidentifier(value) {
        if (value < 128) {
            return [value];
        }

        const bytes = [];
        let temp = value;

        // 从最低位开始编码
        bytes.unshift(temp & 0x7f);
        temp = temp >>> 7;

        while (temp > 0) {
            bytes.unshift((temp & 0x7f) | 0x80);
            temp = temp >>> 7;
        }

        return bytes;
    }

    static encodeTimeTicks(value) {
        const buffer = Buffer.alloc(6);
        buffer[0] = 0x43; // TimeTicks tag
        buffer[1] = 0x04; // length
        buffer.writeUInt32BE(value, 2);
        return buffer;
    }

    static encodeSequence(contents) {
        const totalLength = contents.reduce((sum, item) => sum + item.length, 0);
        const buffer = Buffer.alloc(2 + totalLength);
        buffer[0] = 0x30; // SEQUENCE tag
        buffer[1] = totalLength; // length

        let offset = 2;
        for (const content of contents) {
            content.copy(buffer, offset);
            offset += content.length;
        }

        return buffer;
    }
}

/**
 * 创建SNMP v2c Trap消息
 */
function createSnmpV2cTrap() {
    // SNMP版本 (v2c = 1)
    const version = SimpleAsn1.encodeInteger(1);

    // Community字符串
    const community = SimpleAsn1.encodeOctetString(COMMUNITY);

    // 请求ID
    const requestId = SimpleAsn1.encodeInteger(Math.floor(Math.random() * 1000000));

    // 错误状态
    const errorStatus = SimpleAsn1.encodeInteger(0);

    // 错误索引
    const errorIndex = SimpleAsn1.encodeInteger(0);

    // 变量绑定列表
    const varbinds = [
        // sysUpTime
        SimpleAsn1.encodeSequence([SimpleAsn1.encodeOid('1.3.6.1.2.1.1.3.0'), SimpleAsn1.encodeTimeTicks(12345)]),
        // snmpTrapOID
        SimpleAsn1.encodeSequence([
            SimpleAsn1.encodeOid('1.3.6.1.6.3.1.1.4.1.0'),
            SimpleAsn1.encodeOid('1.3.6.1.4.1.9999.1.1.1')
        ]),
        // 自定义变量绑定
        SimpleAsn1.encodeSequence([
            SimpleAsn1.encodeOid('1.3.6.1.4.1.9999.1.1.2'),
            SimpleAsn1.encodeOctetString('Test Trap Message')
        ])
    ];

    const varbindList = SimpleAsn1.encodeSequence(varbinds);

    // SNMPv2-Trap PDU (tag = 0xa7)
    const pduContents = [requestId, errorStatus, errorIndex, varbindList];
    const pduData = SimpleAsn1.encodeSequence(pduContents);
    const trapPdu = Buffer.alloc(2 + pduData.length);
    trapPdu[0] = 0xa7; // SNMPv2-Trap tag
    trapPdu[1] = pduData.length;
    pduData.copy(trapPdu, 2);

    // 完整的SNMP消息
    const snmpMessage = SimpleAsn1.encodeSequence([version, community, trapPdu]);

    return snmpMessage;
}

/**
 * 创建SNMP v1 Trap消息
 */
function createSnmpV1Trap() {
    // SNMP版本 (v1 = 0)
    const version = SimpleAsn1.encodeInteger(0);

    // Community字符串
    const community = SimpleAsn1.encodeOctetString(COMMUNITY);

    // 企业OID
    const enterprise = SimpleAsn1.encodeOid('1.3.6.1.4.1.9999');

    // 代理地址 (IP地址)
    const agentAddr = Buffer.from([0x40, 0x04, 0x7f, 0x00, 0x00, 0x01]); // 127.0.0.1

    // 通用Trap类型
    const genericTrap = SimpleAsn1.encodeInteger(6); // enterpriseSpecific

    // 特定Trap类型
    const specificTrap = SimpleAsn1.encodeInteger(1);

    // 时间戳
    const timeStamp = SimpleAsn1.encodeTimeTicks(12345);

    // 变量绑定列表
    const varbind = SimpleAsn1.encodeSequence([
        SimpleAsn1.encodeOid('1.3.6.1.4.1.9999.1.1.1'),
        SimpleAsn1.encodeOctetString('Test SNMPv1 Trap')
    ]);
    const varbindList = SimpleAsn1.encodeSequence([varbind]);

    // Trap PDU (tag = 0xa4)
    const pduContents = [enterprise, agentAddr, genericTrap, specificTrap, timeStamp, varbindList];
    const pduData = SimpleAsn1.encodeSequence(pduContents);
    const trapPdu = Buffer.alloc(2 + pduData.length);
    trapPdu[0] = 0xa4; // Trap tag
    trapPdu[1] = pduData.length;
    pduData.copy(trapPdu, 2);

    // 完整的SNMP消息
    const snmpMessage = SimpleAsn1.encodeSequence([version, community, trapPdu]);

    return snmpMessage;
}

/**
 * 发送SNMP Trap
 */
function sendTrap(message, version) {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');

        client.send(message, targetPort, targetIp, err => {
            if (err) {
                console.error(`发送${version} Trap失败:`, err.message);
                reject(err);
            } else {
                console.log(`✓ 发送${version} Trap成功 (${message.length} 字节)`);
                resolve();
            }
            client.close();
        });

        // 超时处理
        setTimeout(() => {
            client.close();
            reject(new Error('发送超时'));
        }, 5000);
    });
}

/**
 * 主函数
 */
async function main() {
    try {
        console.log('开始发送测试Trap...\n');

        // 发送SNMPv1 Trap
        console.log('1. 发送SNMPv1 Trap');
        const v1Trap = createSnmpV1Trap();
        await sendTrap(v1Trap, 'SNMPv1');

        // 等待1秒
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 发送SNMPv2c Trap
        console.log('\n2. 发送SNMPv2c Trap');
        const v2cTrap = createSnmpV2cTrap();
        await sendTrap(v2cTrap, 'SNMPv2c');

        console.log('\n-----------------------------------');
        console.log('✓ 所有测试Trap发送完成');
        console.log('请检查MiniTools的SNMP Trap监控页面');
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        process.exit(1);
    }
}

// 运行测试
main();
