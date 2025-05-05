<template>
    <div class="rpki-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="rpki-config" tab="RPKI配置" />
                <a-tab-pane key="rpki-roa-config" tab="RPKI ROA配置" />
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

    defineOptions({ name: 'RpkiMain' });

    const router = useRouter();
    const activeTabKey = ref('rpki-config');
    const currentTab = ref(null);

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    const handleTabChange = key => {
        router.push(`/rpki/${key}`);
    };

    onActivated(() => {
        activeTabKey.value = 'rpki-config';
        router.push('/rpki/rpki-config');
    });
</script>

<style scoped>
    .rpki-main-container {
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
