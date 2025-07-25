const packageJson = require('../../package.json');
const { app, dialog, BrowserWindow } = require('electron');
const Store = require('electron-store');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const { DEFAULT_LOG_SETTINGS, DEFAULT_TOOLS_SETTINGS, DEFAULT_UPDATE_SETTINGS } = require('../const/toolsConst');
const fs = require('fs');
const path = require('path');
const BgpApp = require('./bgpApp');
const ToolsApp = require('./toolsApp');
const BmpApp = require('./bmpApp');
const RpkiApp = require('./rpkiApp');
const FtpApp = require('./ftpApp');
const SnmpApp = require('./snmpApp');
const AppUpdater = require('./updater');
const NativeApp = require('./nativeApp');
const FtpConst = require('../const/ftpConst');
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
        this.ftpSettingsFileKey = 'FtpSettings';
        this.updateSettingsFileKey = 'UpdateSettings';
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
        this.bmpApp = new BmpApp(ipc, this.programStore);
        this.rpkiApp = new RpkiApp(ipc, this.programStore);
        this.ftpApp = new FtpApp(ipc, this.programStore);
        this.snmpApp = new SnmpApp(ipc, this.programStore);
        this.updaterApp = new AppUpdater(ipc, win);
        this.nativeApp = new NativeApp(ipc, this.programStore);
        this.toolsApp = new ToolsApp(ipc, this.programStore);
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
        ipc.handle('common:saveFtpSettings', (event, settings) => this.handleSaveFtpSettings(settings));
        ipc.handle('common:getFtpSettings', () => this.handleGetFtpSettings());
        ipc.handle('common:saveUpdateSettings', (event, settings) => this.handleSaveUpdateSettings(settings));
        ipc.handle('common:getUpdateSettings', () => this.handleGetUpdateSettings());
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
            let maxFormatterHistory = DEFAULT_TOOLS_SETTINGS.formatter.maxFormatterHistory;
            if (settings.packetParser && settings.packetParser.maxMessageHistory) {
                maxMessageHistory = settings.packetParser.maxMessageHistory;
            }
            if (settings.stringGenerator && settings.stringGenerator.maxStringHistory) {
                maxStringHistory = settings.stringGenerator.maxStringHistory;
            }
            if (settings.formatter && settings.formatter.maxFormatterHistory) {
                maxFormatterHistory = settings.formatter.maxFormatterHistory;
            }
            this.toolsApp.setMaxMessageHistory(maxMessageHistory);
            this.toolsApp.setMaxStringHistory(maxStringHistory);
            this.nativeApp.setMaxFormatterHistory(maxFormatterHistory);

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

    handleSaveFtpSettings(settings) {
        try {
            this.store.set(this.ftpSettingsFileKey, settings);

            let maxFtpUser = FtpConst.DEFAULT_FTP_SETTINGS.maxFtpUser;
            if (settings.maxFtpUser) {
                maxFtpUser = settings.maxFtpUser;
            }

            this.ftpApp.setMaxFtpUser(maxFtpUser);

            return successResponse(null, 'Settings saved successfully');
        } catch (error) {
            logger.error('Error saving settings:', error.message);
            return errorResponse(error.message);
        }
    }

    handleGetFtpSettings() {
        try {
            const settings = this.store.get(this.ftpSettingsFileKey);
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
      arch: ${process.arch}
      platform: ${process.platform}
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
        let maxFormatterHistory = DEFAULT_TOOLS_SETTINGS.formatter.maxFormatterHistory;
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
        if (toolsSettings && toolsSettings.formatter) {
            if (toolsSettings.formatter.maxFormatterHistory) {
                maxFormatterHistory = toolsSettings.formatter.maxFormatterHistory;
            }
        }
        this.toolsApp.setMaxMessageHistory(maxMessageHistory);
        this.toolsApp.setMaxStringHistory(maxStringHistory);
        this.ftpApp.setMaxFtpUser(maxFtpUser);
        this.nativeApp.setMaxFormatterHistory(maxFormatterHistory);

        // 加载更新设置并应用
        let updateSetting = DEFAULT_UPDATE_SETTINGS;
        const updateSettingsFromStore = this.store.get(this.updateSettingsFileKey);
        if (updateSettingsFromStore) {
            updateSetting = updateSettingsFromStore;
        }
        this.updaterApp.updateSettings(updateSetting);
    }

    async handleWindowClose() {
        const isBgpRunning = this.bgpApp.getBgpRunning();
        const isBmpRunning = this.bmpApp.getBmpRunning();
        const isRpkiRunning = this.rpkiApp.getRpkiRunning();
        const isFtpRunning = this.ftpApp.getFtpRunning();
        const isSnmpRunning = this.snmpApp.getSnmpRunning();
        const isNativeRunning = this.nativeApp.getPacketCaptureRunning();

        if (isBgpRunning || isBmpRunning || isRpkiRunning || isFtpRunning || isSnmpRunning || isNativeRunning) {
            const { response } = await dialog.showMessageBox(this.win, {
                type: 'warning',
                title: '确认关闭',
                message: 'MiniTools 正在运行，确定要关闭吗？',
                buttons: ['确定', '取消'],
                defaultId: 1,
                cancelId: 1
            });

            if (response === 0) {
                // 用户点击确定，先停止 MiniTools 然后关闭窗口
                if (isBgpRunning) {
                    await this.bgpApp.handleStopBgp();
                }
                if (isBmpRunning) {
                    await this.bmpApp.handleStopBmp();
                }
                if (isRpkiRunning) {
                    await this.rpkiApp.handleStopRpki();
                }
                if (isFtpRunning) {
                    await this.ftpApp.handleStopFtp();
                }
                if (isSnmpRunning) {
                    await this.snmpApp.handleStopSnmp();
                }
                if (isNativeRunning) {
                    await this.nativeApp.handleStopPacketCapture();
                }

                return true;
            }
            return false;
        }

        return true;
    }

    async handleSelectDirectory() {
        try {
            const win = BrowserWindow.getFocusedWindow(); // 获取当前窗口
            const result = await dialog.showOpenDialog(win, {
                properties: ['openDirectory']
            });
            return successResponse(result);
        } catch (error) {
            logger.error('Error selecting directory:', error.message);
            return errorResponse(error.message);
        }
    }

    handleSaveUpdateSettings(settings) {
        try {
            this.store.set(this.updateSettingsFileKey, settings);
            // 更新AppUpdater的设置
            this.updaterApp.updateSettings(settings);
            return successResponse(null, 'Update settings saved successfully');
        } catch (error) {
            logger.error('Error saving update settings:', error.message);
            return errorResponse(error.message);
        }
    }

    handleGetUpdateSettings() {
        try {
            const settings = this.store.get(this.updateSettingsFileKey);
            if (!settings) {
                return successResponse(DEFAULT_UPDATE_SETTINGS, 'Default update settings loaded');
            }
            return successResponse(settings, 'Update settings loaded successfully');
        } catch (error) {
            logger.error('Error getting update settings:', error.message);
            return errorResponse(error.message);
        }
    }
}

module.exports = SystemApp;
