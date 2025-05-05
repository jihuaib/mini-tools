// BMP peer types
export const BMP_PEER_TYPE = {
    GLOBAL: 0,
    L3VPN: 1,
    LOCAL: 2,
    LOCAL_L3VPN: 3
};

// BMP peer flags
export const BMP_PEER_FLAGS = {
    IPV6: 0x80,
    POST_POLICY: 0x40,
    AS_PATH: 0x20,
    ADJ_RIB_OUT: 0x10
};

export const BMP_PEER_STATE = {
    PEER_UP: 0,
    PEER_DOWN: 1
};

export const BMP_PEER_TYPE_NAME = {
    [BMP_PEER_TYPE.GLOBAL]: 'Global',
    [BMP_PEER_TYPE.L3VPN]: 'L3VPN',
    [BMP_PEER_TYPE.LOCAL]: 'Local',
    [BMP_PEER_TYPE.LOCAL_L3VPN]: 'Local L3VPN'
};

export const BMP_PEER_FLAGS_NAME = {
    [BMP_PEER_FLAGS.IPV6]: 'IPv6',
    [BMP_PEER_FLAGS.POST_POLICY]: 'Post Policy',
    [BMP_PEER_FLAGS.AS_PATH]: 'AS Path',
    [BMP_PEER_FLAGS.ADJ_RIB_OUT]: 'Adj RIB Out'
};

export const BMP_PEER_STATE_NAME = {
    [BMP_PEER_STATE.PEER_UP]: 'Peer Up',
    [BMP_PEER_STATE.PEER_DOWN]: 'Peer Down'
};

// BMP route update types
export const BMP_ROUTE_UPDATE_TYPE = {
    ROUTE_DELETE: 0,
    ROUTE_UPDATE: 1
};

// Default Values
export const DEFAULT_VALUES = {
    DEFAULT_BMP_PORT: '1790'
};
