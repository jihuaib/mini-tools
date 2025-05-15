const packageJson = require('../../package.json');
const { app, dialog } = require('electron');
const Store = require('electron-store');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const { DEFAULT_LOG_SETTINGS, DEFAULT_TOOLS_SETTINGS } = require('../const/toolsConst');
const fs = require('fs');
const path = require('path');
const BgpApp = require('./bgpApp');
const ToolsApp = require('./toolsApp');
const BmpApp = require('./bmpApp');
const RpkiApp = require('./rpkiApp');
const FtpApp = require('./ftpApp');
/**
 * 用于系统菜单处理
 */
class SystemApp {
    constructor(ipc, win) {
        this.win = win;
        this.isDev = !app.isPackaged;
        // 注册IPC处理程序
        this.registerHandlers(ipc);
        this.generalSettingsFileKey = 'GeneralSettings';
        this.toolsSettingsFileKey = 'ToolsSettings';
        this.appVersionFileKey = 'appVersion';

        this.store = new Store({
            name: 'Settings Data',
            fileExtension: 'json',
            cwd: app.getPath('userData')
        });

        this.programStore = new Store({
            name: 'Program Data',
            fileExtension: 'json',
            cwd: app.getPath('userData')
        });

        this.bgpApp = new BgpApp(ipc, this.programStore);
        this.toolsApp = new ToolsApp(ipc, this.programStore);
        this.bmpApp = new BmpApp(ipc, this.programStore);
        this.rpkiApp = new RpkiApp(ipc, this.programStore);
        this.ftpApp = new FtpApp(ipc, this.programStore);
    }

    // 添加版本兼容性检查方法
    checkVersionCompatibility() {
        try {
            // 获取当前版本
            const currentVersion = packageJson.version;
            logger.warn('当前版本: ' + currentVersion);

            // 获取存储的上一个版本
            const storedVersion = this.store.get(this.appVersionFileKey);
            logger.warn('存储版本: ' + storedVersion);

            // 如果是首次运行或版本信息丢失，保存当前版本并退出
            if (!storedVersion) {
                this.clearIncompatibleData();
                this.store.set(this.appVersionFileKey, currentVersion);
                return true;
            }

            // 检查版本是否不兼容 (对主版本号的变化进行检查)
            const currentMajorVersion = parseInt(currentVersion.split('.')[0]);
            const storedMajorVersion = parseInt(storedVersion.split('.')[0]);

            if (currentMajorVersion > storedMajorVersion) {
                logger.warn(`检测到不兼容升级: ${storedVersion} -> ${currentVersion}`);

                // 显示确认对话框
                const result = dialog.showMessageBoxSync({
                    type: 'warning',
                    title: '版本不兼容',
                    message: `检测到主版本升级（${storedVersion} -> ${currentVersion}），需要清除旧数据。`,
                    detail: '将删除程序数据和设置数据，点击确定继续。',
                    buttons: ['确定', '取消'],
                    defaultId: 0,
                    cancelId: 1
                });

                if (result === 0) {
                    // 用户选择确定，清除数据
                    this.clearIncompatibleData();
                    // 更新存储的版本
                    this.store.set(this.appVersionFileKey, currentVersion);
                    return true;
                } else {
                    return false;
                }
            } else {
                // 兼容版本升级，只更新版本号
                if (currentVersion !== storedVersion) {
                    this.store.set(this.appVersionFileKey, currentVersion);
                }
                return true;
            }
        } catch (error) {
            logger.error('检查版本兼容性时出错:', error.message);
            return false;
        }
    }

    // 添加清除不兼容数据的方法
    clearIncompatibleData() {
        try {
            logger.warn('清除不兼容数据');
            const userData = app.getPath('userData');

            // 删除 Program Data
            const programDataPath = path.join(userData, 'Program Data.json');
            if (fs.existsSync(programDataPath)) {
                fs.unlinkSync(programDataPath);
                logger.warn('已删除 Program Data.json');
            }

            // 删除 Settings Data
            const settingsDataPath = path.join(userData, 'Settings Data.json');
            if (fs.existsSync(settingsDataPath)) {
                fs.unlinkSync(settingsDataPath);
                logger.warn('已删除 Settings Data.json');
            }

            // 重新初始化 Store
            this.store = new Store({
                name: 'Settings Data',
                fileExtension: 'json',
                cwd: app.getPath('userData')
            });

            this.programStore = new Store({
                name: 'Program Data',
                fileExtension: 'json',
                cwd: app.getPath('userData')
            });
        } catch (error) {
            logger.error('清除不兼容数据时出错:', error.message);
            dialog.showMessageBoxSync({
                type: 'error',
                title: '错误',
                message: '清除数据时出错',
                detail: error.message,
                buttons: ['确定']
            });
        }
    }

    registerHandlers(ipc) {
        ipc.on('common:openDeveloperOptions', () => this.handleOpenDeveloperOptions());
        ipc.on('common:openSoftwareInfo', () => this.handleOpenSoftwareInfo());
        ipc.handle('common:saveGeneralSettings', (event, settings) => this.handleSaveGeneralSettings(settings));
        ipc.handle('common:getGeneralSettings', () => this.handleGetGeneralSettings());
        ipc.handle('common:saveToolsSettings', (event, settings) => this.handleSaveToolsSettings(settings));
        ipc.handle('common:getToolsSettings', () => this.handleGetToolsSettings());
        ipc.handle('common:selectDirectory', () => this.handleSelectDirectory());
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
            let maxFtpUser = DEFAULT_TOOLS_SETTINGS.ftpServer.maxFtpUser;
            if (settings.packetParser && settings.packetParser.maxMessageHistory) {
                maxMessageHistory = settings.packetParser.maxMessageHistory;
            }
            if (settings.stringGenerator && settings.stringGenerator.maxStringHistory) {
                maxStringHistory = settings.stringGenerator.maxStringHistory;
            }
            if (settings.ftpServer && settings.ftpServer.maxFtpUser) {
                maxFtpUser = settings.ftpServer.maxFtpUser;
            }
            this.toolsApp.setMaxMessageHistory(maxMessageHistory);
            this.toolsApp.setMaxStringHistory(maxStringHistory);
            this.ftpApp.setMaxFtpUser(maxFtpUser);

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
        let maxFtpUser = DEFAULT_TOOLS_SETTINGS.ftpServer.maxFtpUser;
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
        if (toolsSettings && toolsSettings.ftpServer) {
            if (toolsSettings.ftpServer.maxFtpUser) {
                maxFtpUser = toolsSettings.ftpServer.maxFtpUser;
            }
        }
        this.toolsApp.setMaxMessageHistory(maxMessageHistory);
        this.toolsApp.setMaxStringHistory(maxStringHistory);
        this.ftpApp.setMaxFtpUser(maxFtpUser);
    }

    async handleWindowClose() {
        const closeBgpOk = await this.bgpApp.handleWindowClose(this.win);
        if (!closeBgpOk) {
            return false;
        }

        return true;
    }

    async handleSelectDirectory() {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            return successResponse(result);
        } catch (error) {
            logger.error('Error selecting directory:', error.message);
            return errorResponse(error.message);
        }
    }
}

module.exports = SystemApp;
