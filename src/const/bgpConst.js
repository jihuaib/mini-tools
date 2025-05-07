// 协议规定的BGP open capability code, 需要和后台定义保持一致, 后台会
// 直接使用这个值处理
export const BGP_OPEN_CAP_CODE = {
    MULTIPROTOCOL_EXTENSIONS: 0x01,
    ROUTE_REFRESH: 0x02,
    EXTENDED_NEXT_HOP_ENCODING: 0x05,
    FOUR_OCTET_AS: 0x41,
    BGP_ROLE: 0x09
};

// BGP Role Values, 需要和后台定义保持一致, 后台会
// 直接使用这个值处理
export const BGP_ROLE_TYPE = {
    ROLE_PROVIDER: 0,
    ROLE_RS: 1,
    ROLE_RS_CLIENT: 2,
    ROLE_CUSTOMER: 3,
    ROLE_PEER: 4,
    ROLE_INVALID: 255
};

// Address Family Values, 需要和后台定义保持一致, 后台会
// 直接使用这个值处理
export const BGP_ADDR_FAMILY = {
    IPV4_UNC: 1,
    IPV6_UNC: 2
};

// IP Type Values, 需要和后台定义保持一致, 后台会
// 直接使用这个值处理
export const IP_TYPE = {
    IPV4: 1,
    IPV6: 2
};

export const ADDRESS_FAMILY_NAME = {
    [BGP_ADDR_FAMILY.IPV4_UNC]: 'IPv4 UNC',
    [BGP_ADDR_FAMILY.IPV6_UNC]: 'IPv6 UNC'
};

// Default Values
export const DEFAULT_VALUES = {
    LOCAL_AS: '65535',
    ROUTER_ID: '192.168.56.1',
    PEER_IP: '192.168.56.11',
    PEER_AS: '100',
    HOLD_TIME: '180',
    DEFAULT_OPEN_CAP: [
        BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS,
        BGP_OPEN_CAP_CODE.ROUTE_REFRESH,
        BGP_OPEN_CAP_CODE.FOUR_OCTET_AS
    ],
    DEFAULT_ADDRESS_FAMILY: [BGP_ADDR_FAMILY.IPV4_UNC],
    DEFAULT_ROLE: BGP_ROLE_TYPE.ROLE_PROVIDER,
    IPV4_PREFIX: '1.1.1.1',
    IPV4_MASK: '32',
    IPV4_COUNT: '10',
    IPV6_PREFIX: '2001:db8::',
    IPV6_MASK: '64',
    IPV6_COUNT: '10',
    PEER_IPV6: '192::11',
    PEER_IPV6_AS: '100',
    HOLD_TIME_IPV6: '180',
    DEFAULT_OPEN_CAP_IPV6: [
        BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS,
        BGP_OPEN_CAP_CODE.ROUTE_REFRESH,
        BGP_OPEN_CAP_CODE.FOUR_OCTET_AS
    ],
    DEFAULT_ADDRESS_FAMILY_IPV6: [BGP_ADDR_FAMILY.IPV6_UNC]
};
