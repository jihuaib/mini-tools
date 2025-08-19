// 事件类型
export const FTP_EVT_TYPES = {
    FTP_EVT: 1
};

// 子事件类型
export const FTP_SUB_EVT_TYPES = {
    FTP_SUB_EVT_CONNCET: 1 // 客户断连接子事件
};

// FTP服务器相关常量
export const DEFAULT_VALUES = {
    DEFAULT_FTP_PORT: 21,
    DEFAULT_FTP_ROOT_DIR: '',
    DEFAULT_FTP_USERNAME: '',
    DEFAULT_FTP_PASSWORD: ''
};

export const FTP_STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    AUTHENTICATED: 'authenticated',
    DOWNLOADING: 'downloading',
    UPLOADING: 'uploading',
    IDLE: 'idle'
};

// 默认FTP设置
export const DEFAULT_FTP_SETTINGS = {
    maxFtpUser: 10
};
