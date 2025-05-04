const { contextBridge, ipcRenderer } = require('electron');

// 通用模块
contextBridge.exposeInMainWorld('commonApi', {
    openDeveloperOptions: () => ipcRenderer.send('common:openDeveloperOptions'),
    openSoftwareInfo: () => ipcRenderer.send('common:openSoftwareInfo')
});

// 工具模块
contextBridge.exposeInMainWorld('toolsApi', {
    // 字符串生成模块
    generateString: templateData => ipcRenderer.invoke('tools:generateString', templateData),
    saveGenerateStringConfig: config => ipcRenderer.invoke('tools:saveGenerateStringConfig', config),
    loadGenerateStringConfig: () => ipcRenderer.invoke('tools:loadGenerateStringConfig')
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
    offPeerChange: callback => ipcRenderer.removeListener('bgp:peerChange', callback),
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
    getRoutes: (client, peer) => ipcRenderer.invoke('bmp:getRoutes', client, peer),
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
    offTermination: callback => ipcRenderer.removeListener('bmp:termination', callback),
});
