const { contextBridge, ipcRenderer } = require('electron')

// 字符串生成模块
contextBridge.exposeInMainWorld('stringGeneratorApi', {
    generateTemplateString: (templateData) => ipcRenderer.invoke('generate-template-string', templateData),
})

// bgp模块
contextBridge.exposeInMainWorld('bgpEmulatorApi', {
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
    startBgp: (bgpData) => ipcRenderer.send('start-bgp', bgpData),
    updateBgpData: (callback) => ipcRenderer.on('update-bgp-data', (_event, data) => callback(data)),
})