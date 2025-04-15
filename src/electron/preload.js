const { contextBridge, ipcRenderer } = require('electron')

// 字符串生成模块
contextBridge.exposeInMainWorld('stringGeneratorApi', {
    generateTemplateString: (templateData) => ipcRenderer.invoke('generate-template-string', templateData),
    saveStringGeneratorConfig: (config) => ipcRenderer.invoke('save-string-generator-config', config),
    loadStringGeneratorConfig: () => ipcRenderer.invoke('load-string-generator-config'),
})

// bgp模块
contextBridge.exposeInMainWorld('bgpEmulatorApi', {
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
    startBgp: (bgpData) => ipcRenderer.send('start-bgp', bgpData),
    updateBgpData: (callback) => ipcRenderer.on('update-bgp-data', (_event, data) => callback(data)),
    saveBgpConfig: (config) => ipcRenderer.invoke('save-bgp-config', config),
    loadBgpConfig: () => ipcRenderer.invoke('load-bgp-config'),
    stopBgp: () => ipcRenderer.invoke('stop-bgp'),
})