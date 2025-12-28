<template>
    <a-config-provider :theme="themeConfig">
        <!--路由内容-->
        <router-view />
    </a-config-provider>
</template>

<script setup>
    import { themeConfig } from './assets/styles/theme.js';
</script>
