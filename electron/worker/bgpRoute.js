class BgpRoute {
    constructor(bgpInstance) {
        this.bgpInstance = bgpInstance;
        this.ip = null;
        this.mask = null;
        this.asPath = null;
        this.med = null;
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
        return {
            ip: this.ip,
            mask: this.mask,
            asPath: this.asPath,
            med: this.med,
            nextHop: this.nextHop,
            origin: this.origin,
            customAttr: this.customAttr
        };
    }
}

module.exports = BgpRoute;
