<template>
    <div class="main-layout">
        <!-- 侧边菜单导航 -->
        <div class="sider" :class="{ collapsed: isCollapsed }">
            <div class="toggle-btn" @click="toggleCollapse">
                <a-button type="text">
                    <template #icon>
                        <MenuFoldOutlined v-if="!isCollapsed" />
                        <MenuUnfoldOutlined v-else />
                    </template>
                </a-button>
            </div>
            <a-menu
                v-model:selectedKeys="current"
                mode="inline"
                :items="items"
                @select="handleSelect"
                class="main-menu"
                :inline-collapsed="isCollapsed"
                :openKeys="!isCollapsed ? openKeys : []"
                @openChange="onOpenChange"
            />
            <!-- 底部菜单按钮 -->
            <div class="bottom-menu-btn">
                <a-dropdown :trigger="['click']" placement="topRight">
                    <a-button type="text">
                        <template #icon><SettingOutlined /></template>
                        <span v-if="!isCollapsed">更多选项</span>
                    </a-button>
                    <template #overlay>
                        <a-menu>
                            <a-menu-item key="developer" @click="handleBottomMenuClick('developer')">
                                <a-space>
                                    <ToolOutlined />
                                    <span>开发人员选项</span>
                                </a-space>
                            </a-menu-item>
                            <a-menu-item key="about" @click="handleBottomMenuClick('about')">
                                <a-space>
                                    <InfoCircleOutlined />
                                    <span>关于</span>
                                </a-space>
                            </a-menu-item>
                        </a-menu>
                    </template>
                </a-dropdown>
            </div>
        </div>
        <!-- 内容区域 -->
        <div class="content-container" :class="{ 'content-expanded': isCollapsed }">
            <div class="content-area">
                <router-view v-slot="{ Component }">
                    <keep-alive :include="$store.state.cachedViews">
                        <component :is="Component" ref="currentComponent" />
                    </keep-alive>
                </router-view>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { ref, watch, h, onMounted } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { useStore } from 'vuex';
    import {
        MenuFoldOutlined,
        MenuUnfoldOutlined,
        CodeOutlined,
        CloudOutlined,
        RadarChartOutlined,
        SettingOutlined,
        ToolOutlined,
        InfoCircleOutlined
    } from '@ant-design/icons-vue';

    const router = useRouter();
    const route = useRoute();
    const store = useStore();
    const currentComponent = ref(null);
    const isCollapsed = ref(true);
    const openKeys = ref([]);

    const current = ref(['tools']);
    const items = ref([
        {
            key: 'tools',
            icon: () => h(CodeOutlined),
            label: '工具',
            title: '工具',
            route: '/tools'
        },
        {
            key: 'bgp',
            icon: () => h(CloudOutlined),
            label: 'BGP',
            title: 'BGP',
            route: '/bgp'
        },
        {
            key: 'bmp-emulator',
            icon: () => h(RadarChartOutlined),
            label: 'BMP',
            title: 'BMP',
            route: '/bmp-emulator'
        }
    ]);

    // 菜单点击事件
    const handleSelect = ({ key }) => {
        const selectedItem = items.value.find(item => item.key === key);
        if (selectedItem) {
            // Make sure to add the current route to cached views before navigating
            const targetRoute = router.resolve(selectedItem.route);
            if (targetRoute.name) {
                store.dispatch('addCachedView', targetRoute);
            }
            router.push(selectedItem.route);
        }
    };

    // 底部菜单点击事件
    const handleBottomMenuClick = key => {
        if (key === 'developer') {
            window.commonApi.openDeveloperOptions();
        } else if (key === 'about') {
            window.commonApi.openSoftwareInfo();
        }
    };

    // 切换菜单收缩状态
    const toggleCollapse = () => {
        isCollapsed.value = !isCollapsed.value;
    };

    // 控制展开的子菜单
    const onOpenChange = keys => {
        openKeys.value = keys;
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

    // 组件挂载时初始化缓存
    onMounted(() => {
        // 确保初始路由被正确缓存
        if (route.name && route.meta.keepAlive) {
            store.dispatch('addCachedView', route);
        }
    });
</script>

<style scoped>
    .main-layout {
        width: 100%;
        min-height: 100vh;
        display: flex;
        flex-direction: row;
    }

    .sider {
        height: 100vh;
        position: fixed;
        left: 0;
        top: 0;
        z-index: 1000;
        background-color: #fff;
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s;
        width: 200px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .sider.collapsed {
        width: 80px;
    }

    .toggle-btn {
        padding: 16px 0;
        text-align: right;
        padding-right: 16px;
    }

    .main-menu {
        border-right: none;
        flex: 1;
    }

    .bottom-menu-btn {
        border-top: 1px solid #f0f0f0;
        padding: 16px;
        text-align: center;
    }

    .content-container {
        margin-left: 200px;
        transition: all 0.2s;
        width: calc(100% - 200px);
        display: flex;
    }

    .content-container.content-expanded {
        margin-left: 80px;
        width: calc(100% - 80px);
    }

    .content-area {
        display: flex;
        flex-direction: column;
        width: 100%;
        box-sizing: border-box;
    }

    /* 菜单图标样式 */
    :deep(.ant-menu-item) {
        display: flex;
        align-items: center;
    }

    :deep(.ant-menu-inline-collapsed .ant-menu-item),
    :deep(.ant-menu-inline-collapsed .ant-menu-submenu-title) {
        padding: 0 calc(50% - 16px / 2) !important;
    }
</style>
