// 事件类型
const FTP_EVT_TYPES = {
    FTP_EVT: 1
};

// 子事件类型
const FTP_SUB_EVT_TYPES = {
    FTP_SUB_EVT_CONNCET: 1 // 客户断连接子事件
};

// FTP请求-响应类型
const FTP_REQ_TYPES = {
    START_FTP: 1,
    STOP_FTP: 2
};

const DEFAULT_FTP_SETTINGS = {
    maxFtpUser: 10
};

module.exports = {
    FTP_EVT_TYPES,
    FTP_SUB_EVT_TYPES,
    FTP_REQ_TYPES,
    DEFAULT_FTP_SETTINGS
};
