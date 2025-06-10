<template>
    <div class="tools-settings">
        <h2>工具设置</h2>
        <a-form :model="settingsForm" layout="vertical">
            <a-divider>字符串生成</a-divider>

            <a-form-item label="字符串生成历史记录最大存储条数" name="maxStringHistory">
                <a-input-number
                    v-model:value="settingsForm.stringGenerator.maxStringHistory"
                    :min="10"
                    :max="1000"
                    style="width: 100%"
                />
            </a-form-item>

            <a-divider>报文解析</a-divider>

            <a-form-item label="报文解析历史记录最大存储条数" name="maxMessageHistory">
                <a-input-number
                    v-model:value="settingsForm.packetParser.maxMessageHistory"
                    :min="10"
                    :max="1000"
                    style="width: 100%"
                />
            </a-form-item>

            <a-divider>FTP服务器</a-divider>
            <a-form-item label="FTP用户最大存储条数" name="maxFtpUser">
                <a-input-number
                    v-model:value="settingsForm.ftpServer.maxFtpUser"
                    :min="10"
                    :max="1000"
                    style="width: 100%"
                />
            </a-form-item>

            <a-form-item>
                <a-button type="primary" @click="saveSettings">保存设置</a-button>
            </a-form-item>
        </a-form>
    </div>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { message } from 'ant-design-vue';
    import { DEFAULT_TOOLS_SETTINGS } from '../../const/toolsConst';

    // 工具设置组件
    const settingsForm = ref({
        packetParser: {
            maxMessageHistory: DEFAULT_TOOLS_SETTINGS.packetParser.maxMessageHistory
        },
        stringGenerator: {
            maxStringHistory: DEFAULT_TOOLS_SETTINGS.stringGenerator.maxStringHistory
        },
        ftpServer: {
            maxFtpUser: DEFAULT_TOOLS_SETTINGS.ftpServer.maxFtpUser
        }
    });

    // 获取设置
    const getSettings = async () => {
        try {
            const settings = await window.commonApi.getToolsSettings();
            if (settings.status === 'success' && settings.data) {
                if (settings.data.packetParser) {
                    settingsForm.value.packetParser = settings.data.packetParser;
                }
                if (settings.data.stringGenerator) {
                    settingsForm.value.stringGenerator = settings.data.stringGenerator;
                }
            }
        } catch (error) {
            console.error('获取工具设置失败', error);
        }
    };

    // 保存设置
    const saveSettings = async () => {
        try {
            const payload = JSON.parse(JSON.stringify(settingsForm.value));
            await window.commonApi.saveToolsSettings(payload);
            message.success('设置已保存');
        } catch (error) {
            console.error('保存设置失败', error);
            message.error('保存设置失败');
        }
    };

    onMounted(() => {
        getSettings();
    });
</script>

<style scoped>
    .tools-settings {
        max-width: 600px;
    }

    h2 {
        margin-bottom: 10px;
        font-size: 16px;
        font-weight: 500;
    }
    :deep(.ant-form-item) {
        margin-bottom: 8px;
    }

    :deep(.ant-form-item-label > label) {
        font-size: 12px;
    }

    :deep(.ant-divider) {
        font-size: 13px;
        color: #125798;
    }
</style>
