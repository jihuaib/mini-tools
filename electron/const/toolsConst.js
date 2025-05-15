const PROTOCOL_TYPE = {
    AUTO: 1,
    BGP: 2
};

const START_LAYER = {
    L2: 1,
    L3: 2,
    L4: 3,
    L5: 4
};

// 默认工具设置
const DEFAULT_TOOLS_SETTINGS = {
    packetParser: {
        maxMessageHistory: 100
    },
    stringGenerator: {
        maxStringHistory: 100
    },
    ftpServer: {
        maxFtpUser: 100
    }
};

// 默认日志设置
const DEFAULT_LOG_SETTINGS = {
    logLevel: 'warn'
};

module.exports = { PROTOCOL_TYPE, START_LAYER, DEFAULT_TOOLS_SETTINGS, DEFAULT_LOG_SETTINGS };
