const { getAddrFamilyType } = require('../utils/bgpUtils');

class BmpBgpRoute {
    constructor(BmpBgpSession) {
        this.BmpBgpSession = BmpBgpSession;

        // key
        this.pathId = null;
        this.rd = null;
        this.ip = null;
        this.mask = null;

        // attributes
        this.origin = null;
        this.asPath = null;
        this.med = 0;
        this.localPref = 0;
        this.communities = null;
        this.otc = null;
        this.nextHop = null;

        // bgp packet
        this.bgpPacket = [];
    }

    static makeKey(pathId, rd, ip, mask) {
        return `${pathId}|${rd}|${ip}|${mask}`;
    }

    static parseKey(key) {
        const [pathId, rd, ip, mask] = key.split('|');
        return { pathId, rd, ip, mask };
    }

    getRouteInfo() {
        const addrFamilyType = getAddrFamilyType(this.BmpBgpSession.afi, this.BmpBgpSession.safi);
        return {
            addrFamilyType: addrFamilyType,
            ip: this.ip,
            mask: this.mask,
            rd: this.rd,
            origin: this.origin,
            asPath: this.asPath,
            med: this.med,
            nextHop: this.nextHop,
            localPref: this.localPref,
            communities: this.communities,
            otc: this.otc,
            pathId: this.pathId
        };
    }

    clearAttributes() {
        this.origin = null;
        this.asPath = null;
        this.med = 0;
        this.nextHop = null;
        this.localPref = 0;
        this.communities = null;
        this.otc = null;

        this.bgpPacket = [];
    }
}

module.exports = BmpBgpRoute;
