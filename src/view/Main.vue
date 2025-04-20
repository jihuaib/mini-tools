<template>
    <div class="main-layout">
        <!-- 顶部菜单导航 -->
        <a-menu
            v-model:selectedKeys="current"
            mode="horizontal"
            :items="items"
            @select="handleSelect"
            class="main-menu"
            sticky
        />
        <div class="content-area">
            <router-view v-slot="{ Component }">
                <keep-alive :include="['StringGenerator', 'BgpEmulator', 'BmpEmulator']">
                    <component :is="Component" ref="currentComponent" />
                </keep-alive>
            </router-view>
        </div>
    </div>
</template>

<script setup>
    import { ref, watch } from 'vue';
    import { useRouter, useRoute } from 'vue-router';

    const router = useRouter();
    const route = useRoute();
    const currentComponent = ref(null);

    const current = ref(['string-generator']);
    const items = ref([
        {
            key: 'string-generator',
            label: '字符串生成工具',
            title: '字符串生成工具',
            route: '/string-generator'
        },
        {
            key: 'bgp-emulator',
            label: 'bgp模拟工具',
            title: 'bgp模拟工具',
            route: '/bgp-emulator'
        },
        {
            key: 'bmp-emulator',
            label: 'bmp监控服务器',
            title: 'bmp监控服务器',
            route: '/bmp-emulator'
        }
    ]);

    // 菜单点击事件
    const handleSelect = ({ key }) => {
        const selectedItem = items.value.find(item => item.key === key);
        if (selectedItem) {
            router.push(selectedItem.route);
        }
    };

    // 监听路由变化
    watch(
        () => route.path,
        () => {
            // 路由变化时清空验证错误
            if (currentComponent.value && typeof currentComponent.value.clearValidationErrors === 'function') {
                currentComponent.value.clearValidationErrors();
            }
        }
    );
</script>

<style scoped>
    .main-menu {
        line-height: 30px;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        z-index: 1000;
        background-color: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .content-area {
        display: flex;
        flex-direction: column;
        padding: 0 20px;
        width: 100%;
        max-width: 1200px;
        box-sizing: border-box;
        margin-top: 30px; /* 为固定导航栏留出空间 */
    }

    .main-layout {
        width: 100%;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }
</style>
