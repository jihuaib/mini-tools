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
    savePeerConfig: config => ipcRenderer.invoke('bgp:savePeerConfig', config),
    loadPeerConfig: () => ipcRenderer.invoke('bgp:loadPeerConfig'),

    // bgp
    startBgp: bgpConfigData => ipcRenderer.invoke('bgp:startBgp', bgpConfigData),
    stopBgp: () => ipcRenderer.invoke('bgp:stopBgp'),

    // peer
    configPeer: peerConfigData => ipcRenderer.invoke('bgp:configPeer', peerConfigData),
    onPeerChange: callback => ipcRenderer.on('bgp:peerChange', (_event, data) => callback(data)),
    getPeerInfo: () => ipcRenderer.invoke('bgp:getPeerInfo'),

    // route
    sendRoutes: config => ipcRenderer.invoke('bgp:sendRoute', config),
    withdrawRoutes: config => ipcRenderer.invoke('bgp:withdrawRoute', config)
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
