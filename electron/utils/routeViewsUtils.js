const fs = require('fs');
const zlib = require('zlib');
const BgpConst = require('../const/bgpConst');
const { ipv4BufferToString, ipv6BufferToString } = require('./ipUtils');
const { parsePathAttributes } = require('./bgpPacketParser');

/**
 * Parses a local MRT file (.bz2 or .gz) and returns BGP routes.
 * @param {string} filePath - Path to the local MRT file.
 * @param {number} limit - Maximum number of routes to import.
 * @param {number} targetAfi - BGP AFI (IPv4 or IPv6).
 * @param {function} onProgress - Progress callback.
 */
async function importMrtFile(filePath, limit = 10000, targetAfi, onProgress) {
    try {
        if (!fs.existsSync(filePath)) {
            return { status: 'error', msg: `文件不存在: ${filePath}` };
        }

        if (onProgress) onProgress('正在准备解析 MRT 文件...');

        return new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(filePath);
            let decompressor;

            if (filePath.endsWith('.gz')) {
                decompressor = zlib.createGunzip();
                readStream.pipe(decompressor);
            } else {
                decompressor = readStream;
            }

            const routes = [];
            let buffer = Buffer.alloc(0);
            let count = 0;
            let lastReportedCount = 0;

            decompressor.on('data', chunk => {
                buffer = Buffer.concat([buffer, chunk]);
                try {
                    while (buffer.length >= 12) {
                        const length = buffer.readUInt32BE(8);
                        if (buffer.length < 12 + length) break;

                        const type = buffer.readUInt16BE(4);
                        const subtype = buffer.readUInt16BE(6);
                        const recordData = buffer.subarray(12, 12 + length);

                        if (type === 13) {
                            // TABLE_DUMP_V2
                            if (
                                (targetAfi === BgpConst.BGP_AFI_TYPE.AFI_IPV4 && subtype === 2) ||
                                (targetAfi === BgpConst.BGP_AFI_TYPE.AFI_IPV6 && subtype === 4)
                            ) {
                                const parsed = parseRibEntry(recordData, targetAfi);
                                for (const r of parsed) {
                                    if (count < limit) {
                                        routes.push(r);
                                        count++;
                                    }
                                }
                            }
                        } else if (type === 12) {
                            // TABLE_DUMP
                            if (
                                (targetAfi === BgpConst.BGP_AFI_TYPE.AFI_IPV4 && subtype === 1) ||
                                (targetAfi === BgpConst.BGP_AFI_TYPE.AFI_IPV6 && subtype === 2)
                            ) {
                                const parsed = parseTableDump(recordData, targetAfi);
                                if (parsed && count < limit) {
                                    routes.push(parsed);
                                    count++;
                                }
                            }
                        }

                        if (count >= limit) {
                            readStream.destroy();
                            if (decompressor.destroy) decompressor.destroy();
                            resolve({ status: 'success', data: routes });
                            return;
                        }

                        if (count - lastReportedCount >= 500) {
                            if (onProgress) onProgress(`已解析 ${count} 条路由...`);
                            lastReportedCount = count;
                        }
                        buffer = buffer.subarray(12 + length);
                    }
                } catch (e) {
                    console.error('MRT Parsing Error:', e);
                    // Continue parsing if possible
                    buffer = buffer.subarray(12);
                }
            });

            decompressor.on('end', () => {
                resolve({ status: 'success', data: routes });
            });

            readStream.on('error', reject);
            decompressor.on('error', reject);
        });
    } catch (e) {
        return { status: 'error', msg: `解析失败: ${e.message}` };
    }
}

function parseTableDump(data, afi) {
    try {
        if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4) {
            if (data.length < 22) return null;
            const prefixBuf = data.subarray(4, 8);
            const prefixLen = data[8];
            const attrLen = data.readUInt16BE(20);
            if (data.length < 22 + attrLen) return null;
            const attrBuf = data.subarray(22, 22 + attrLen);
            const prefix = ipv4BufferToString(prefixBuf, prefixLen);
            const attrs = parseBgpAttributes(attrBuf, 2); // Type 12 uses 2-byte ASNs
            return {
                ip: prefix,
                mask: prefixLen,
                ...attrs
            };
        } else if (afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6) {
            if (data.length < 46) return null;
            const prefixBuf = data.subarray(4, 20);
            const prefixLen = data[20];
            const attrLen = data.readUInt16BE(44);
            if (data.length < 46 + attrLen) return null;
            const attrBuf = data.subarray(46, 46 + attrLen);
            const prefix = ipv6BufferToString(prefixBuf, prefixLen);
            const attrs = parseBgpAttributes(attrBuf, 2); // Type 12 uses 2-byte ASNs
            return {
                ip: prefix,
                mask: prefixLen,
                ...attrs
            };
        }
    } catch (e) {
        console.error('parseTableDump Error:', e);
    }
    return null;
}

function parseRibEntry(data, afi) {
    const entries = [];
    try {
        let pos = 0;
        if (data.length < 5) return entries;
        pos += 4; // seq
        const prefixLen = data[pos];
        pos += 1;
        const prefixBytes = Math.ceil(prefixLen / 8);
        if (data.length < pos + prefixBytes + 2) return entries;
        const prefixBuf = data.subarray(pos, pos + prefixBytes);
        pos += prefixBytes;

        const prefix =
            afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4
                ? ipv4BufferToString(prefixBuf, prefixLen)
                : ipv6BufferToString(prefixBuf, prefixLen);

        const entryCount = data.readUInt16BE(pos);
        pos += 2;
        for (let i = 0; i < entryCount; i++) {
            if (pos + 8 > data.length) break;
            pos += 6; // skip peerIdx and origTime
            const attrLen = data.readUInt16BE(pos);
            pos += 2;
            if (pos + attrLen > data.length) break;
            const attrBuf = data.subarray(pos, pos + attrLen);
            pos += attrLen;
            const attrs = parseBgpAttributes(attrBuf, 4); // Type 13 usually uses 4-byte ASNs
            entries.push({
                ip: prefix,
                mask: prefixLen,
                ...attrs
            });
            break;
        }
    } catch (e) {
        console.error('parseRibEntry Error:', e);
    }
    return entries;
}

function parseBgpAttributes(buffer, asnSize = 4) {
    try {
        const { pathAttributes } = parsePathAttributes(buffer, 0, buffer.length, { asnSize });
        const attrs = {};

        const formattedParts = [];

        for (const attr of pathAttributes) {
            if (attr.typeCode === BgpConst.BGP_PATH_ATTR.AS_PATH && attr.segments) {
                const asNumbers = attr.segments.flatMap(s => s.asNumbers);
                attrs.asPath = asNumbers.join(' ');
                formattedParts.push(`AS_PATH: ${attrs.asPath}`);
            } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.NEXT_HOP) {
                attrs.nextHop = attr.nextHop;
                formattedParts.push(`NEXT_HOP: ${attr.nextHop}`);
            } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI && attr.mpReach) {
                if (attr.mpReach.nextHop) {
                    attrs.nextHop = attr.mpReach.nextHop;
                    formattedParts.push(`NEXT_HOP(MP): ${attrs.nextHop}`);
                }
            } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.MED) {
                attrs.med = attr.med;
                formattedParts.push(`MED: ${attr.med}`);
            } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.LOCAL_PREF) {
                attrs.localPref = attr.localPref;
                formattedParts.push(`LOCAL_PREF: ${attr.localPref}`);
            } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.COMMUNITY && attr.communities) {
                attrs.communities = attr.communities.map(c => c.formatted);
                formattedParts.push(`COMMUNITIES: ${attrs.communities.join(', ')}`);
            } else if (attr.typeCode === BgpConst.BGP_PATH_ATTR.ORIGIN) {
                attrs.origin = attr.origin;
                formattedParts.push(`ORIGIN: ${attr.origin}`);
            }
        }

        attrs.formatted = formattedParts.join(' | ');
        return attrs;
    } catch (e) {
        console.error('parseBgpAttributes Error:', e);
        return {};
    }
}

module.exports = {
    importMrtFile
};
