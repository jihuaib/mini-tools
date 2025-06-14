// 请求-响应类型
const BGP_REQ_TYPES = {
    START_BGP: 1,
    STOP_BGP: 2,
    CONFIG_IPV4_PEER: 3,
    CONFIG_IPV6_PEER: 4,
    DELETE_PEER: 5,
    GENERATE_IPV4_ROUTES: 6,
    GENERATE_IPV6_ROUTES: 7,
    DELETE_IPV4_ROUTES: 8,
    DELETE_IPV6_ROUTES: 9,
    GET_PEER_INFO: 10,
    GET_ROUTES: 11
};

module.exports = { BGP_REQ_TYPES };
