// 请求-响应类型
const BGP_REQ_TYPES = {
    START_BGP: 1,
    STOP_BGP: 2,
    CONFIG_PEER: 3,
    SEND_ROUTE: 4,
    WITHDRAW_ROUTE: 5
};

module.exports = { BGP_REQ_TYPES };
