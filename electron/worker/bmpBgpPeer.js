const Logger = require('../log/logger');
const { getAddrFamilyType } = require('../utils/ipUtils');

class BmpBgpPeer {
    constructor(bmpSession) {
        this.bmpSession = bmpSession;
        this.logger = new Logger();

        this.afi = null;
        this.safi = null;
        this.peertype = null;
        this.peerFlags = null;
        this.peerRd = null;
        this.peerIp = null;
        this.peerAs = null;
        this.peerRouterId = null;
        this.peerTimestamp = null;
        this.peerTimestampMs = null;
        this.localIp = null;
        this.localPort = null;
        this.remotePort = null;
        this.bgpPacket = [];
        this.peerState = null;

        this.preRibInMap = new Map();
        this.ribInMap = new Map();
        this.locRibMap = new Map();
        this.postLocRibMap = new Map();
    }

    static makeKey(afi, safi, peerIp, peerRd) {
        return `${afi || 'null'}|${safi || 'null'}|${peerIp}|${peerRd}`;
    }

    static parseKey(key) {
        const [afi, safi, peerIp, peerRd] = key.split('|');
        return {
            afi: afi === 'null' ? null : parseInt(afi),
            safi: safi === 'null' ? null : parseInt(safi),
            peerIp,
            peerRd
        };
    }

    getPeerInfo() {
        const addrFamilyType = getAddrFamilyType(this.afi, this.safi);
        return {
            addrFamilyType: addrFamilyType,
            peerType: this.peerType,
            peerFlags: this.peerFlags,
            peerRd: this.peerRd,
            peerIp: this.peerIp,
            peerAs: this.peerAs,
            peerRouterId: this.peerRouterId,
            peerTimestamp: this.peerTimestamp,
            peerTimestampMs: this.peerTimestampMs,
            localIp: this.localIp,
            localPort: this.localPort,
            remotePort: this.remotePort,
            bgpPacket: this.bgpPacket,
            peerState: this.peerState
        };
    }

    closePeer() {
        this.preRibInMap.clear();
        this.ribInMap.clear();
        this.locRibMap.clear();
        this.postLocRibMap.clear();
    }
}

module.exports = BmpBgpPeer;
