const { getAddrFamilyType } = require('../utils/bgpUtils');
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
        this.RT = null;

        // MVPN
        this.routeType = null;
        this.rd = null;
        this.originatingRouterIp = null;
        this.sourceIp = null;
        this.groupIp = null;
        this.sourceAs = null;
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
            RT: this.RT,
            routeType: this.routeType,
            rd: this.rd,
            originatingRouterIp: this.originatingRouterIp,
            sourceIp: this.sourceIp,
            groupIp: this.groupIp,
            sourceAs: this.sourceAs,
            addressFamily: addressFamily
        };
    }
}

module.exports = BgpRoute;
