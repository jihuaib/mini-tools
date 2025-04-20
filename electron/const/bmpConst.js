// BMP message types (RFC 7854)
const BMP_MSG_TYPE = {
    ROUTE_MONITORING: 0,
    STATISTICS_REPORT: 1,
    PEER_DOWN_NOTIFICATION: 2,
    PEER_UP_NOTIFICATION: 3,
    INITIATION: 4,
    TERMINATION: 5,
    ROUTE_MIRRORING: 6
};

// BMP peer types
const BMP_PEER_TYPE = {
    GLOBAL: 0,
    L3VPN: 1,
    LOCAL: 2,
    LOCAL_L3VPN: 3
};

// BMP peer flags
const BMP_PEER_FLAGS = {
    IPV6: 0x80,
    POST_POLICY: 0x40,
    AS_PATH: 0x20,
    ADJ_RIB_OUT: 0x10
};

module.exports = { BMP_MSG_TYPE, BMP_PEER_TYPE, BMP_PEER_FLAGS };
