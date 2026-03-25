// DHCP事件类型
export const DHCP_EVT_TYPES = {
    DHCP_EVT: 1
};

// DHCP子事件类型
export const DHCP_SUB_EVT_TYPES = {
    DHCP_SUB_EVT_LEASE: 1, // 租约变更（add/remove/update）
    DHCP_SUB_EVT_LOG: 2 // 日志事件
};

// 默认配置值
export const DEFAULT_VALUES = {
    DEFAULT_POOL_START: '192.168.1.100',
    DEFAULT_POOL_END: '192.168.1.200',
    DEFAULT_SUBNET_MASK: '255.255.255.0',
    DEFAULT_GATEWAY: '192.168.1.1',
    DEFAULT_DNS1: '8.8.8.8',
    DEFAULT_DNS2: '8.8.4.4',
    DEFAULT_LEASE_TIME: 86400
};

// 页面ID，用于EventBus订阅
export const DHCP_EVENT_PAGE_ID = {
    PAGE_ID_DHCP_CONFIG: 1,
    PAGE_ID_DHCP_LEASE: 2
};
