const { app } = require('electron');
const path = require('path');
const crypto = require('crypto');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const WorkerWithPromise = require('../worker/workerWithPromise');
const { DEFAULT_TOOLS_SETTINGS } = require('../const/toolsConst');

class ToolsApp {
    constructor(ipc, store) {
        this.isDev = !app.isPackaged;
        this.stringGeneratorConfigFileKey = 'string-generator';
        this.packetParserConfigFileKey = 'packet-parser';
        this.tcpAoMacStateKey = 'tcp-ao-mac';
        this.registerHandlers(ipc);
        this.store = store;

        this.maxMessageHistory = DEFAULT_TOOLS_SETTINGS.packetParser.maxMessageHistory;
        this.maxStringHistory = DEFAULT_TOOLS_SETTINGS.stringGenerator.maxStringHistory;
    }

    registerHandlers(ipc) {
        // 字符串生成器
        ipc.handle('tools:generateString', async (event, templateData) =>
            this.handleGenerateString(event, templateData)
        );
        ipc.handle('tools:getGenerateStringHistory', async () => this.handleGetGenerateStringHistory());
        ipc.handle('tools:clearGenerateStringHistory', async () => this.handleClearGenerateStringHistory());

        // 报文解析器
        ipc.handle('tools:parsePacket', async (event, packetData) => this.handleParsePacket(event, packetData));
        ipc.handle('tools:parsePacketNoSaveHistory', async (event, packetData) =>
            this.handleParsePacketNoSaveHistory(event, packetData)
        );
        ipc.handle('tools:getPacketParserHistory', async () => this.handleGetPacketParserHistory());
        ipc.handle('tools:clearPacketParserHistory', async () => this.handleClearPacketParserHistory());

        // TCP-AO MAC 计算器
        ipc.handle('tools:calculateTcpAoMac', async (event, data) => this.handleCalculateTcpAoMac(event, data));
        ipc.handle('tools:findTcpAoMacVariant', async (event, data) => this.handleFindTcpAoMacVariant(event, data));
        ipc.handle('tools:saveTcpAoMacState', async (_event, state) => this.handleSaveTcpAoMacState(state));
        ipc.handle('tools:getTcpAoMacState', async () => this.handleGetTcpAoMacState());
    }

    async handleGetGenerateStringHistory() {
        const config = this.store.get(this.stringGeneratorConfigFileKey);
        if (!config) {
            return successResponse([], '获取字符串生成历史记录成功');
        }
        return successResponse(config, '获取字符串生成历史记录成功');
    }

    async handleClearGenerateStringHistory() {
        this.store.set(this.stringGeneratorConfigFileKey, []);
        return successResponse(null, '清空字符串生成历史记录成功');
    }

    async handleGenerateString(event, templateData) {
        logger.info(`${JSON.stringify(templateData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/StringGeneratorWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/StringGeneratorWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), templateData);

            this.saveGenerateStringToHistory(templateData);

            logger.info('Worker处理结果:', result);
            return successResponse(result, 'Worker处理成功');
        } catch (err) {
            logger.error('Worker处理错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async saveGenerateStringToHistory(result) {
        let config = this.store.get(this.stringGeneratorConfigFileKey);
        if (!config) {
            config = [];
        }

        let isExist = false;
        config.forEach(element => {
            if (
                element.template === result.template &&
                element.placeholder === result.placeholder &&
                element.start === result.start &&
                element.end === result.end
            ) {
                isExist = true;
            }
        });

        if (isExist) {
            return;
        }

        if (config.length >= this.maxStringHistory) {
            config.splice(0, 1);
        }

        config.push(result);
        this.store.set(this.stringGeneratorConfigFileKey, config);
    }

    async saveToHistory(data) {
        let config = this.store.get(this.packetParserConfigFileKey);
        if (!config) {
            config = [];
        }

        let isExist = false;
        config.forEach(element => {
            if (
                element.packetData === data.packetData &&
                element.protocolPort === data.protocolPort &&
                element.protocolType === data.protocolType &&
                element.startLayer === data.startLayer
            ) {
                isExist = true;
            }
        });

        if (isExist) {
            return;
        }

        if (config.length >= this.maxMessageHistory) {
            config.splice(0, 1);
        }

        config.push(data);
        this.store.set(this.packetParserConfigFileKey, config);
    }

    async handleParsePacket(event, packetData) {
        logger.info(`解析报文: ${JSON.stringify(packetData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/packetParserWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/packetParserWorker.js');

            // 保存到历史记录
            this.saveToHistory(packetData);

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), packetData);

            logger.info('报文解析结果:', result);
            return successResponse(result, '报文解析成功');
        } catch (err) {
            logger.error('报文解析错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async handleParsePacketNoSaveHistory(event, packetData) {
        logger.info(`解析报文: ${JSON.stringify(packetData)}`);

        try {
            const workerPath = this.isDev
                ? path.join(__dirname, '../worker/packetParserWorker.js')
                : path.join(process.resourcesPath, 'app', 'electron/worker/packetParserWorker.js');

            const workerFactory = new WorkerWithPromise(workerPath);
            const result = await workerFactory.runWorkerWithPromise(path.join(workerPath), packetData);

            logger.info('报文解析结果:', result);
            return successResponse(result, '报文解析成功');
        } catch (err) {
            logger.error('报文解析错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async handleClearPacketParserHistory() {
        this.store.set(this.packetParserConfigFileKey, []);
        return successResponse(null, '清空报文解析历史记录成功');
    }

    async handleGetPacketParserHistory() {
        const config = this.store.get(this.packetParserConfigFileKey);
        if (!config) {
            return successResponse([], '获取报文解析历史记录成功');
        }

        return successResponse(config, '获取报文解析历史记录成功');
    }

    hexToBuffer(hex) {
        const cleaned = hex.replace(/\s+/g, '').replace(/:/g, '');
        if (cleaned.length === 0) return Buffer.alloc(0);
        if (cleaned.length % 2 !== 0) throw new Error(`十六进制字符串长度不合法: "${hex}"`);
        if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error(`十六进制字符串包含非法字符: "${hex}"`);
        return Buffer.from(cleaned, 'hex');
    }

    parseIpv4Packet(buf) {
        if (buf.length < 20) throw new Error('IP 报文长度不足（最少 20 字节）');
        const version = buf[0] >> 4;
        if (version !== 4) throw new Error(`仅支持 IPv4，当前版本号: ${version}`);

        const ihl = (buf[0] & 0x0f) * 4;
        if (ihl < 20) throw new Error(`IP 头部长度非法: ${ihl}`);

        const totalLength = buf.readUInt16BE(2);
        if (buf.length < totalLength)
            throw new Error(`报文实际长度 ${buf.length} 小于 Total Length 字段 ${totalLength}`);

        const protocol = buf[9];
        const srcIp = buf.subarray(12, 16);
        const dstIp = buf.subarray(16, 20);

        const tcpLength = totalLength - ihl;
        if (tcpLength < 20) throw new Error(`TCP 段长度不足（最少 20 字节）: ${tcpLength}`);

        // rawTcpSegment：保留原始校验和；tcpSegment：校验和清零（RFC 5925 §5.1）
        const rawTcpSegment = Buffer.from(buf.subarray(ihl, totalLength));
        const tcpSegment = Buffer.from(rawTcpSegment);
        tcpSegment[16] = 0;
        tcpSegment[17] = 0;

        // IPv4 伪头部：源IP(4) + 目的IP(4) + 00(1) + 协议(1) + TCP段长度(2)
        const pseudoHeader = Buffer.alloc(12);
        srcIp.copy(pseudoHeader, 0);
        dstIp.copy(pseudoHeader, 4);
        pseudoHeader[8] = 0;
        pseudoHeader[9] = protocol;
        pseudoHeader.writeUInt16BE(tcpLength, 10);

        return { pseudoHeader, tcpSegment, rawTcpSegment };
    }

    zeroNonTcpAoOptions(tcpSegment) {
        const dataOffset = (tcpSegment[12] >> 4) * 4;
        if (dataOffset <= 20 || dataOffset > tcpSegment.length) return tcpSegment;
        const result = Buffer.from(tcpSegment);
        let i = 20;
        while (i < dataOffset) {
            const kind = result[i];
            if (kind === 0) break;
            if (kind === 1) {
                result[i] = 0;
                i++;
                continue;
            }
            if (i + 1 >= dataOffset) break;
            const len = result[i + 1];
            if (len < 2 || i + len > dataOffset) break;
            if (kind !== 29) {
                result.fill(0, i, i + len);
            }
            i += len;
        }
        return result;
    }

    // RFC 4615: 将任意长度的 master key 规范化为 16 字节 AES 密钥
    normalizeAesKey(keyBuf) {
        if (keyBuf.length === 16) return keyBuf;
        return this.computeAesCmac(Buffer.alloc(16, 0), keyBuf);
    }

    // RFC 4493: AES-128-CMAC
    computeAesCmac(key, msg) {
        const Rb = Buffer.from('00000000000000000000000000000087', 'hex');
        const aesBlock = data => {
            const c = crypto.createCipheriv('aes-128-ecb', key, null);
            c.setAutoPadding(false);
            return Buffer.concat([c.update(data), c.final()]);
        };
        const shiftLeft = buf => {
            const out = Buffer.allocUnsafe(16);
            for (let i = 0; i < 15; i++) out[i] = ((buf[i] << 1) | (buf[i + 1] >> 7)) & 0xff;
            out[15] = (buf[15] << 1) & 0xff;
            return out;
        };
        const xor16 = (a, b) => {
            const r = Buffer.allocUnsafe(16);
            for (let i = 0; i < 16; i++) r[i] = a[i] ^ b[i];
            return r;
        };
        const L = aesBlock(Buffer.alloc(16, 0));
        const K1 = shiftLeft(L);
        if (L[0] & 0x80) for (let i = 0; i < 16; i++) K1[i] ^= Rb[i];
        const K2 = shiftLeft(K1);
        if (K1[0] & 0x80) for (let i = 0; i < 16; i++) K2[i] ^= Rb[i];

        const n = Math.max(1, Math.ceil(msg.length / 16));
        const complete = msg.length > 0 && msg.length % 16 === 0;
        let last = Buffer.alloc(16, 0);
        if (complete) {
            msg.copy(last, 0, (n - 1) * 16);
            last = xor16(last, K1);
        } else {
            const rem = msg.length % 16;
            msg.copy(last, 0, msg.length - rem);
            last[rem] = 0x80;
            last = xor16(last, K2);
        }
        let X = Buffer.alloc(16, 0);
        for (let i = 0; i < n - 1; i++) {
            X = aesBlock(xor16(X, msg.subarray(i * 16, (i + 1) * 16)));
        }
        return aesBlock(xor16(X, last));
    }

    zeroTcpAoMacField(tcpSegment, fullOption = false) {
        const result = Buffer.from(tcpSegment);
        const dataOffset = (result[12] >> 4) * 4;
        let i = 20;
        while (i < dataOffset) {
            const kind = result[i];
            if (kind === 0) break;
            if (kind === 1) {
                i++;
                continue;
            }
            if (i + 1 >= dataOffset) break;
            const len = result[i + 1];
            if (len < 2 || i + len > dataOffset) break;
            if (kind === 29 && len >= 4) {
                // fullOption=true: 整个 AO option 清零（含 kind/len/keyid/rnextkeyid）
                // fullOption=false: 仅清零 MAC 字段（跳过前 4 字节）
                const start = fullOption ? i : i + 4;
                result.fill(0, start, i + len);
            }
            i += len;
        }
        return result;
    }

    deriveTrafficKey(masterKeyBuf, srcIp, dstIp, srcPort, dstPort, isnA, isnB, hashAlgo) {
        // RFC 5926 §3.1 KDF_HMAC_MD5 / §3.2 KDF_HMAC_SHA1
        // T1 = HMAC-<algo>(Master_Key, "TCP-AO" \x00 Context Length(2) \x01)
        // Context = SrcIP(4) || DstIP(4) || SrcPort(2) || DstPort(2) || ISN_A(4) || ISN_B(4)
        // RFC 5926 §3.1 PRF+ 构造：T1 = PRF(Master_Key, 0x01 || Label || 0x00 || Context || Length)
        // Context = SrcIP(4) || DstIP(4) || SrcPort(2) || DstPort(2) || ISN_A(4) || ISN_B(4)
        const label = Buffer.from('TCP-AO', 'ascii');
        const context = Buffer.alloc(20);
        srcIp.copy(context, 0);
        dstIp.copy(context, 4);
        context.writeUInt16BE(srcPort, 8);
        context.writeUInt16BE(dstPort, 10);
        context.writeUInt32BE(isnA, 12);
        context.writeUInt32BE(isnB, 16);
        // RFC 5926: Output_Length in bits — sha1=160, md5/aes-cmac=128, sha256=256
        const lengthBitsMap = { sha1: 0x00a0, md5: 0x0080, sha256: 0x0100, 'aes-cmac': 0x0080 };
        const length = Buffer.alloc(2);
        length.writeUInt16BE(lengthBitsMap[hashAlgo] || 0x0080, 0);
        // RFC 5926 §3.1.1: i || Label || Context || Output_Length（无分隔符）
        const kdfInput = Buffer.concat([Buffer.from([0x01]), label, context, length]);
        if (hashAlgo === 'aes-cmac') {
            return this.computeAesCmac(this.normalizeAesKey(masterKeyBuf), kdfInput);
        }
        const prfMap = { sha1: 'sha1', md5: 'md5', sha256: 'sha256' };
        return crypto
            .createHmac(prfMap[hashAlgo] || 'sha1', masterKeyBuf)
            .update(kdfInput)
            .digest();
    }

    async handleCalculateTcpAoMac(
        _event,
        { key, sne, ipPacket, includeOtherOptions, algorithm, skipKdf, keyPos, zeroFullAoOption, includePseudoHeader }
    ) {
        try {
            const keyBuf = Buffer.from(key, 'utf8');
            const sneBuf = sne && sne.trim() ? this.hexToBuffer(sne) : Buffer.alloc(0);
            const ipBuf = this.hexToBuffer(ipPacket);

            const { pseudoHeader, tcpSegment: rawTcpSegment } = this.parseIpv4Packet(ipBuf);
            let tcpSegment = includeOtherOptions ? rawTcpSegment : this.zeroNonTcpAoOptions(rawTcpSegment);
            tcpSegment = this.zeroTcpAoMacField(tcpSegment, !!zeroFullAoOption);

            const pseudoPart = includePseudoHeader ? pseudoHeader : Buffer.alloc(0);
            const msgBuf = Buffer.concat([sneBuf, pseudoPart, tcpSegment]);
            let macFull,
                trafficKeyHex = null;

            // 各算法标准 MAC 截断长度（字节）
            const macLenMap = {
                'hmac-sha1': 12,
                'hmac-sha1-20': 20,
                'hmac-md5': 12,
                'hmac-sha256': 12,
                'aes-cmac': 12,
                md5: 16,
                sha1: 20,
                sha256: 32,
                sm3: 32
            };
            const macLen = macLenMap[algorithm] || 12;

            const PLAIN_ALGOS = ['md5', 'sha1', 'sha256', 'sm3'];
            if (PLAIN_ALGOS.includes(algorithm)) {
                // 纯哈希：hash(key? || msg || key?)
                const hash = crypto.createHash(algorithm);
                if (keyPos === 'start' || keyPos === 'both') hash.update(keyBuf);
                hash.update(msgBuf);
                if (keyPos !== 'start') hash.update(keyBuf);
                macFull = hash.digest();
            } else {
                // HMAC / AES-128-CMAC
                const kdfAlgoMap = {
                    'hmac-sha1': 'sha1',
                    'hmac-sha1-20': 'sha1',
                    'hmac-md5': 'md5',
                    'hmac-sha256': 'sha256',
                    'aes-cmac': 'aes-cmac'
                };
                let hmacKey;
                if (skipKdf) {
                    hmacKey = keyBuf;
                } else {
                    const srcIp = ipBuf.subarray(12, 16);
                    const dstIp = ipBuf.subarray(16, 20);
                    const srcPort = rawTcpSegment.readUInt16BE(0);
                    const dstPort = rawTcpSegment.readUInt16BE(2);
                    const isnA = rawTcpSegment.readUInt32BE(4);
                    const isnB = rawTcpSegment.readUInt32BE(8);
                    hmacKey = this.deriveTrafficKey(
                        keyBuf,
                        srcIp,
                        dstIp,
                        srcPort,
                        dstPort,
                        isnA,
                        isnB,
                        kdfAlgoMap[algorithm]
                    );
                    trafficKeyHex = hmacKey.toString('hex').toUpperCase();
                }
                if (algorithm === 'aes-cmac') {
                    macFull = this.computeAesCmac(this.normalizeAesKey(hmacKey), msgBuf);
                } else {
                    const nodeAlgo = {
                        'hmac-sha1': 'sha1',
                        'hmac-sha1-20': 'sha1',
                        'hmac-md5': 'md5',
                        'hmac-sha256': 'sha256'
                    }[algorithm];
                    macFull = crypto.createHmac(nodeAlgo, hmacKey).update(msgBuf).digest();
                }
            }

            const mac96 = macFull.subarray(0, macLen).toString('hex').toUpperCase();
            return successResponse(
                {
                    pseudoHeaderHex: pseudoHeader.toString('hex').toUpperCase(),
                    messageHex: msgBuf.toString('hex').toUpperCase(),
                    trafficKeyHex,
                    mac: macFull.toString('hex').toUpperCase(),
                    mac96,
                    macLen
                },
                'TCP-AO MAC 计算成功'
            );
        } catch (err) {
            logger.error('TCP-AO MAC 计算错误:', err.message);
            return errorResponse(err.message);
        }
    }

    computeOneMac(keyBuf, sneBuf, pseudoHeader, tcpSegment, algorithm, keyPos) {
        if (algorithm === 'hmac-md5' || algorithm === 'hmac-sha1') {
            const hashAlgo = algorithm === 'hmac-sha1' ? 'sha1' : 'md5';
            const msgBuf = Buffer.concat([sneBuf, pseudoHeader, tcpSegment]);
            return { mac: crypto.createHmac(hashAlgo, keyBuf).update(msgBuf).digest(), msgBuf };
        }
        // plain MD5
        const msgBuf = Buffer.concat([sneBuf, pseudoHeader, tcpSegment]);
        const hash = crypto.createHash('md5');
        if (keyPos === 'start' || keyPos === 'both') hash.update(keyBuf);
        hash.update(msgBuf);
        if (keyPos !== 'start') hash.update(keyBuf);
        return { mac: hash.digest(), msgBuf };
    }

    async handleFindTcpAoMacVariant(_event, { key, ipPacket, knownMac96 }) {
        try {
            const keyBuf = Buffer.from(key, 'utf8');
            const ipBuf = this.hexToBuffer(ipPacket);
            const target = this.hexToBuffer(knownMac96);

            const { pseudoHeader, tcpSegment: tcpChecksumZeroed, rawTcpSegment } = this.parseIpv4Packet(ipBuf);

            const srcIp = ipBuf.subarray(12, 16);
            const dstIp = ipBuf.subarray(16, 20);
            const srcPort = rawTcpSegment.readUInt16BE(0);
            const dstPort = rawTcpSegment.readUInt16BE(2);
            const isnA = rawTcpSegment.readUInt32BE(4);
            const isnB = rawTcpSegment.readUInt32BE(8);

            // 派生各算法 Traffic Key
            const tkMd5 = this.deriveTrafficKey(keyBuf, srcIp, dstIp, srcPort, dstPort, isnA, isnB, 'md5');
            const tkSha1 = this.deriveTrafficKey(keyBuf, srcIp, dstIp, srcPort, dstPort, isnA, isnB, 'sha1');
            const tkSha256 = this.deriveTrafficKey(keyBuf, srcIp, dstIp, srcPort, dstPort, isnA, isnB, 'sha256');
            const tkCmac = this.deriveTrafficKey(keyBuf, srcIp, dstIp, srcPort, dstPort, isnA, isnB, 'aes-cmac');

            const matches = [];

            const sneVariants = [
                { label: '无SNE', buf: Buffer.alloc(0) },
                { label: 'SNE=0', buf: Buffer.alloc(4) }
            ];
            const pseudoVariants = [
                { label: '含伪头部', buf: pseudoHeader },
                { label: '无伪头部', buf: Buffer.alloc(0) }
            ];
            const checksumVariants = [
                { label: '校验和清零', tcp: tcpChecksumZeroed },
                { label: '校验和原值', tcp: rawTcpSegment }
            ];
            const zeroVariants = [
                { label: 'MAC字段清零', full: false },
                { label: 'AO整体清零', full: true }
            ];
            const optionVariants = [
                { label: '含其他选项', includeOther: true },
                { label: '其他选项清零', includeOther: false }
            ];

            // 算法变体：plain 类用 keyPos，HMAC/CMAC 类用 hmacKey
            const plainAlgos = ['md5', 'sha1', 'sha256'];
            try {
                crypto.createHash('sm3').digest();
                plainAlgos.push('sm3');
            } catch (_) {
                /* SM3 not available */
            }

            const algoVariants = [
                ...plainAlgos.flatMap(a => {
                    const macLen = a === 'md5' ? 16 : a === 'sha1' ? 20 : 32;
                    return [
                        { label: `${a.toUpperCase()} key尾`, type: 'plain', algo: a, keyPos: 'end', macLen },
                        { label: `${a.toUpperCase()} key首`, type: 'plain', algo: a, keyPos: 'start', macLen },
                        { label: `${a.toUpperCase()} key首尾`, type: 'plain', algo: a, keyPos: 'both', macLen }
                    ];
                }),
                { label: 'HMAC-MD5 无KDF', type: 'hmac', algo: 'md5', hmacKey: keyBuf, macLen: 12 },
                { label: 'HMAC-MD5 KDF', type: 'hmac', algo: 'md5', hmacKey: tkMd5, macLen: 12 },
                { label: 'HMAC-SHA1-12 无KDF', type: 'hmac', algo: 'sha1', hmacKey: keyBuf, macLen: 12 },
                { label: 'HMAC-SHA1-12 KDF', type: 'hmac', algo: 'sha1', hmacKey: tkSha1, macLen: 12 },
                { label: 'HMAC-SHA1-20 无KDF', type: 'hmac', algo: 'sha1', hmacKey: keyBuf, macLen: 20 },
                { label: 'HMAC-SHA1-20 KDF', type: 'hmac', algo: 'sha1', hmacKey: tkSha1, macLen: 20 },
                { label: 'HMAC-SHA256 无KDF', type: 'hmac', algo: 'sha256', hmacKey: keyBuf, macLen: 12 },
                { label: 'HMAC-SHA256 KDF', type: 'hmac', algo: 'sha256', hmacKey: tkSha256, macLen: 12 },
                { label: 'AES-128-CMAC 无KDF', type: 'cmac', hmacKey: this.normalizeAesKey(keyBuf), macLen: 12 },
                { label: 'AES-128-CMAC KDF', type: 'cmac', hmacKey: this.normalizeAesKey(tkCmac), macLen: 12 }
            ];

            for (const sneV of sneVariants) {
                for (const pseudoV of pseudoVariants) {
                    for (const csV of checksumVariants) {
                        for (const zeroV of zeroVariants) {
                            for (const optV of optionVariants) {
                                let tcp = optV.includeOther ? csV.tcp : this.zeroNonTcpAoOptions(csV.tcp);
                                tcp = this.zeroTcpAoMacField(tcp, zeroV.full);
                                const msgBuf = Buffer.concat([sneV.buf, pseudoV.buf, tcp]);

                                for (const algoV of algoVariants) {
                                    let mac;
                                    if (algoV.type === 'plain') {
                                        const h = crypto.createHash(algoV.algo);
                                        if (algoV.keyPos === 'start' || algoV.keyPos === 'both') h.update(keyBuf);
                                        h.update(msgBuf);
                                        if (algoV.keyPos !== 'start') h.update(keyBuf);
                                        mac = h.digest();
                                    } else if (algoV.type === 'cmac') {
                                        mac = this.computeAesCmac(algoV.hmacKey, msgBuf);
                                    } else {
                                        mac = crypto.createHmac(algoV.algo, algoV.hmacKey).update(msgBuf).digest();
                                    }

                                    const cmpLen = Math.min(algoV.macLen || mac.length, target.length);
                                    if (mac.subarray(0, cmpLen).equals(target.subarray(0, cmpLen))) {
                                        matches.push({
                                            algo: algoV.label,
                                            sne: sneV.label,
                                            pseudo: pseudoV.label,
                                            checksum: csV.label,
                                            zero: zeroV.label,
                                            options: optV.label,
                                            messageHex: msgBuf.toString('hex').toUpperCase(),
                                            mac: mac.toString('hex').toUpperCase()
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return successResponse(
                { matches },
                matches.length > 0 ? `找到 ${matches.length} 个匹配` : '未找到匹配组合'
            );
        } catch (err) {
            logger.error('TCP-AO 反推错误:', err.message);
            return errorResponse(err.message);
        }
    }

    handleSaveTcpAoMacState(state) {
        this.store.set(this.tcpAoMacStateKey, state);
        return successResponse(null, '保存成功');
    }

    handleGetTcpAoMacState() {
        const state = this.store.get(this.tcpAoMacStateKey);
        return successResponse(state || null, '获取成功');
    }

    setMaxMessageHistory(maxMessageHistory) {
        this.maxMessageHistory = maxMessageHistory;
    }

    setMaxStringHistory(maxStringHistory) {
        this.maxStringHistory = maxStringHistory;
    }
}

module.exports = ToolsApp;
