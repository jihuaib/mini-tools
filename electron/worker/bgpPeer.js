const BgpConst = require('../const/bgpConst');
const { BGP_EVT_TYPES } = require('../const/BgpEvtConst');
const { getAddrFamilyType } = require('../utils/ipUtils');
const Logger = require('../log/logger');
class BgpPeer {
    constructor(session, vrfIndex, localIp, localAs, peerIp, peerAs, afi, safi, routerId) {
        this.peerState = BgpConst.BGP_PEER_STATE.IDLE;
        this.session = session;

        this.vrfIndex = vrfIndex;
        this.afi = afi;
        this.safi = safi;
        this.localIp = localIp;
        this.localAs = localAs;
        this.peerIp = peerIp;
        this.peerAs = peerAs;
        this.routerId = routerId;
        this.logger = new Logger();
    }

    static makeKey(vrfIndex, peerIp, afi, safi) {
        return `${vrfIndex}|${peerIp}|${afi}|${safi}`;
    }

    static parseKey(key) {
        const [vrfIndex, peerIp, afi, safi] = key.split('|');
        return { vrfIndex: parseInt(vrfIndex), peerIp, afi: parseInt(afi), safi: parseInt(safi) };
    }

    changePeerState(state) {
        if (this.peerState == BgpConst.BGP_PEER_STATE.NO_NEG) {
            return;
        }

        this.logger.info(
            `peer ${this.peerIp} fsm state ${BgpConst.BGP_STATE_MAP.get(this.peerState)} -> ${BgpConst.BGP_STATE_MAP.get(state)}`
        );

        this.peerState = state;

        const peerInfo = this.getPeerInfo();

        // 发送状态变更事件
        this.session.messageHandler.sendEvent(BGP_EVT_TYPES.BGP_PEER_CHANGE, { data: peerInfo });
    }

    handleNotification() {
        this.logger.info(
            `peer ${this.peerIp} fsm state ${BgpConst.BGP_STATE_MAP.get(this.peerState)} -> ${BgpConst.BGP_STATE_MAP.get(BgpConst.BGP_PEER_STATE.IDLE)}`
        );

        this.peerState = BgpConst.BGP_PEER_STATE.IDLE;

        const peerInfo = this.getPeerInfo();

        // 发送状态变更事件
        this.session.messageHandler.sendEvent(BGP_EVT_TYPES.BGP_PEER_CHANGE, { data: peerInfo });
    }

    getPeerInfo() {
        const addressFamily = getAddrFamilyType(this.afi, this.safi);
        return {
            vrfIndex: this.vrfIndex,
            localIp: this.localIp,
            localAs: this.localAs,
            peerIp: this.peerIp,
            peerAs: this.peerAs,
            routerId: this.routerId,
            peerState: BgpConst.BGP_STATE_MAP.get(this.peerState),
            addressFamily: addressFamily
        };
    }
}

module.exports = BgpPeer;
