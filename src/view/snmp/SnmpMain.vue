<template>
    <div class="mt-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:activeKey="activeTabKey" @change="handleTabChange">
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
    import { ref, onActivated, watch } from 'vue';
    import { useRouter, useRoute } from 'vue-router';

    defineOptions({ name: 'SnmpMain' });

    const router = useRouter();
    const route = useRoute();
    const activeTabKey = ref('snmp-config');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/snmp/${key}`);
    };

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    watch(
        () => route.path,
        path => {
            if (path === '/snmp/snmp-config') {
                activeTabKey.value = 'snmp-config';
            } else if (path === '/snmp/snmp-trap') {
                activeTabKey.value = 'snmp-trap';
            }
        },
        { immediate: true }
    );

    onActivated(() => {
        const path = route.path;
        if (path === '/snmp/snmp-config') {
            activeTabKey.value = 'snmp-config';
        } else if (path === '/snmp/snmp-trap') {
            activeTabKey.value = 'snmp-trap';
        } else {
            activeTabKey.value = 'snmp-config';
            router.push('/snmp/snmp-config');
        }
    });
</script>

<style scoped></style>
