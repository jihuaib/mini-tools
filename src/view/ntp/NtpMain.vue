<template>
    <div class="mt-main-container">
        <div class="fixed-tabs">
            <a-tabs v-model:active-key="activeTabKey" @change="handleTabChange">
                <a-tab-pane key="ntp-config" tab="NTP配置" />
                <a-tab-pane key="ntp-request-log" tab="请求日志" />
            </a-tabs>
        </div>

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

    defineOptions({ name: 'NtpMain' });

    const router = useRouter();
    const activeTabKey = ref('ntp-config');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/ntp/${key}`);
    };

    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value?.clearValidationErrors) {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    onActivated(() => {
        router.push(`/ntp/${activeTabKey.value}`);
    });
</script>

<style scoped></style>
