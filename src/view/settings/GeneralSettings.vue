<template>
    <div class="general-settings">
        <a-card title="主题设置" style="margin-bottom: 16px">
            <div class="theme-selector">
                <div
                    v-for="theme in themeList"
                    :key="theme.id"
                    class="theme-card"
                    :class="{ active: currentTheme === theme.id }"
                    @click="selectTheme(theme.id)"
                >
                    <div class="theme-preview" :style="{ background: theme.colors.gradient }"/>
                    <div class="theme-name">{{ theme.name }}</div>
                    <div v-if="currentTheme === theme.id" class="theme-check">✓</div>
                </div>
            </div>
        </a-card>

        <a-card title="通用设置">
            <a-form :model="settingsForm" layout="vertical">
                <a-form-item label="日志级别" name="logLevel">
                    <a-select v-model:value="settingsForm.logLevel" style="width: 100%">
                        <a-select-option value="debug">debug</a-select-option>
                        <a-select-option value="info">info</a-select-option>
                        <a-select-option value="warn">warn</a-select-option>
                        <a-select-option value="error">error</a-select-option>
                    </a-select>
                </a-form-item>

                <a-form-item>
                    <a-button type="primary" @click="saveSettings">保存设置</a-button>
                </a-form-item>
            </a-form>
        </a-card>
    </div>
</template>

<script setup>
    import { ref, onMounted, computed } from 'vue';
    import { useStore } from 'vuex';
    import { message } from 'ant-design-vue';
    import { DEFAULT_LOG_SETTINGS } from '../../const/toolsConst';
    import { themes } from '../../utils/themes';

    const store = useStore();

    const settingsForm = ref({
        logLevel: DEFAULT_LOG_SETTINGS.logLevel
    });

    const themeList = Object.values(themes);
    const currentTheme = computed(() => store.state.theme.currentTheme);

    const selectTheme = themeId => {
        store.dispatch('theme/setTheme', themeId);
        message.success('主题已切换');
    };

    // 获取设置
    const getSettings = async () => {
        try {
            const settings = await window.commonApi.getGeneralSettings();
            if (settings.status === 'success' && settings.data) {
                settingsForm.value = settings.data;
            }
        } catch (error) {
            console.error('获取设置失败', error);
        }
    };

    // 保存设置
    const saveSettings = async () => {
        try {
            const payload = JSON.parse(JSON.stringify(settingsForm.value));
            await window.commonApi.saveGeneralSettings(payload);
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
    .general-settings {
        max-width: 100%;
    }

    .theme-selector {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 16px;
    }

    .theme-card {
        cursor: pointer;
        border: 2px solid #f0f0f0;
        border-radius: 8px;
        padding: 12px;
        transition: all 0.3s ease;
        position: relative;
    }

    .theme-card:hover {
        border-color: #d9d9d9;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .theme-card.active {
        border-color: var(--theme-primary, #667eea);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .theme-preview {
        height: 60px;
        border-radius: 6px;
        margin-bottom: 8px;
    }

    .theme-name {
        text-align: center;
        font-size: 13px;
        font-weight: 500;
    }

    .theme-check {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        background: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--theme-primary, #667eea);
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    :deep(.ant-form-item-label > label) {
        font-size: 12px;
    }
</style>
