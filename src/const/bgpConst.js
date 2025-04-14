// BGP default port number
const BGP_DEFAULT_PORT = 179;

const BGP_HEAD_LEN = 19;  // 含16字节marker + 3字节固定头部

const BGP_MAX_PKT_SIZE = 4096;

const BgpState = Object.freeze({
    IDLE: 'Idle',
    CONNECT: 'Connect',
    ACTIVE: 'Active',
    OPEN_SENT: 'OpenSent',
    OPEN_CONFIRM: 'OpenConfirm',
    ESTABLISHED: 'Established',
});

const BgpPacketType = Object.freeze({
    OPEN: 1,
    UPDATE: 2,
    NOTIFICATION: 3,
    KEEPALIVE: 4,
    ROUTE_REFRESH: 5,
});

const BgpOpenCap = [
    {
        name: 'Ipv4-UNC',
        value: 0x01
    },
    {
        name: 'Route-Refresh',
        value: 0x02
    },
    {
        name: 'AS4',
        value: 0x41
    },
    {
        name: 'Ipv6-UNC',
        value: 0x41
    },
];

module.exports = {
    BGP_DEFAULT_PORT,
    BGP_HEAD_LEN,
    BGP_MAX_PKT_SIZE,
    BgpState,
    BgpPacketType
};