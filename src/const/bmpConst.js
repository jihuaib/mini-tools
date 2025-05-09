// BMP peer types, 需要和后台定义保持一致, 后台会
// 直接使用这个值处理
export const BMP_PEER_TYPE = {
    GLOBAL: 0,
    L3VPN: 1,
    LOCAL: 2,
    LOCAL_L3VPN: 3
};

// BMP peer flags, 需要和后台定义保持一致, 后台会
// 直接使用这个值处理
export const BMP_PEER_FLAGS = {
    IPV6: 0x80, // V 位: 使用 IPv6 地址
    LOC_RIB: 0x40, // L 位: 表示 Loc-RIB（而不是 Adj-RIB-In）
    POST_POLICY: 0x20, // A 位: Adj-RIB-In 是策略后导出的（post-policy）
    ADJ_RIB_OUT: 0x10 // O 位: Adj-RIB-Out 正在被传输
};

// 需要和后台定义保持一致, 后台会
// 直接使用这个值处理
export const BMP_PEER_STATE = {
    PEER_UP: 0,
    PEER_DOWN: 1
};

// BMP route update types, 需要和后台定义保持一致, 后台会
// 直接使用这个值处理
export const BMP_ROUTE_UPDATE_TYPE = {
    ROUTE_DELETE: 0,
    ROUTE_UPDATE: 1
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

// Default Values
export const DEFAULT_VALUES = {
    DEFAULT_BMP_PORT: '1790'
};
