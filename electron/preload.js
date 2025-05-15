const { contextBridge, ipcRenderer } = require('electron');

// 通用模块
contextBridge.exposeInMainWorld('commonApi', {
    openDeveloperOptions: () => ipcRenderer.send('common:openDeveloperOptions'),
    openSoftwareInfo: () => ipcRenderer.send('common:openSoftwareInfo'),
    saveGeneralSettings: settings => ipcRenderer.invoke('common:saveGeneralSettings', settings),
    getGeneralSettings: () => ipcRenderer.invoke('common:getGeneralSettings'),
    saveToolsSettings: settings => ipcRenderer.invoke('common:saveToolsSettings', settings),
    getToolsSettings: () => ipcRenderer.invoke('common:getToolsSettings'),
    selectDirectory: () => ipcRenderer.invoke('common:selectDirectory')
});

// 工具模块
contextBridge.exposeInMainWorld('toolsApi', {
    // 字符串生成模块
    generateString: templateData => ipcRenderer.invoke('tools:generateString', templateData),
    getGenerateStringHistory: () => ipcRenderer.invoke('tools:getGenerateStringHistory'),
    clearGenerateStringHistory: () => ipcRenderer.invoke('tools:clearGenerateStringHistory'),

    // 报文解析模块
    parsePacket: packetData => ipcRenderer.invoke('tools:parsePacket', packetData),
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

    // bgp
    startBgp: bgpConfigData => ipcRenderer.invoke('bgp:startBgp', bgpConfigData),
    stopBgp: () => ipcRenderer.invoke('bgp:stopBgp'),

    // peer
    configIpv4Peer: ipv4PeerConfigData => ipcRenderer.invoke('bgp:configIpv4Peer', ipv4PeerConfigData),
    configIpv6Peer: ipv6PeerConfigData => ipcRenderer.invoke('bgp:configIpv6Peer', ipv6PeerConfigData),
    getPeerInfo: () => ipcRenderer.invoke('bgp:getPeerInfo'),
    deletePeer: peer => ipcRenderer.invoke('bgp:deletePeer', peer),

    // route
    generateIpv4Routes: config => ipcRenderer.invoke('bgp:generateIpv4Routes', config),
    generateIpv6Routes: config => ipcRenderer.invoke('bgp:generateIpv6Routes', config),
    deleteIpv4Routes: config => ipcRenderer.invoke('bgp:deleteIpv4Routes', config),
    deleteIpv6Routes: config => ipcRenderer.invoke('bgp:deleteIpv6Routes', config),
    getRoutes: addressFamily => ipcRenderer.invoke('bgp:getRoutes', addressFamily),

    // 事件监听
    onPeerChange: callback => ipcRenderer.on('bgp:peerChange', (_event, data) => callback(data)),

    // 移除事件监听
    offPeerChange: callback => ipcRenderer.removeListener('bgp:peerChange', callback)
});

// bmp模块
contextBridge.exposeInMainWorld('bmpApi', {
    // 配置相关
    saveBmpConfig: config => ipcRenderer.invoke('bmp:saveBmpConfig', config),
    loadBmpConfig: () => ipcRenderer.invoke('bmp:loadBmpConfig'),

    // bmp
    startBmp: config => ipcRenderer.invoke('bmp:startBmp', config),
    stopBmp: () => ipcRenderer.invoke('bmp:stopBmp'),

    // 数据获取
    getClientList: () => ipcRenderer.invoke('bmp:getClientList'),
    getPeers: client => ipcRenderer.invoke('bmp:getPeers', client),
    getRoutes: (client, peer, ribType) => ipcRenderer.invoke('bmp:getRoutes', client, peer, ribType),
    getClient: client => ipcRenderer.invoke('bmp:getClient', client),
    getPeer: (client, peer) => ipcRenderer.invoke('bmp:getPeer', client, peer),

    // 事件监听
    onPeerUpdate: callback => ipcRenderer.on('bmp:peerUpdate', (_event, data) => callback(data)),
    onRouteUpdate: callback => ipcRenderer.on('bmp:routeUpdate', (_event, data) => callback(data)),
    onInitiation: callback => ipcRenderer.on('bmp:initiation', (_event, data) => callback(data)),
    onTermination: callback => ipcRenderer.on('bmp:termination', (_event, data) => callback(data)),

    // 移除指定监听器（推荐在页面卸载时调用）
    offPeerUpdate: callback => ipcRenderer.removeListener('bmp:peerUpdate', callback),
    offRouteUpdate: callback => ipcRenderer.removeListener('bmp:routeUpdate', callback),
    offInitiation: callback => ipcRenderer.removeListener('bmp:initiation', callback),
    offTermination: callback => ipcRenderer.removeListener('bmp:termination', callback)
});

// rpki模块
contextBridge.exposeInMainWorld('rpkiApi', {
    // 配置相关
    saveRpkiConfig: config => ipcRenderer.invoke('rpki:saveRpkiConfig', config),
    loadRpkiConfig: () => ipcRenderer.invoke('rpki:loadRpkiConfig'),

    // rpki
    startRpki: config => ipcRenderer.invoke('rpki:startRpki', config),
    stopRpki: () => ipcRenderer.invoke('rpki:stopRpki'),

    // roa
    addRoa: roa => ipcRenderer.invoke('rpki:addRoa', roa),
    deleteRoa: roa => ipcRenderer.invoke('rpki:deleteRoa', roa),
    getRoaList: () => ipcRenderer.invoke('rpki:getRoaList'),

    // 事件监听
    onClientConnection: callback => ipcRenderer.on('rpki:clientConnection', (_event, data) => callback(data)),

    // 移除事件监听
    offClientConnection: callback => ipcRenderer.removeListener('rpki:clientConnection', callback)
});

// ftp模块
contextBridge.exposeInMainWorld('ftpApi', {
    // 配置相关
    addFtpUser: user => ipcRenderer.invoke('ftp:addFtpUser', user),
    getFtpUserList: () => ipcRenderer.invoke('ftp:getFtpUserList'),
    deleteFtpUser: user => ipcRenderer.invoke('ftp:deleteFtpUser', user),
    saveFtpConfig: config => ipcRenderer.invoke('ftp:saveFtpConfig', config),
    getFtpConfig: () => ipcRenderer.invoke('ftp:getFtpConfig'),

    // ftp
    startFtp: (config, user) => ipcRenderer.invoke('ftp:startFtp', config, user),
    stopFtp: () => ipcRenderer.invoke('ftp:stopFtp'),
    getFtpStatus: () => ipcRenderer.invoke('ftp:getFtpStatus'),

    // 事件监听
    onClientConnection: callback => ipcRenderer.on('ftp:clientConnection', (_event, data) => callback(data)),

    // 移除事件监听
    offClientConnection: callback => ipcRenderer.removeListener('ftp:clientConnection', callback)
});
