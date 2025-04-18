// BGP Open Capability Codes
export const BGP_CAPABILITY = {
    ADDR_FAMILY: 1,
    ROUTE_REFRESH: 2,
    AS4: 3,
    ROLE: 4
};

// BGP Role Values
export const BGP_ROLE = {
    PROVIDER: 1,
    RS: 2,
    RS_CLIENT: 3,
    CUSTOMER: 4,
    LATERAL_PEER: 5
};

// Address Family Values
export const ADDRESS_FAMILY = {
    IPV4_UNC: 1,
    IPV6_UNC: 2
};

// IP Type Values
export const IP_TYPE = {
    IPV4: 1,
    IPV6: 2
};

// Default Values
export const DEFAULT_VALUES = {
    LOCAL_AS: '65535',
    PEER_IP: '192.168.56.11',
    PEER_AS: '100',
    HOLD_TIME: '180',
    DEFAULT_OPEN_CAP: [BGP_CAPABILITY.ADDR_FAMILY, BGP_CAPABILITY.ROUTE_REFRESH, BGP_CAPABILITY.AS4],
    DEFAULT_ADDRESS_FAMILY: [ADDRESS_FAMILY.IPV4_UNC],
    DEFAULT_ROLE: BGP_ROLE.PROVIDER,
    IPV4_PREFIX: '1.1.1.1',
    IPV4_MASK: '32',
    IPV4_COUNT: '10',
    IPV6_PREFIX: '2001:db8::',
    IPV6_MASK: '64',
    IPV6_COUNT: '10'
};
