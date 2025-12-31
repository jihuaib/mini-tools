<template>
    <div class="mt-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:active-key="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="bmp-config" tab="BMP配置" />
                <a-tab-pane key="bgp-session" tab="BGP会话" />
                <a-tab-pane key="bgp-loc-rib" tab="BGP Loc-RIB" />
                <a-tab-pane key="bgp-session-statis-report" tab="BGP会话统计" />
                <a-tab-pane key="bgp-loc-rib-statis-report" tab="BGP Loc-RIB统计" />
            </a-tabs>
        </div>

        <!-- 可滚动内容区域 -->
        <div class="content-container">
            <router-view v-slot="{ Component }">
                <keep-alive :include="$store.state.cachedViews">
                    <component :is="Component" ref="currentTab" @open-settings="handleOpenSettings" />
                </keep-alive>
            </router-view>
        </div>
    </div>
</template>

<script setup>
    import { ref, onActivated } from 'vue';
    import { useRouter } from 'vue-router';

    defineOptions({ name: 'BmpMain' });

    const emit = defineEmits(['openSettings']);

    const router = useRouter();
    const activeTabKey = ref('bmp-config');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/bmp/${key}`);
    };

    const handleOpenSettings = category => {
        emit('openSettings', category);
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

<style scoped></style>
