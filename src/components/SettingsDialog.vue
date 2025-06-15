<template>
    <a-modal
        v-model:open="isVisible"
        :width="680"
        title="设置"
        :footer="null"
        class="settings-dialog"
        :mask-closable="false"
        @cancel="onClose"
    >
        <div class="settings-layout">
            <!-- 左侧分类菜单 -->
            <div class="settings-sidebar">
                <a-menu v-model:selectedKeys="selectedCategory" mode="inline" class="settings-menu">
                    <a-menu-item key="general">
                        <template #icon><SettingOutlined /></template>
                        <span>通用设置</span>
                    </a-menu-item>
                    <a-menu-item key="tools">
                        <template #icon><ToolOutlined /></template>
                        <span>工具设置</span>
                    </a-menu-item>
                    <a-menu-item key="update">
                        <template #icon><CloudDownloadOutlined /></template>
                        <span>应用更新</span>
                    </a-menu-item>
                </a-menu>
            </div>

            <!-- 右侧设置内容区域 -->
            <div class="settings-content">
                <keep-alive>
                    <component :is="currentSettingComponent" />
                </keep-alive>
            </div>
        </div>
    </a-modal>
</template>

<script setup>
    import { ref, computed, watch } from 'vue';
    import { SettingOutlined, ToolOutlined, CloudDownloadOutlined } from '@ant-design/icons-vue';
    import GeneralSettings from '../view/settings/GeneralSettings.vue';
    import ToolsSettings from '../view/settings/ToolsSettings.vue';
    import UpdateSettings from '../view/settings/UpdateSettings.vue';

    const props = defineProps({
        visible: {
            type: Boolean,
            default: false
        }
    });

    const emit = defineEmits(['update:visible', 'close']);

    // Use a local state instead of relying solely on the computed property
    const isVisible = ref(props.visible);

    // Update isVisible when props.visible changes
    watch(
        () => props.visible,
        newValue => {
            isVisible.value = newValue;
        }
    );

    // When isVisible changes, emit the update event
    watch(
        () => isVisible.value,
        newValue => {
            emit('update:visible', newValue);
        }
    );

    const selectedCategory = ref(['general']);

    const currentSettingComponent = computed(() => {
        const category = selectedCategory.value[0];
        switch (category) {
            case 'general':
                return GeneralSettings;
            case 'tools':
                return ToolsSettings;
            case 'update':
                return UpdateSettings;
            default:
                return GeneralSettings;
        }
    });

    const onClose = () => {
        isVisible.value = false;
        emit('close');
    };

    const open = (category = 'general') => {
        selectedCategory.value = [category];
        isVisible.value = true;
    };

    // 暴露方法给父组件
    defineExpose({
        open
    });
</script>

<style scoped>
    .settings-layout {
        display: flex;
        height: 450px;
        overflow: hidden;
    }

    .settings-sidebar {
        width: 180px;
        border-right: 1px solid #f0f0f0;
        height: 100%;
    }

    .settings-menu {
        height: 100%;
        border-right: none;
        font-size: 0.9rem;
    }

    .settings-content {
        flex: 1;
        padding: 16px;
        overflow: auto;
        font-size: 0.9rem;
    }

    :deep(.settings-dialog) {
        font-size: 0.9rem;
    }

    :deep(.ant-modal-header) {
        padding: 12px 16px;
    }

    :deep(.ant-modal-body) {
        padding: 16px;
    }

    :deep(.ant-menu-item) {
        height: 36px;
        line-height: 36px;
    }
</style>
