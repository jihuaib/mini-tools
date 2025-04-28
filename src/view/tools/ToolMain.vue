<template>
    <div class="tool-main-container">
        <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange" style="height: 55px">
            <a-tab-pane key="string-generator" tab="字符串生成"></a-tab-pane>
        </a-tabs>
        <!-- 缓存子页面 -->
        <router-view v-slot="{ Component }">
            <keep-alive :include="$store.state.cachedViews">
                <component :is="Component" ref="currentTab" />
            </keep-alive>
        </router-view>
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
        padding: 5px;
    }
</style>
