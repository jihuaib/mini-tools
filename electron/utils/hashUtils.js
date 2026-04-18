const crypto = require('crypto');

function rotateLeft32(value, bits) {
    const shift = bits & 31;
    if (shift === 0) return value >>> 0;
    return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function p0(x) {
    return (x ^ rotateLeft32(x, 9) ^ rotateLeft32(x, 17)) >>> 0;
}

function p1(x) {
    return (x ^ rotateLeft32(x, 15) ^ rotateLeft32(x, 23)) >>> 0;
}

function ff(x, y, z, round) {
    if (round < 16) return (x ^ y ^ z) >>> 0;
    return ((x & y) | (x & z) | (y & z)) >>> 0;
}

function gg(x, y, z, round) {
    if (round < 16) return (x ^ y ^ z) >>> 0;
    return ((x & y) | (~x & z)) >>> 0;
}

function add32(...values) {
    let sum = 0;
    for (const value of values) {
        sum = (sum + value) >>> 0;
    }
    return sum >>> 0;
}

function toBuffer(data, encoding) {
    if (Buffer.isBuffer(data)) return data;
    if (typeof data === 'string') return Buffer.from(data, encoding);
    if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    return Buffer.from(data);
}

const SM3_IV = [0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e];

const SM3_T = Array.from({ length: 64 }, (_value, round) => rotateLeft32(round < 16 ? 0x79cc4519 : 0x7a879d8a, round));

function sm3Digest(message) {
    const msg = toBuffer(message);
    const bitLength = BigInt(msg.length) * 8n;
    const paddingLength = (64 - ((msg.length + 1 + 8) % 64)) % 64;
    const padded = Buffer.alloc(msg.length + 1 + paddingLength + 8);
    msg.copy(padded, 0);
    padded[msg.length] = 0x80;
    padded.writeUInt32BE(Number((bitLength >> 32n) & 0xffffffffn), padded.length - 8);
    padded.writeUInt32BE(Number(bitLength & 0xffffffffn), padded.length - 4);

    const state = SM3_IV.slice();
    const w = new Uint32Array(68);
    const w1 = new Uint32Array(64);

    for (let offset = 0; offset < padded.length; offset += 64) {
        for (let i = 0; i < 16; i++) {
            w[i] = padded.readUInt32BE(offset + i * 4) >>> 0;
        }
        for (let i = 16; i < 68; i++) {
            w[i] =
                (p1(w[i - 16] ^ w[i - 9] ^ rotateLeft32(w[i - 3], 15)) ^ rotateLeft32(w[i - 13], 7) ^ w[i - 6]) >>> 0;
        }
        for (let i = 0; i < 64; i++) {
            w1[i] = (w[i] ^ w[i + 4]) >>> 0;
        }

        let [a, b, c, d, e, f, g, h] = state;
        for (let round = 0; round < 64; round++) {
            const a12 = rotateLeft32(a, 12);
            const ss1 = rotateLeft32(add32(a12, e, SM3_T[round]), 7);
            const ss2 = (ss1 ^ a12) >>> 0;
            const tt1 = add32(ff(a, b, c, round), d, ss2, w1[round]);
            const tt2 = add32(gg(e, f, g, round), h, ss1, w[round]);

            d = c;
            c = rotateLeft32(b, 9);
            b = a;
            a = tt1;
            h = g;
            g = rotateLeft32(f, 19);
            f = e;
            e = p0(tt2);
        }

        state[0] = (state[0] ^ a) >>> 0;
        state[1] = (state[1] ^ b) >>> 0;
        state[2] = (state[2] ^ c) >>> 0;
        state[3] = (state[3] ^ d) >>> 0;
        state[4] = (state[4] ^ e) >>> 0;
        state[5] = (state[5] ^ f) >>> 0;
        state[6] = (state[6] ^ g) >>> 0;
        state[7] = (state[7] ^ h) >>> 0;
    }

    const output = Buffer.allocUnsafe(32);
    for (let i = 0; i < state.length; i++) {
        output.writeUInt32BE(state[i] >>> 0, i * 4);
    }
    return output;
}

class Sm3Hash {
    constructor() {
        this.chunks = [];
        this.result = null;
    }

    update(data, encoding) {
        if (this.result) {
            throw new Error('Digest already called');
        }
        this.chunks.push(toBuffer(data, encoding));
        return this;
    }

    digest(encoding) {
        if (!this.result) {
            this.result = sm3Digest(Buffer.concat(this.chunks));
            this.chunks = [];
        }
        return encoding ? this.result.toString(encoding) : Buffer.from(this.result);
    }
}

function isHashSupported(algorithm) {
    const target = String(algorithm).toLowerCase();
    return crypto.getHashes().some(name => name.toLowerCase() === target);
}

function isHmacSupported(algorithm) {
    try {
        crypto.createHmac(algorithm, Buffer.alloc(1));
        return true;
    } catch (_e) {
        return false;
    }
}

function createHashCompat(algorithm) {
    const target = String(algorithm).toLowerCase();
    if (target === 'sm3' && !isHashSupported(target)) {
        return new Sm3Hash();
    }
    return crypto.createHash(algorithm);
}

const SM3_BLOCK_SIZE = 64;

class Sm3Hmac {
    constructor(key) {
        const keyBuf = toBuffer(key);
        let normalized = keyBuf;
        if (keyBuf.length > SM3_BLOCK_SIZE) {
            normalized = sm3Digest(keyBuf);
        }
        const padded = Buffer.alloc(SM3_BLOCK_SIZE);
        normalized.copy(padded, 0);

        this.innerKey = Buffer.alloc(SM3_BLOCK_SIZE);
        this.outerKey = Buffer.alloc(SM3_BLOCK_SIZE);
        for (let i = 0; i < SM3_BLOCK_SIZE; i++) {
            this.innerKey[i] = padded[i] ^ 0x36;
            this.outerKey[i] = padded[i] ^ 0x5c;
        }
        this.chunks = [this.innerKey];
        this.result = null;
    }

    update(data, encoding) {
        if (this.result) {
            throw new Error('Digest already called');
        }
        this.chunks.push(toBuffer(data, encoding));
        return this;
    }

    digest(encoding) {
        if (!this.result) {
            const inner = sm3Digest(Buffer.concat(this.chunks));
            this.result = sm3Digest(Buffer.concat([this.outerKey, inner]));
            this.chunks = [];
        }
        return encoding ? this.result.toString(encoding) : Buffer.from(this.result);
    }
}

function createHmacCompat(algorithm, key) {
    const target = String(algorithm).toLowerCase();
    if (target === 'sm3' && !isHmacSupported(target)) {
        return new Sm3Hmac(key);
    }
    return crypto.createHmac(algorithm, key);
}

module.exports = {
    createHashCompat,
    createHmacCompat,
    isHashSupported,
    isHmacSupported,
    sm3Digest
};
