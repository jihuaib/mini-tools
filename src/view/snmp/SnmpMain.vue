<template>
    <div class="mt-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:active-key="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="snmp-config" tab="SNMP配置" />
                <a-tab-pane key="snmp-trap" tab="Trap监控" />
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

    defineOptions({ name: 'SnmpMain' });

    const router = useRouter();
    const activeTabKey = ref('snmp-config');
    const currentTab = ref(null);

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    const handleTabChange = key => {
        router.push(`/snmp/${key}`);
    };

    onActivated(() => {
        activeTabKey.value = 'snmp-config';
        router.push('/snmp/snmp-config');
    });
</script>

<style scoped></style>
