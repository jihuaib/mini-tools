// 事件类型
const FTP_EVT_TYPES = {
    CLIENT_CONNECTION: 1,
    AUTHENTICATION: 2,
    FILE_TRANSFER_START: 3,
    FILE_TRANSFER_COMPLETE: 4,
    FILE_TRANSFER_ERROR: 5,
    DIRECTORY_LISTING: 6,
    COMMAND_EXECUTED: 7
};

module.exports = {
    FTP_EVT_TYPES
};
