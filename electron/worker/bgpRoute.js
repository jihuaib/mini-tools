const { getAddrFamilyType } = require('../utils/ipUtils');
class BgpRoute {
    constructor(bgpInstance) {
        this.bgpInstance = bgpInstance;
        this.ip = null;
        this.mask = null;
        this.asPath = null;
        this.med = 0;
        this.nextHop = null;
        this.origin = null;
        this.customAttr = null;
    }

    static makeKey(ip, mask) {
        return `${ip}|${mask}`;
    }

    static parseKey(key) {
        const [ip, mask] = key.split('|');
        return { ip, mask };
    }

    getRouteInfo() {
        const addressFamily = getAddrFamilyType(this.bgpInstance.afi, this.bgpInstance.safi);
        return {
            ip: this.ip,
            mask: this.mask,
            asPath: this.asPath,
            med: this.med,
            nextHop: this.nextHop,
            origin: this.origin,
            customAttr: this.customAttr,
            addressFamily: addressFamily
        };
    }
}

module.exports = BgpRoute;
