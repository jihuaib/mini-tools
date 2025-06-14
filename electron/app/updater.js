const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('../log/logger');
const { DEFAULT_UPDATE_SETTINGS } = require('../const/toolsConst');

class AppUpdater {
    constructor(ipc, mainWindow) {
        this.mainWindow = mainWindow;
        this.ipc = ipc;
        this.updateDownloaded = false;
        this.isDev = !app.isPackaged;
        this.updateSettingsConfig = DEFAULT_UPDATE_SETTINGS;

        this.setupAutoUpdater();
        this.registerHandlers();
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
                // 允许降级
                allowDowngrade: true
            });

            // 设置本地更新配置文件用于测试
            const devConfigPath = path.join(__dirname, 'dev-app-update.yml');
            if (fs.existsSync(devConfigPath)) {
                autoUpdater.updateConfigPath = devConfigPath;
                logger.info('开发环境：使用本地配置文件', devConfigPath);
            }

            logger.info('开发环境：已启用更新检查，forceDevUpdateConfig = true');
        }
    }

    // 应用更新设置
    applyUpdateSettings() {
        // 自动下载更新
        autoUpdater.autoDownload = this.updateSettingsConfig.autoDownload;
        autoUpdater.autoInstallOnAppQuit = true;

        // 允许降级
        autoUpdater.allowDowngrade = true;

        // 启动时检查更新
        if (this.updateSettingsConfig.autoCheckOnStartup) {
            // 设置更新事件监听器
            this.setupUpdateEvents();
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
        autoUpdater.on('checking-for-update', () => {
            logger.info('正在检查更新...');
            this.sendUpdateStatus('checking-for-update');
        });

        // 有可用更新时
        autoUpdater.on('update-available', info => {
            logger.info('发现新版本:', info.version);
            this.sendUpdateStatus('update-available', info);
            if (this.updateSettingsConfig.autoDownload) {
                this.sendUpdateStatus('download-started');
            }
        });

        // 没有可用更新时
        autoUpdater.on('update-not-available', info => {
            logger.info('当前已是最新版本');
            this.sendUpdateStatus('update-not-available', info);
        });

        // 更新错误时
        autoUpdater.on('error', err => {
            logger.error('更新过程中出现错误:', err);
            this.sendUpdateStatus('update-error', { error: err.message });
        });

        // 下载进度
        autoUpdater.on('download-progress', progressObj => {
            const logMessage = `下载速度: ${progressObj.bytesPerSecond} - 已下载 ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
            logger.info(logMessage);
            this.sendUpdateStatus('download-progress', progressObj);
        });

        // 更新下载完成
        autoUpdater.on('update-downloaded', info => {
            logger.info('更新下载完成');
            this.updateDownloaded = true;
            this.sendUpdateStatus('update-downloaded', info);
        });
    }

    // 发送更新状态到渲染进程
    sendUpdateStatus(type, data = {}) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('update-status', { type, data });
        }
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
