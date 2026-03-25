<template>
    <div class="mt-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:active-key="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="dhcp-config" tab="DHCP配置" />
                <a-tab-pane key="dhcp-lease" tab="租约列表" />
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

    defineOptions({ name: 'DhcpMain' });

    const router = useRouter();
    const activeTabKey = ref('dhcp-config');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/dhcp/${key}`);
    };

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    onActivated(() => {
        // 恢复当前tab对应的路由
        router.push(`/dhcp/${activeTabKey.value}`);
    });
</script>

<style scoped></style>
