// BGP default port number
const BGP_DEFAULT_PORT = 179;

const BGP_HEAD_LEN = 19; // 含16字节marker + 3字节固定头部

const BGP_MAX_PKT_SIZE = 4096;

// BGP version number
const BGP_VERSION = 4;

// BGP marker length (16 bytes of 0xff)
const BGP_MARKER_LEN = 16;

const BGP_STATE = {
    IDLE: 'Idle',
    CONNECT: 'Connect',
    ACTIVE: 'Active',
    OPEN_SENT: 'OpenSent',
    OPEN_CONFIRM: 'OpenConfirm',
    ESTABLISHED: 'Established'
};

const BGP_PACKET_TYPE = {
    OPEN: 1,
    UPDATE: 2,
    NOTIFICATION: 3,
    KEEPALIVE: 4,
    ROUTE_REFRESH: 5
};

// 渲染进程传入的capability
const BGP_CAPABILITY_UI = {
    ADDR_FAMILY: 1,
    ROUTE_REFRESH: 2,
    AS4: 3,
    ROLE: 4
};

const BGP_OPEN_CAP = [
    { key: BGP_CAPABILITY_UI.ADDR_FAMILY, code: 0x01 },
    { key: BGP_CAPABILITY_UI.ROUTE_REFRESH, code: 0x02 },
    { key: BGP_CAPABILITY_UI.AS4, code: 0x41 },
    { key: BGP_CAPABILITY_UI.ROLE, code: 0x09 }
];

const BGP_OPEN_CAP_MAP = new Map(BGP_OPEN_CAP.map(({ key, code }) => [key, code]));

// 渲染进程传入的afi（当前保持一致）
const BGP_AFI_TYPE_UI = {
    AFI_IPV4: 1,
    AFI_IPV6: 2
};

// 协议规定的safi
const BGP_SAFI_TYPE = {
    SAFI_UNICAST: 1
};

// 渲染进程传入的role
const BGP_ROLE_UI = {
    PROVIDER: 1,
    RS: 2,
    RS_CLIENT: 3,
    CUSTOMER: 4,
    LATERAL_PEER: 5
};

// 协议规定的role
const BGP_ROLE_TYPE = {
    ROLE_PROVIDER: 0,
    ROLE_RS: 1,
    ROLE_RS_CLIENT: 2,
    ROLE_CUSTOMER: 3,
    ROLE_PEER: 4
};

const BGP_ROLE_VALUE = [
    { key: BGP_ROLE_UI.PROVIDER, code: BGP_ROLE_TYPE.ROLE_PROVIDER },
    { key: BGP_ROLE_UI.RS, code: BGP_ROLE_TYPE.ROLE_RS },
    { key: BGP_ROLE_UI.RS_CLIENT, code: BGP_ROLE_TYPE.ROLE_RS_CLIENT },
    { key: BGP_ROLE_UI.CUSTOMER, code: BGP_ROLE_TYPE.ROLE_CUSTOMER },
    { key: BGP_ROLE_UI.LATERAL_PEER, code: BGP_ROLE_TYPE.ROLE_PEER }
];

const BGP_ROLE_VALUE_MAP = new Map(BGP_ROLE_VALUE.map(({ key, code }) => [key, code]));

module.exports = {
    BGP_DEFAULT_PORT,
    BGP_HEAD_LEN,
    BGP_MAX_PKT_SIZE,
    BGP_VERSION,
    BGP_MARKER_LEN,
    BGP_STATE,
    BGP_PACKET_TYPE,
    BGP_CAPABILITY_UI,
    BGP_AFI_TYPE_UI,
    BGP_SAFI_TYPE,
    BGP_ROLE_UI,
    BGP_ROLE_TYPE,
    BGP_ROLE_VALUE_MAP
};
