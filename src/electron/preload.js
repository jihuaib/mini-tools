const { contextBridge, ipcRenderer } = require('electron');

// 字符串生成模块
contextBridge.exposeInMainWorld('stringGeneratorApi', {
    generateString: templateData => ipcRenderer.invoke('string-generator:generateString', templateData),
    saveConfig: config => ipcRenderer.invoke('string-generator:saveConfig', config),
    loadConfig: () => ipcRenderer.invoke('string-generator:loadConfig')
});

// bgp模块
contextBridge.exposeInMainWorld('bgpEmulatorApi', {
    getNetworkInfo: () => ipcRenderer.invoke('bgp-emulator:getNetworkInfo'),
    startBgp: bgpData => ipcRenderer.invoke('bgp-emulator:startBgp', bgpData),
    updatePeerState: callback => ipcRenderer.on('bgp-emulator:updatePeerState', (_event, data) => callback(data)),
    saveConfig: config => ipcRenderer.invoke('bgp-emulator:saveConfig', config),
    loadConfig: () => ipcRenderer.invoke('bgp-emulator:loadConfig'),
    stopBgp: () => ipcRenderer.invoke('bgp-emulator:stopBgp'),
    sendRoutes: config => ipcRenderer.invoke('bgp-emulator:sendRoute', config),
    withdrawRoutes: config => ipcRenderer.invoke('bgp-emulator:withdrawRoute', config),
    pushMsg: callback => ipcRenderer.on('bgp-emulator:pushMsg', (_event, data) => callback(data))
});
