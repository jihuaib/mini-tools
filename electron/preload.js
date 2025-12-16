const { contextBridge, ipcRenderer } = require('electron');

// ================================
// 统一事件管理器
// ================================
class EventManager {
    constructor() {
        this.eventHandlers = new Map(); // 存储事件处理器
        this.setupUnifiedListener();
    }

    // 设置统一的事件监听器
    setupUnifiedListener() {
        // 监听所有来自主进程的事件
        ipcRenderer.on('unified-event', (event, { type, data }) => {
            this.dispatchEvent(type, data);
        });
    }

    // 注册事件处理器
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, new Set());
        }
        this.eventHandlers.get(eventType).add(handler);
    }

    // 移除事件处理器
    off(eventType, handler) {
        if (this.eventHandlers.has(eventType)) {
            this.eventHandlers.get(eventType).delete(handler);
            // 如果没有处理器了，清理这个事件类型
            if (this.eventHandlers.get(eventType).size === 0) {
                this.eventHandlers.delete(eventType);
            }
        }
    }

    // 分发事件
    dispatchEvent(eventType, data) {
        if (this.eventHandlers.has(eventType)) {
            this.eventHandlers.get(eventType).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Event handler error for ${eventType}:`, error);
                }
            });
        }
    }

    // 获取当前注册的事件类型
    getRegisteredEvents() {
        return Array.from(this.eventHandlers.keys());
    }

    // 清理所有事件处理器
    cleanup() {
        this.eventHandlers.clear();
    }
}

// 创建全局事件管理器实例
const eventManager = new EventManager();

// ================================
// 统一的API暴露方法
// ================================

// 通用模块
contextBridge.exposeInMainWorld('commonApi', {
    openDeveloperOptions: () => ipcRenderer.send('common:openDeveloperOptions'),
    openSoftwareInfo: () => ipcRenderer.send('common:openSoftwareInfo'),
    saveGeneralSettings: settings => ipcRenderer.invoke('common:saveGeneralSettings', settings),
    getGeneralSettings: () => ipcRenderer.invoke('common:getGeneralSettings'),
    saveToolsSettings: settings => ipcRenderer.invoke('common:saveToolsSettings', settings),
    getToolsSettings: () => ipcRenderer.invoke('common:getToolsSettings'),
    saveFtpSettings: settings => ipcRenderer.invoke('common:saveFtpSettings', settings),
    getFtpSettings: () => ipcRenderer.invoke('common:getFtpSettings'),
    selectDirectory: () => ipcRenderer.invoke('common:selectDirectory'),
    saveUpdateSettings: settings => ipcRenderer.invoke('common:saveUpdateSettings', settings),
    getUpdateSettings: () => ipcRenderer.invoke('common:getUpdateSettings')
});

// 更新模块
contextBridge.exposeInMainWorld('updaterApi', {
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    getCurrentVersion: () => ipcRenderer.invoke('updater:getCurrentVersion'),

    // 使用统一事件管理
    onUpdateStatus: callback => eventManager.on('updater:update-status', callback),
    offUpdateStatus: callback => eventManager.off('updater:update-status', callback)
});

// 工具模块
contextBridge.exposeInMainWorld('toolsApi', {
    generateString: templateData => ipcRenderer.invoke('tools:generateString', templateData),
    getGenerateStringHistory: () => ipcRenderer.invoke('tools:getGenerateStringHistory'),
    clearGenerateStringHistory: () => ipcRenderer.invoke('tools:clearGenerateStringHistory'),
    parsePacket: packetData => ipcRenderer.invoke('tools:parsePacket', packetData),
    parsePacketNoSaveHistory: packetData => ipcRenderer.invoke('tools:parsePacketNoSaveHistory', packetData),
    getPacketParserHistory: () => ipcRenderer.invoke('tools:getPacketParserHistory'),
    clearPacketParserHistory: () => ipcRenderer.invoke('tools:clearPacketParserHistory')
});

// bgp模块
contextBridge.exposeInMainWorld('bgpApi', {
    // 配置相关
    saveBgpConfig: config => ipcRenderer.invoke('bgp:saveBgpConfig', config),
    loadBgpConfig: () => ipcRenderer.invoke('bgp:loadBgpConfig'),
    saveIpv4PeerConfig: config => ipcRenderer.invoke('bgp:saveIpv4PeerConfig', config),
    loadIpv4PeerConfig: () => ipcRenderer.invoke('bgp:loadIpv4PeerConfig'),
    saveIpv6PeerConfig: config => ipcRenderer.invoke('bgp:saveIpv6PeerConfig', config),
    loadIpv6PeerConfig: () => ipcRenderer.invoke('bgp:loadIpv6PeerConfig'),
    saveIpv4UNCRouteConfig: config => ipcRenderer.invoke('bgp:saveIpv4UNCRouteConfig', config),
    loadIpv4UNCRouteConfig: () => ipcRenderer.invoke('bgp:loadIpv4UNCRouteConfig'),
    saveIpv6UNCRouteConfig: config => ipcRenderer.invoke('bgp:saveIpv6UNCRouteConfig', config),
    loadIpv6UNCRouteConfig: () => ipcRenderer.invoke('bgp:loadIpv6UNCRouteConfig'),

    // bgp操作
    startBgp: bgpConfigData => ipcRenderer.invoke('bgp:startBgp', bgpConfigData),
    stopBgp: () => ipcRenderer.invoke('bgp:stopBgp'),

    // peer操作
    configIpv4Peer: ipv4PeerConfigData => ipcRenderer.invoke('bgp:configIpv4Peer', ipv4PeerConfigData),
    configIpv6Peer: ipv6PeerConfigData => ipcRenderer.invoke('bgp:configIpv6Peer', ipv6PeerConfigData),
    getPeerInfo: () => ipcRenderer.invoke('bgp:getPeerInfo'),
    deletePeer: peer => ipcRenderer.invoke('bgp:deletePeer', peer),

    // route操作
    generateIpv4Routes: config => ipcRenderer.invoke('bgp:generateIpv4Routes', config),
    generateIpv6Routes: config => ipcRenderer.invoke('bgp:generateIpv6Routes', config),
    deleteIpv4Routes: config => ipcRenderer.invoke('bgp:deleteIpv4Routes', config),
    deleteIpv6Routes: config => ipcRenderer.invoke('bgp:deleteIpv6Routes', config),
    getRoutes: (addressFamily, page, pageSize) => ipcRenderer.invoke('bgp:getRoutes', addressFamily, page, pageSize),

    // MVPN route操作
    saveIpv4MvpnRouteConfig: config => ipcRenderer.invoke('bgp:saveIpv4MvpnRouteConfig', config),
    loadIpv4MvpnRouteConfig: () => ipcRenderer.invoke('bgp:loadIpv4MvpnRouteConfig'),
    generateIpv4MvpnRoutes: config => ipcRenderer.invoke('bgp:generateIpv4MvpnRoutes', config),
    deleteIpv4MvpnRoutes: config => ipcRenderer.invoke('bgp:deleteIpv4MvpnRoutes', config),

    // 使用统一事件管理
    onPeerChange: callback => eventManager.on('bgp:peerChange', callback),
    offPeerChange: callback => eventManager.off('bgp:peerChange', callback)
});

// bmp模块
contextBridge.exposeInMainWorld('bmpApi', {
    // 配置相关
    saveBmpConfig: config => ipcRenderer.invoke('bmp:saveBmpConfig', config),
    loadBmpConfig: () => ipcRenderer.invoke('bmp:loadBmpConfig'),

    // bmp操作
    startBmp: config => ipcRenderer.invoke('bmp:startBmp', config),
    stopBmp: () => ipcRenderer.invoke('bmp:stopBmp'),

    // 数据获取
    getClientList: () => ipcRenderer.invoke('bmp:getClientList'),
    getBgpSessions: client => ipcRenderer.invoke('bmp:getBgpSessions', client),
    getBgpRoutes: (client, session, af, ribType, page, pageSize) =>
        ipcRenderer.invoke('bmp:getBgpRoutes', client, session, af, ribType, page, pageSize),
    getBgpInstances: client => ipcRenderer.invoke('bmp:getBgpInstances', client),
    getBgpInstanceRoutes: (client, instance, page, pageSize) =>
        ipcRenderer.invoke('bmp:getBgpInstanceRoutes', client, instance, page, pageSize),

    // 使用统一事件管理
    onSessionUpdate: callback => eventManager.on('bmp:sessionUpdate', callback),
    onInstanceUpdate: callback => eventManager.on('bmp:instanceUpdate', callback),
    onRouteUpdate: callback => eventManager.on('bmp:routeUpdate', callback),
    onInstanceRouteUpdate: callback => eventManager.on('bmp:instanceRouteUpdate', callback),
    onInitiation: callback => eventManager.on('bmp:initiation', callback),
    onTermination: callback => eventManager.on('bmp:termination', callback),
    offSessionUpdate: callback => eventManager.off('bmp:sessionUpdate', callback),
    offInstanceUpdate: callback => eventManager.off('bmp:instanceUpdate', callback),
    offRouteUpdate: callback => eventManager.off('bmp:routeUpdate', callback),
    offInstanceRouteUpdate: callback => eventManager.off('bmp:instanceRouteUpdate', callback),
    offInitiation: callback => eventManager.off('bmp:initiation', callback),
    offTermination: callback => eventManager.off('bmp:termination', callback)
});

// rpki模块
contextBridge.exposeInMainWorld('rpkiApi', {
    // 配置相关
    saveRpkiConfig: config => ipcRenderer.invoke('rpki:saveRpkiConfig', config),
    loadRpkiConfig: () => ipcRenderer.invoke('rpki:loadRpkiConfig'),

    // rpki操作
    startRpki: config => ipcRenderer.invoke('rpki:startRpki', config),
    stopRpki: () => ipcRenderer.invoke('rpki:stopRpki'),

    // roa操作
    addRoa: roa => ipcRenderer.invoke('rpki:addRoa', roa),
    deleteRoa: roa => ipcRenderer.invoke('rpki:deleteRoa', roa),
    getRoaList: () => ipcRenderer.invoke('rpki:getRoaList'),

    // 使用统一事件管理
    onClientConnection: callback => eventManager.on('rpki:clientConnection', callback),
    offClientConnection: callback => eventManager.off('rpki:clientConnection', callback)
});

// ftp模块
contextBridge.exposeInMainWorld('ftpApi', {
    // 配置相关
    addFtpUser: user => ipcRenderer.invoke('ftp:addFtpUser', user),
    getFtpUserList: () => ipcRenderer.invoke('ftp:getFtpUserList'),
    deleteFtpUser: user => ipcRenderer.invoke('ftp:deleteFtpUser', user),
    saveFtpConfig: config => ipcRenderer.invoke('ftp:saveFtpConfig', config),
    getFtpConfig: () => ipcRenderer.invoke('ftp:getFtpConfig'),

    // ftp操作
    startFtp: (config, user) => ipcRenderer.invoke('ftp:startFtp', config, user),
    stopFtp: () => ipcRenderer.invoke('ftp:stopFtp'),
    getFtpStatus: () => ipcRenderer.invoke('ftp:getFtpStatus'),

    // 使用统一事件管理
    onFtpEvt: callback => eventManager.on('ftp:event', callback),
    offFtpEvt: callback => eventManager.off('ftp:event', callback)
});

// snmp模块
contextBridge.exposeInMainWorld('snmpApi', {
    // 配置相关
    saveSnmpConfig: config => ipcRenderer.invoke('snmp:saveSnmpConfig', config),
    getSnmpConfig: () => ipcRenderer.invoke('snmp:getSnmpConfig'),

    // snmp服务
    startSnmp: config => ipcRenderer.invoke('snmp:startSnmp', config),
    stopSnmp: () => ipcRenderer.invoke('snmp:stopSnmp'),

    // 使用统一事件管理
    onSnmpEvent: callback => eventManager.on('snmp:event', callback),
    offSnmpEvent: callback => eventManager.off('snmp:event', callback)
});

// 依赖本地工具模块
contextBridge.exposeInMainWorld('nativeApi', {
    // 抓包工具模块
    getNetworkInterfaces: () => ipcRenderer.invoke('native:getNetworkInterfaces'),
    startPacketCapture: config => ipcRenderer.invoke('native:startPacketCapture', config),
    stopPacketCapture: () => ipcRenderer.invoke('native:stopPacketCapture'),
    exportPacketsToPcap: packets => ipcRenderer.invoke('native:exportPacketsToPcap', packets),

    // 使用统一事件管理
    onPacketEvent: callback => eventManager.on('native:packetEvent', callback),
    offPacketEvent: callback => eventManager.off('native:packetEvent', callback),

    // 格式化工具模块
    formatData: formatterData => ipcRenderer.invoke('native:formatData', formatterData),
    getFormatterHistory: () => ipcRenderer.invoke('native:getFormatterHistory'),
    clearFormatterHistory: () => ipcRenderer.invoke('native:clearFormatterHistory')
});

// ================================
// 开发者调试API（可选）
// ================================
contextBridge.exposeInMainWorld('eventManagerApi', {
    // 获取当前注册的事件类型（用于调试）
    getRegisteredEvents: () => eventManager.getRegisteredEvents(),
    // 清理所有事件处理器（用于热重载或调试）
    cleanup: () => eventManager.cleanup()
});
