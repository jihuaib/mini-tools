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
                v-model:selected-keys="current"
                mode="inline"
                :items="items"
                class="main-menu"
                :inline-collapsed="isCollapsed"
                :open-keys="!isCollapsed ? openKeys : []"
                @select="handleSelect"
                @open-change="onOpenChange"
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
                            <a-menu-item key="settings" @click="handleBottomMenuClick('settings')">
                                <a-space>
                                    <SettingOutlined />
                                    <span>设置</span>
                                </a-space>
                            </a-menu-item>
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
                        <component :is="Component" ref="currentComponent" @open-settings="handleOpenSettings" />
                    </keep-alive>
                </router-view>
            </div>
        </div>

        <!-- 设置弹窗 -->
        <SettingsDialog ref="settingsDialog" />

        <!-- 更新通知 -->
        <UpdateNotification />
    </div>
</template>

<script setup>
    import { ref, watch, h, onMounted, onUnmounted } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { useStore } from 'vuex';
    import {
        MenuFoldOutlined,
        MenuUnfoldOutlined,
        SettingOutlined,
        ToolOutlined,
        InfoCircleOutlined,
        AppstoreOutlined,
        ApiOutlined,
        ClusterOutlined,
        SafetyOutlined,
        FolderOutlined,
        CodeOutlined
    } from '@ant-design/icons-vue';
    import SettingsDialog from '../components/SettingsDialog.vue';
    import UpdateNotification from '../components/UpdateNotification.vue';
    import modalResizeHandler from '../utils/modalResizeHandler';

    const router = useRouter();
    const route = useRoute();
    const store = useStore();
    const currentComponent = ref(null);
    const isCollapsed = ref(false);
    const openKeys = ref([]);
    const settingsDialog = ref(null);

    const current = ref(['tools']);
    const items = ref([
        {
            key: 'tools',
            icon: h(AppstoreOutlined),
            label: 'tools',
            title: 'tools',
            route: '/tools'
        },
        {
            key: 'bgp',
            icon: h(ApiOutlined),
            label: 'bgp',
            title: 'bgp',
            route: '/bgp'
        },
        {
            key: 'bmp',
            icon: h(ClusterOutlined),
            label: 'bmp',
            title: 'bmp',
            route: '/bmp'
        },
        {
            key: 'rpki',
            icon: h(SafetyOutlined),
            label: 'rpki',
            title: 'rpki',
            route: '/rpki'
        },
        {
            key: 'ftp',
            icon: h(FolderOutlined),
            label: 'ftp',
            title: 'ftp',
            route: '/ftp'
        },
        {
            key: 'snmp',
            icon: h(CodeOutlined),
            label: 'snmp',
            title: 'snmp',
            route: '/snmp'
        }
    ]);

    // 菜单点击事件
    const handleSelect = ({ key }) => {
        const selectedItem = items.value.find(item => item.key === key);
        if (selectedItem) {
            // 在导航前确保当前路由已被添加到缓存视图中
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
        } else if (key === 'settings') {
            settingsDialog.value.open();
        }
    };

    // Handle opening settings from child components
    const handleOpenSettings = category => {
        settingsDialog.value.open(category);
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

        // 初始化时检查窗口宽度
        handleSidebarResize();

        // 注册到 modalResizeHandler 的回调
        modalResizeHandler.onZoomChange(handleSidebarResize);
    });

    // 组件卸载时移除监听器
    onUnmounted(() => {
        modalResizeHandler.offZoomChange(handleSidebarResize);
    });

    // 处理侧边栏响应式调整
    const handleSidebarResize = () => {
        const width = window.innerWidth;
        // 当窗口宽度小于1200px时自动收缩侧边栏
        if (width < 1200 && !isCollapsed.value) {
            isCollapsed.value = true;
        }
        // 当窗口宽度大于等于1200px时自动展开侧边栏
        else if (width >= 1200 && isCollapsed.value) {
            isCollapsed.value = false;
        }
    };
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
        background: var(--theme-gradient, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s;
        width: 150px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .sider.collapsed {
        width: 60px;
    }

    .toggle-btn {
        padding: 16px 0;
        text-align: right;
        padding-right: 16px;
    }

    .toggle-btn .ant-btn {
        color: rgba(255, 255, 255, 0.9);
    }

    .toggle-btn .ant-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.15);
    }

    .toggle-btn .anticon {
        font-size: 18px;
    }

    .main-menu {
        border-right: none;
        flex: 1;
        background: transparent;
    }

    .bottom-menu-btn {
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        padding: 16px;
        text-align: center;
    }

    .content-container {
        margin-left: 155px;
        transition: all 0.2s;
        width: calc(100% - 155px);
        display: flex;
        padding-right: 20px;
    }

    .content-container.content-expanded {
        margin-left: 65px;
        width: calc(100% - 65px);
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
        padding: 0 calc(30% - 16px / 2) !important;
    }
</style>
