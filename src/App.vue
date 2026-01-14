<template>
    <a-config-provider :theme="themeConfig">
        <!--路由内容-->
        <router-view />
    </a-config-provider>
</template>

<script setup>
    import { onMounted } from 'vue';
    import { useStore } from 'vuex';
    import { themeConfig } from './assets/styles/theme.js';
    import { applyTheme } from './utils/themes';

    const store = useStore();

    onMounted(() => {
        // 应用保存的主题
        const currentTheme = store.state.theme.currentTheme;
        applyTheme(currentTheme);
    });
</script>
