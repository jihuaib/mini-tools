<template>
    <div class="mt-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="bgp-config" tab="BGP配置" />
                <a-tab-pane key="bgp-peer-info" tab="邻居信息" />
                <a-tab-pane key="route-config" tab="路由配置" />
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

    defineOptions({ name: 'BgpMain' });

    const router = useRouter();
    const activeTabKey = ref('bgp-config');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/bgp/${key}`);
    };

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    onActivated(() => {
        activeTabKey.value = 'bgp-config';
        router.push('/bgp/bgp-config');
    });
</script>

<style scoped></style>
