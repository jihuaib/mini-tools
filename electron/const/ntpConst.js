const NTP_EVT_TYPES = {
    NTP_EVT: 1
};

const NTP_SUB_EVT_TYPES = {
    REQUEST_RECEIVED: 1,
    SERVER_STATUS: 2,
    HISTORY_CLEARED: 3
};

const NTP_REQ_TYPES = {
    START_NTP: 1,
    STOP_NTP: 2,
    GET_REQUEST_LIST: 3,
    CLEAR_REQUEST_HISTORY: 4
};

const NTP_MODES = {
    RESERVED: 0,
    SYMMETRIC_ACTIVE: 1,
    SYMMETRIC_PASSIVE: 2,
    CLIENT: 3,
    SERVER: 4,
    BROADCAST: 5,
    CONTROL: 6,
    PRIVATE: 7
};

const DEFAULT_NTP_CONFIG = {
    port: 123,
    stratum: 8,
    referenceId: 'LOCL',
    timeOffsetMs: 0,
    rootDelayMs: 0,
    rootDispersionMs: 0
};

const DEFAULT_NTP_SETTINGS = {
    maxHistory: 200,
    precision: -20
};

module.exports = {
    NTP_EVT_TYPES,
    NTP_SUB_EVT_TYPES,
    NTP_REQ_TYPES,
    NTP_MODES,
    DEFAULT_NTP_CONFIG,
    DEFAULT_NTP_SETTINGS
};
