const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('../log/logger');
const { DEFAULT_UPDATE_SETTINGS } = require('../const/toolsConst');
const EventDispatcher = require('../utils/eventDispatcher');
const { successResponse } = require('../utils/responseUtils');
class AppUpdater {
    constructor(ipc, mainWindow) {
        this.mainWindow = mainWindow;
        this.ipc = ipc;
        this.updateDownloaded = false;
        this.isDev = !app.isPackaged;
        this.updateSettingsConfig = DEFAULT_UPDATE_SETTINGS;

        // 保存事件监听器引用，便于后续清理
        this.eventListeners = {};
        this.eventDispatcher = new EventDispatcher();
        this.eventDispatcher.setWebContents(this.mainWindow.webContents);

        this.setupAutoUpdater();
        this.registerHandlers();
        this.setupUpdateEvents();
    }

    registerHandlers() {
        this.ipc.handle('updater:checkForUpdates', this.checkForUpdates.bind(this));
        this.ipc.handle('updater:downloadUpdate', this.downloadUpdate.bind(this));
        this.ipc.handle('updater:quitAndInstall', this.quitAndInstall.bind(this));
        this.ipc.handle('updater:getCurrentVersion', this.getCurrentVersion.bind(this));
    }

    setupAutoUpdater() {
        // 配置更新日志
        autoUpdater.logger = logger.raw();

        // 开发环境配置
        if (this.isDev) {
            // 强制在开发环境中启用更新检查
            autoUpdater.forceDevUpdateConfig = true;

            // 设置开发环境的更新配置
            Object.assign(autoUpdater, {
                // 允许降级（开发环境便于测试）
                allowDowngrade: true
            });

            // 设置本地更新配置文件用于测试
            const devConfigPath = path.join(__dirname, '../dev-app-update.yml');
            if (fs.existsSync(devConfigPath)) {
                autoUpdater.updateConfigPath = devConfigPath;
                logger.info('开发环境：使用本地配置文件', devConfigPath);
            }

            logger.info('开发环境：已启用更新检查，forceDevUpdateConfig = true');
        } else {
            // 生产环境配置
            Object.assign(autoUpdater, {
                // 不允许降级（生产环境，防止重命名品牌后旧版本被识别为新版本）
                allowDowngrade: false
            });
        }
    }

    // 应用更新设置
    applyUpdateSettings() {
        // 自动下载更新
        autoUpdater.autoDownload = this.updateSettingsConfig.autoDownload;
        autoUpdater.autoInstallOnAppQuit = true;

        // 启动时检查更新
        if (this.updateSettingsConfig.autoCheckOnStartup) {
            // 延迟一段时间后再检查更新，确保应用完全启动
            setTimeout(() => {
                this.checkForUpdates();
            }, 3000); // 3秒后检查更新
        }

        logger.info('更新设置已应用:', {
            autoDownload: autoUpdater.autoDownload,
            allowDowngrade: autoUpdater.allowDowngrade,
            autoCheckOnStartup: this.updateSettingsConfig.autoCheckOnStartup
        });
    }

    // 动态更新设置
    updateSettings(newSettings) {
        this.updateSettingsConfig = newSettings;
        this.applyUpdateSettings();
        logger.info('更新设置已更新:', this.updateSettingsConfig);
    }

    setupUpdateEvents() {
        // 检查更新时
        this.eventListeners.checkingForUpdate = () => {
            logger.info('正在检查更新...');
            this.sendUpdateStatus('checking-for-update');
        };
        autoUpdater.on('checking-for-update', this.eventListeners.checkingForUpdate);

        // 有可用更新时
        this.eventListeners.updateAvailable = info => {
            logger.info('发现新版本:', info.version);
            this.sendUpdateStatus('update-available', info);
            if (this.updateSettingsConfig.autoDownload) {
                this.sendUpdateStatus('download-started');
            }
        };
        autoUpdater.on('update-available', this.eventListeners.updateAvailable);

        // 没有可用更新时
        this.eventListeners.updateNotAvailable = info => {
            logger.info('当前已是最新版本');
            this.sendUpdateStatus('update-not-available', info);
        };
        autoUpdater.on('update-not-available', this.eventListeners.updateNotAvailable);

        // 更新错误时
        this.eventListeners.error = err => {
            logger.error('更新过程中出现错误:', err);
            this.sendUpdateStatus('update-error', { error: err.message });
        };
        autoUpdater.on('error', this.eventListeners.error);

        // 下载进度
        this.eventListeners.downloadProgress = progressObj => {
            const logMessage = `下载速度: ${progressObj.bytesPerSecond} - 已下载 ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
            logger.info(logMessage);
            this.sendUpdateStatus('download-progress', progressObj);
        };
        autoUpdater.on('download-progress', this.eventListeners.downloadProgress);

        // 更新下载完成
        this.eventListeners.updateDownloaded = info => {
            logger.info('更新下载完成');
            this.updateDownloaded = true;
            this.sendUpdateStatus('update-downloaded', info);
        };
        autoUpdater.on('update-downloaded', this.eventListeners.updateDownloaded);
    }

    // 发送更新状态到渲染进程
    sendUpdateStatus(type, data = {}) {
        this.eventDispatcher.emit('updater:update-status', successResponse({ type, data }));
    }

    // 检查更新
    async checkForUpdates() {
        try {
            logger.info('手动检查更新');
            const result = await autoUpdater.checkForUpdates();
            // 返回简化的结果，避免 IPC 序列化问题
            return {
                success: true,
                updateInfo: result?.updateInfo
                    ? {
                          version: result.updateInfo.version,
                          releaseDate: result.updateInfo.releaseDate
                      }
                    : null
            };
        } catch (error) {
            logger.error('检查更新失败:', error);
            this.sendUpdateStatus('update-error', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 下载更新
    async downloadUpdate() {
        try {
            logger.info('开始下载更新');
            this.sendUpdateStatus('download-started');
            await autoUpdater.downloadUpdate();
        } catch (error) {
            logger.error('下载更新失败:', error);
            this.sendUpdateStatus('update-error', { error: error.message });
        }
    }

    // 退出并安装更新
    quitAndInstall() {
        if (this.updateDownloaded) {
            logger.info('退出应用并安装更新');
            autoUpdater.quitAndInstall();
        } else {
            logger.warn('没有下载的更新可安装');
        }
    }

    // 获取当前版本信息
    getCurrentVersion() {
        return app.getVersion();
    }
}

module.exports = AppUpdater;
