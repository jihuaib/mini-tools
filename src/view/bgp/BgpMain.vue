<template>
    <div class="bgp-main-container">
        <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange">
            <a-tab-pane key="bgp-config" tab="BGP配置"></a-tab-pane>
            <a-tab-pane key="bgp-send-route" tab="发送路由"></a-tab-pane>
            <a-tab-pane key="bgp-receive-route" tab="接收路由"></a-tab-pane>
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
    import { ref, onActivated } from 'vue';
    import { useRouter } from 'vue-router';

    defineOptions({
        name: 'BgpMain'
    });

    const router = useRouter();
    const activeTabKey = ref('bgp-config');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/bgp/${key}`);
    };

    // Expose clearValidationErrors method to parent component (Main.vue)
    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value && typeof currentTab.value.clearValidationErrors === 'function') {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    onActivated(() => {
        activeTabKey.value = 'bgp-config';
        router.push('/bgp/bgp-config');
    });

</script>

<style scoped>
    .bgp-main-container {
        padding: 5px;
    }

</style>
