<template>
    <div class="tool-main-container">
        <!-- 固定 Tabs -->
        <div class="fixed-tabs">
            <a-tabs v-model:activeKey="activeTabKey" style="height: 55px" @change="handleTabChange">
                <a-tab-pane key="string-generator" tab="字符串生成" />
                <a-tab-pane key="packet-parser" tab="报文解析" />
                <a-tab-pane key="ftp-server" tab="FTP服务器" />
                <a-tab-pane key="formatter" tab="格式化工具" />
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

    defineOptions({
        name: 'ToolMain'
    });

    const router = useRouter();
    const activeTabKey = ref('string-generator');
    const currentTab = ref(null);

    const handleTabChange = key => {
        router.push(`/tools/${key}`);
    };

    // 向父组件(Main.vue)暴露清空验证错误的方法
    defineExpose({
        clearValidationErrors: () => {
            if (currentTab.value && typeof currentTab.value.clearValidationErrors === 'function') {
                currentTab.value.clearValidationErrors();
            }
        }
    });

    onActivated(() => {
        activeTabKey.value = 'string-generator';
        router.push('/tools/string-generator');
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
