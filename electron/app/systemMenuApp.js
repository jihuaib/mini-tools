const packageJson = require('../../package.json');
const { app, dialog } = require('electron');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
/**
 * 用于系统菜单处理
 */
class SystemMenuApp {
    constructor(ipc, win, store) {
        this.win = win;
        this.isDev = !app.isPackaged;
        // 注册IPC处理程序
        this.registerHandlers(ipc);
        this.settingsFileKey = 'settings';
        this.store = store;
    }

    registerHandlers(ipc) {
        ipc.on('common:openDeveloperOptions', () => this.handleOpenDeveloperOptions());
        ipc.on('common:openSoftwareInfo', () => this.handleOpenSoftwareInfo());
        ipc.handle('common:saveSettings', (event, settings) => this.handleSaveSettings(settings));
        ipc.handle('common:getSettings', () => this.handleGetSettings());
    }

    handleSaveSettings(settings) {
        try {
            this.store.set(this.settingsFileKey, settings);

            if (settings.logLevel) {
                logger.raw().transports.file.level = settings.logLevel;
            }
            return successResponse(null, 'Settings saved successfully');
        } catch (error) {
            logger.error('Error saving settings:', error.message);
            return errorResponse(error.message);
        }
    }

    handleGetSettings() {
        try {
            const settings = this.store.get(this.settingsFileKey);
            if (!settings) {
                return successResponse(null, 'Settings not found');
            }
            return successResponse(settings, 'Settings loaded successfully');
        } catch (error) {
            logger.error('Error getting settings:', error.message);
            return errorResponse(error.message);
        }
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

    loadSettings() {
        const settings = this.store.get(this.settingsFileKey);
        if (settings) {
            if (settings.logLevel) {
                logger.raw().transports.file.level = settings.logLevel;
            }
        } else {
            // 默认设置
            if (this.isDev) {
                logger.raw().transports.file.level = 'info';
            } else {
                logger.raw().transports.file.level = 'warn';
            }
        }
    }
}

module.exports = SystemMenuApp;
