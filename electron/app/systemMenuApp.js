const packageJson = require('../../package.json');
const { app, dialog } = require('electron');
const Store = require('electron-store');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const { DEFAULT_LOG_SETTINGS, DEFAULT_TOOLS_SETTINGS } = require('../const/toolsConst');
/**
 * 用于系统菜单处理
 */
class SystemMenuApp {
    constructor(ipc, win, toolsApp) {
        this.win = win;
        this.isDev = !app.isPackaged;
        // 注册IPC处理程序
        this.registerHandlers(ipc);
        this.generalSettingsFileKey = 'GeneralSettings';
        this.toolsSettingsFileKey = 'ToolsSettings';

        this.store = new Store({
            name: 'Settings Data',
            fileExtension: 'json',
            cwd: app.getPath('userData')
        });

        this.toolsApp = toolsApp;
    }

    registerHandlers(ipc) {
        ipc.on('common:openDeveloperOptions', () => this.handleOpenDeveloperOptions());
        ipc.on('common:openSoftwareInfo', () => this.handleOpenSoftwareInfo());
        ipc.handle('common:saveGeneralSettings', (event, settings) => this.handleSaveGeneralSettings(settings));
        ipc.handle('common:getGeneralSettings', () => this.handleGetGeneralSettings());
        ipc.handle('common:saveToolsSettings', (event, settings) => this.handleSaveToolsSettings(settings));
        ipc.handle('common:getToolsSettings', () => this.handleGetToolsSettings());
    }

    handleSaveGeneralSettings(settings) {
        try {
            this.store.set(this.generalSettingsFileKey, settings);

            if (settings.logLevel) {
                logger.raw().transports.file.level = settings.logLevel;
            }
            return successResponse(null, 'Settings saved successfully');
        } catch (error) {
            logger.error('Error saving settings:', error.message);
            return errorResponse(error.message);
        }
    }

    handleGetGeneralSettings() {
        try {
            const settings = this.store.get(this.generalSettingsFileKey);
            if (!settings) {
                return successResponse(null, 'Settings not found');
            }
            return successResponse(settings, 'Settings loaded successfully');
        } catch (error) {
            logger.error('Error getting settings:', error.message);
            return errorResponse(error.message);
        }
    }

    handleSaveToolsSettings(settings) {
        try {
            this.store.set(this.toolsSettingsFileKey, settings);

            let maxMessageHistory = DEFAULT_TOOLS_SETTINGS.packetParser.maxMessageHistory;
            let maxStringHistory = DEFAULT_TOOLS_SETTINGS.stringGenerator.maxStringHistory;
            if (settings.packetParser && settings.packetParser.maxMessageHistory) {
                maxMessageHistory = settings.packetParser.maxMessageHistory;
            }
            if (settings.stringGenerator && settings.stringGenerator.maxStringHistory) {
                maxStringHistory = settings.stringGenerator.maxStringHistory;
            }
            this.toolsApp.setMaxMessageHistory(maxMessageHistory);
            this.toolsApp.setMaxStringHistory(maxStringHistory);

            return successResponse(null, 'Settings saved successfully');
        } catch (error) {
            logger.error('Error saving settings:', error.message);
            return errorResponse(error.message);
        }
    }

    handleGetToolsSettings() {
        try {
            const settings = this.store.get(this.toolsSettingsFileKey);
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
        const settings = this.store.get(this.generalSettingsFileKey);

        // 加载通用设置
        let logLevel = DEFAULT_LOG_SETTINGS.logLevel;
        if (settings) {
            if (settings.logLevel) {
                logLevel = settings.logLevel;
            }
        }
        logger.raw().transports.file.level = logLevel;

        // 加载工具设置
        let maxMessageHistory = DEFAULT_TOOLS_SETTINGS.packetParser.maxMessageHistory;
        let maxStringHistory = DEFAULT_TOOLS_SETTINGS.stringGenerator.maxStringHistory;
        const toolsSettings = this.store.get(this.toolsSettingsFileKey);
        if (toolsSettings && toolsSettings.packetParser) {
            if (toolsSettings.packetParser.maxMessageHistory) {
                maxMessageHistory = toolsSettings.packetParser.maxMessageHistory;
            }
        }
        if (toolsSettings && toolsSettings.stringGenerator) {
            if (toolsSettings.stringGenerator.maxStringHistory) {
                maxStringHistory = toolsSettings.stringGenerator.maxStringHistory;
            }
        }
        this.toolsApp.setMaxMessageHistory(maxMessageHistory);
        this.toolsApp.setMaxStringHistory(maxStringHistory);
    }
}

module.exports = SystemMenuApp;
