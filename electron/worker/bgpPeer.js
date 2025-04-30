const BgpConst = require('../const/bgpConst');

class BgpPeer {
    constructor() {
        this.peerState = BgpConst.BGP_PEER_STATE.IDLE;
        this.session = null;
    }

    static makeKey(vrfIndex, peerIp, afi, safi) {
        return `${vrfIndex}|${peerIp}|${afi}|${safi}`;
    }
}

module.exports = BgpPeer;
