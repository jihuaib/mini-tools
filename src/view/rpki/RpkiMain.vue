<template>
    <div class="mt-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:active-key="activeTabKey" @change="handleTabChange">
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

<style scoped></style>
