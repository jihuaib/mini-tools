const packageJson = require('../../package.json');
const { app, dialog } = require('electron');
/**
 * 用于系统菜单处理
 */
class SystemMenuApp {
    constructor(ipc, win) {
        this.win = win;
        this.isDev = !app.isPackaged;
        // 注册IPC处理程序
        this.registerHandlers(ipc);
    }

    registerHandlers(ipc) {
        ipc.on('common:openDeveloperOptions', () => this.handleOpenDeveloperOptions());
        ipc.on('common:openSoftwareInfo', () => this.handleOpenSoftwareInfo());
    }

    handleOpenDeveloperOptions() {
        this.win.webContents.openDevTools();
    }

    showSoftwareInfo() {
        const aboutMessage = `
      Version: ${packageJson.version}
      Author: ${packageJson.author.name}
      Email: ${packageJson.author.email}
      Environment: ${this.isDev ? 'Development' : 'Production'}
      Electron: ${process.versions.electron}
      Node.js: ${process.versions.node}
      Chrome: ${process.versions.chrome}`;

        dialog.showMessageBox({
            type: 'info',
            title: 'About MiniTools',
            message: aboutMessage,
            buttons: ['OK']
        });
    }

    handleOpenSoftwareInfo() {
        this.showSoftwareInfo();
    }
}

module.exports = SystemMenuApp;
