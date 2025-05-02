<template>
    <div class="tool-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange" style="height: 55px">
                <a-tab-pane key="string-generator" tab="字符串生成"></a-tab-pane>
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
    import { ref } from 'vue';
    import { useRouter } from 'vue-router';

    defineOptions({
        name: 'ToolMain'
    });

    const router = useRouter();
    const activeTabKey = ref('string-generator');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/tools/${key}`);
    };

    // Expose clearValidationErrors method to parent component (Main.vue)
    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value && typeof currentTab.value.clearValidationErrors === 'function') {
                currentTab.value.clearValidationErrors();
            }
        }
    });
</script>

<style scoped>
    .tool-main-container {
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
