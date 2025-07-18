<template>
    <div class="update-settings">
        <h2>应用更新</h2>
        <!-- 当前版本信息 -->
        <a-row class="version-info">
            <a-col :span="12">
                <a-statistic title="当前版本" :value="currentVersion" />
            </a-col>
            <a-col :span="12">
                <a-statistic title="更新状态" :value="updateStatusText" />
            </a-col>
        </a-row>

        <!-- 更新检查按钮 -->
        <div class="update-actions">
            <a-space>
                <a-button type="primary" :loading="isChecking" :disabled="isDownloading" @click="checkForUpdates">
                    检查更新
                </a-button>
                <a-button
                    v-if="updateAvailable && !isDownloading && !updateDownloaded"
                    type="default"
                    @click="downloadUpdate"
                >
                    下载更新
                </a-button>
                <a-button v-if="updateDownloaded" type="danger" @click="installUpdate">重启并安装</a-button>
            </a-space>
        </div>

        <!-- 自动更新设置 -->
        <a-divider>自动更新设置</a-divider>
        <div class="auto-update-settings">
            <a-form layout="vertical">
                <a-form-item label="启动时检查更新">
                    <a-switch v-model:checked="updateSettings.autoCheckOnStartup" @change="saveAutoUpdateSettings" />
                    <div class="setting-description">启用后，应用启动时会自动检查更新</div>
                </a-form-item>
                <a-form-item label="自动下载更新">
                    <a-switch v-model:checked="updateSettings.autoDownload" @change="saveAutoUpdateSettings" />
                    <div class="setting-description">启用后，发现更新时会自动下载（仍需手动安装）</div>
                </a-form-item>
            </a-form>
        </div>
    </div>
</template>

<script setup>
    import { ref, onMounted, onUnmounted } from 'vue';
    import { message } from 'ant-design-vue';

    defineOptions({
        name: 'UpdateSettings'
    });

    // 响应式数据
    const currentVersion = ref('');
    const updateAvailable = ref(false);
    const updateDownloaded = ref(false);
    const isChecking = ref(false);
    const isDownloading = ref(false);
    const downloadProgress = ref({});
    const updateStatusText = ref('未检查');

    const updateSettings = ref({
        autoCheckOnStartup: true,
        autoDownload: false
    });

    // 获取当前版本
    const getCurrentVersion = async () => {
        try {
            if (window.updaterApi) {
                currentVersion.value = await window.updaterApi.getCurrentVersion();
            }
        } catch (error) {
            console.error('获取版本信息失败:', error);
            currentVersion.value = '未知版本';
        }
    };

    // 检查更新
    const checkForUpdates = async () => {
        if (!window.updaterApi) {
            message.warning('更新功能仅在生产环境中可用');
            return;
        }

        isChecking.value = true;
        updateStatusText.value = '检查中...';

        try {
            const result = await window.updaterApi.checkForUpdates();
            if (result) {
                updateStatusText.value = '检查完成';
                message.success('更新检查完成');
            } else {
                updateStatusText.value = '检查失败';
            }
        } catch (error) {
            console.error('检查更新失败:', error);
            message.error('检查更新失败: ' + error.message);
            updateStatusText.value = '检查失败';
        } finally {
            isChecking.value = false;
        }
    };

    // 下载更新
    const downloadUpdate = async () => {
        if (!window.updaterApi) {
            message.warning('更新功能仅在生产环境中可用');
            return;
        }

        isDownloading.value = true;

        try {
            await window.updaterApi.downloadUpdate();
        } catch (error) {
            console.error('下载更新失败:', error);
            isDownloading.value = false;
            message.error('下载更新失败: ' + error.message);
        }
    };

    // 安装更新
    const installUpdate = async () => {
        if (!window.updaterApi) {
            message.warning('更新功能仅在生产环境中可用');
            return;
        }

        try {
            await window.updaterApi.quitAndInstall();
        } catch (error) {
            console.error('安装更新失败:', error);
            message.error('安装更新失败: ' + error.message);
        }
    };

    // 处理更新状态
    const handleUpdateStatus = respData => {
        if (respData.status !== 'success') {
            message.error('检查更新失败');
            return;
        }
        const { type, data } = respData.data;

        switch (type) {
            case 'checking-for-update':
                updateStatusText.value = '检查中...';
                break;
            case 'update-available':
                updateAvailable.value = true;
                updateStatusText.value = `发现新版本 ${data.version}`;
                message.info(`发现新版本 ${data.version}`);
                break;
            case 'update-not-available':
                updateAvailable.value = false;
                updateStatusText.value = '已是最新版本';
                message.success('当前已是最新版本');
                break;
            case 'download-started':
                isDownloading.value = true;
                updateStatusText.value = '下载中...';
                break;
            case 'download-progress':
                downloadProgress.value = data;
                updateStatusText.value = `下载中... ${Math.round(data.percent || 0)}%`;
                break;
            case 'update-downloaded':
                isDownloading.value = false;
                updateDownloaded.value = true;
                updateStatusText.value = '下载完成，可以安装';
                message.success('更新下载完成，可以安装');
                break;
            case 'update-error':
                isDownloading.value = false;
                message.error('更新过程中发生错误: ' + data.error);
                updateStatusText.value = '更新失败';
                break;
        }
    };

    // 保存自动更新设置
    const saveAutoUpdateSettings = async () => {
        try {
            if (!updateSettings.value.autoCheckOnStartup) {
                updateSettings.value.autoDownload = false;
            }
            const settings = {
                autoCheckOnStartup: updateSettings.value.autoCheckOnStartup,
                autoDownload: updateSettings.value.autoDownload
            };

            // 这里可以保存到本地设置
            window.commonApi.saveUpdateSettings(settings);
            message.success('设置已保存');
        } catch (error) {
            console.error('保存设置失败:', error);
            message.error('保存设置失败');
        }
    };

    // 加载自动更新设置
    const loadAutoUpdateSettings = async () => {
        try {
            const resp = await window.commonApi.getUpdateSettings();
            if (resp.status === 'success') {
                updateSettings.value = resp.data;
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    };

    // 组件挂载时初始化
    onMounted(() => {
        getCurrentVersion();
        loadAutoUpdateSettings();

        // 监听更新状态
        if (window.updaterApi) {
            window.updaterApi.onUpdateStatus(handleUpdateStatus);
        }
    });

    // 组件卸载时清理
    onUnmounted(() => {
        if (window.updaterApi) {
            window.updaterApi.offUpdateStatus(handleUpdateStatus);
        }
    });
</script>

<style scoped>
    .update-settings {
        max-width: 100%;
    }
    h2 {
        margin-bottom: 10px;
        font-size: 16px;
        font-weight: 500;
    }
    .version-info {
        margin-bottom: 24px;
    }

    .update-actions {
        margin-bottom: 20px;
    }

    .update-info {
        margin-bottom: 20px;
    }

    .download-progress {
        margin-bottom: 20px;
    }

    .progress-info {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 12px;
        color: #666;
    }

    .auto-update-settings h4 {
        margin-bottom: 16px;
        color: #333;
    }

    .setting-description {
        margin-top: 4px;
        font-size: 12px;
        color: #666;
    }

    :deep(.ant-statistic-title) {
        color: #666;
        font-size: 14px;
    }

    :deep(.ant-statistic-content) {
        color: #333;
        font-size: 18px;
        font-weight: 500;
    }

    :deep(.ant-form-item-label > label) {
        font-size: 12px;
    }
</style>
