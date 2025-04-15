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
    { name: 'Address Family', code: 0x01 },
    { name: 'Route-Refresh', code: 0x02 },
    { name: 'AS4', code: 0x41 },
    { name: 'Role', code: 0x09 }
];

const BgpOpenCapMap = new Map(
    BgpOpenCap.map(({ name, code }) => [name, code])
);

const BgpAfiType = Object.freeze({
    AFI_IPV4: 1,
    AFI_IPV6: 2,
});

const BgpSAfiType = Object.freeze({
    SAFI_UNICAST: 1
});

const BgpRoleType = Object.freeze({
    ROLE_PROVIDER: 0,
    ROLE_RS: 1,
    ROLE_RS_CLIENT: 2,
    ROLE_CUSTOMER: 3,
    ROLE_PEER: 4,
});

const BgpRoleValue = [
    { name: 'Provider', code: BgpRoleType.ROLE_PROVIDER },
    { name: 'RS', code: BgpRoleType.ROLE_RS  },
    { name: 'RS-Client', code: BgpRoleType.ROLE_RS_CLIENT  },
    { name: 'Customer', code: BgpRoleType.ROLE_CUSTOMER  },
    { name: 'Lateral Peer', code: BgpRoleType.ROLE_PEER  }
];

const BgpRoleValueMap = new Map(
    BgpRoleValue.map(({ name, code }) => [name, code])
);

module.exports = {
    BGP_DEFAULT_PORT,
    BGP_HEAD_LEN,
    BGP_MAX_PKT_SIZE,
    BgpState,
    BgpPacketType,
    BgpOpenCapMap,
    BgpAfiType,
    BgpSAfiType,
    BgpRoleValueMap
};