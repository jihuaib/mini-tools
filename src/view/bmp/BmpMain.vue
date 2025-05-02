<template>
    <div class="bmp-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="bmp-config" tab="BMP配置" />
                <a-tab-pane key="bmp-peer" tab="BMP邻居" />
                <a-tab-pane key="bmp-route" tab="BMP路由" />
            </a-tabs>
        </div>

        <!-- 可滚动内容区域 -->
        <div class="content-container">
            <router-view v-slot="{ Component }">
                <keep-alive :include="$store.state.cachedViews">
                    <component :is="Component" ref="currentTab" />
                </keep-alive>
            </router-view>
        </div>
    </div>
</template>

<script setup>
    import { ref, onActivated } from 'vue';
    import { useRouter } from 'vue-router';

    defineOptions({ name: 'BmpMain' });

    const router = useRouter();
    const activeTabKey = ref('bmp-config');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/bmp/${key}`);
    };

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    onActivated(() => {
        activeTabKey.value = 'bmp-config';
        router.push('/bmp/bmp-config');
    });
</script>

<style scoped>
    .bmp-main-container {
        display: flex;
        flex-direction: column;
        height: 100vh; /* 确保撑满屏幕 */
        overflow: hidden;
    }

    .fixed-tabs {
        height: 48px; /* 你实际 Tab 高度 */
        flex-shrink: 0;
        background-color: #fff;
        z-index: 10;
        margin-left: 8px;
    }

    .content-container {
        flex: 1;
        overflow-y: auto;
    }
</style>
