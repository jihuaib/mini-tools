const { contextBridge, ipcRenderer } = require('electron');

// 通用模块
contextBridge.exposeInMainWorld('commonApi', {
    openDeveloperOptions: () => ipcRenderer.send('common:openDeveloperOptions'),
    openSoftwareInfo: () => ipcRenderer.send('common:openSoftwareInfo')
});

// 字符串生成模块
contextBridge.exposeInMainWorld('stringGeneratorApi', {
    generateString: templateData => ipcRenderer.invoke('string-generator:generateString', templateData),
    saveConfig: config => ipcRenderer.invoke('string-generator:saveConfig', config),
    loadConfig: () => ipcRenderer.invoke('string-generator:loadConfig')
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
    onPeerChange: callback => ipcRenderer.on('bgp:peerChange', (_event, data) => callback(data)),
    getPeerInfo: () => ipcRenderer.invoke('bgp:getPeerInfo'),
    deletePeer: peer => ipcRenderer.invoke('bgp:deletePeer', peer),

    // route
    generateIpv4Routes: config => ipcRenderer.invoke('bgp:generateIpv4Routes', config),
    generateIpv6Routes: config => ipcRenderer.invoke('bgp:generateIpv6Routes', config),
    deleteIpv4Routes: config => ipcRenderer.invoke('bgp:deleteIpv4Routes', config),
    deleteIpv6Routes: config => ipcRenderer.invoke('bgp:deleteIpv6Routes', config),
    getRoutes: addressFamily => ipcRenderer.invoke('bgp:getRoutes', addressFamily)
});

// bmp模块
contextBridge.exposeInMainWorld('bmpEmulatorApi', {
    getNetworkInfo: () => ipcRenderer.invoke('bmp-emulator:getNetworkInfo'),
    // Server control
    startServer: config => ipcRenderer.invoke('bmp-emulator:startServer', config),
    stopServer: () => ipcRenderer.invoke('bmp-emulator:stopServer'),
    getServerStatus: () => ipcRenderer.invoke('bmp-emulator:getServerStatus'),

    // Configuration
    saveConfig: config => ipcRenderer.invoke('bmp-emulator:saveConfig', config),
    loadConfig: () => ipcRenderer.invoke('bmp-emulator:loadConfig'),

    // Data retrieval
    getPeers: () => ipcRenderer.invoke('bmp-emulator:getPeers'),
    getRoutes: ipType => ipcRenderer.invoke('bmp-emulator:getRoutes', ipType),

    // Event listeners
    onPeerUpdate: callback => ipcRenderer.on('bmp-emulator:peerUpdate', (_event, data) => callback(_event, data)),
    onRouteUpdate: callback => ipcRenderer.on('bmp-emulator:routeUpdate', (_event, data) => callback(_event, data)),
    onServerLog: callback => ipcRenderer.on('bmp-emulator:serverLog', (_event, data) => callback(_event, data)),
    onInitiationReceived: callback =>
        ipcRenderer.on('bmp-emulator:initiationReceived', (_event, data) => callback(_event, data)),

    // Clean up event listeners
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('bmp-emulator:peerUpdate');
        ipcRenderer.removeAllListeners('bmp-emulator:routeUpdate');
        ipcRenderer.removeAllListeners('bmp-emulator:serverLog');
        ipcRenderer.removeAllListeners('bmp-emulator:initiationReceived');
    }
});
