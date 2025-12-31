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
        InfoCircleOutlined
    } from '@ant-design/icons-vue';
    import SettingsDialog from '../components/SettingsDialog.vue';
    import UpdateNotification from '../components/UpdateNotification.vue';
    import BgpIcon from '../assets/bgp.svg';
    import ToolsIcon from '../assets/tools.svg';
    import BmpIcon from '../assets/bmp.svg';
    import RpkiIcon from '../assets/rpki.svg';
    import FtpIcon from '../assets/ftp.svg';
    import SnmpIcon from '../assets/snmp.svg';

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
            icon: () => h('img', { src: ToolsIcon, style: { width: '16px', height: '16px' } }),
            label: 'tools',
            title: 'tools',
            route: '/tools'
        },
        {
            key: 'bgp',
            icon: () => h('img', { src: BgpIcon, style: { width: '16px', height: '16px' } }),
            label: 'bgp',
            title: 'bgp',
            route: '/bgp'
        },
        {
            key: 'bmp',
            icon: () => h('img', { src: BmpIcon, style: { width: '16px', height: '16px' } }),
            label: 'bmp',
            title: 'bmp',
            route: '/bmp'
        },
        {
            key: 'rpki',
            icon: () => h('img', { src: RpkiIcon, style: { width: '16px', height: '16px' } }),
            label: 'rpki',
            title: 'rpki',
            route: '/rpki'
        },
        {
            key: 'ftp',
            icon: () => h('img', { src: FtpIcon, style: { width: '16px', height: '16px' } }),
            label: 'ftp',
            title: 'ftp',
            route: '/ftp'
        },
        {
            key: 'snmp',
            icon: () => h('img', { src: SnmpIcon, style: { width: '16px', height: '16px' } }),
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

    const handleGlobalClick = event => {
        // 只有在点击非输入框、非tooltip相关元素时才清空验证错误
        const target = event.target;
        const isFormElement =
            target.closest('.ant-form-item') ||
            target.closest('.ant-input') ||
            target.closest('.ant-select') ||
            target.closest('.ant-tooltip') ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA';

        if (
            !isFormElement &&
            currentComponent.value &&
            typeof currentComponent.value.clearValidationErrors === 'function'
        ) {
            currentComponent.value.clearValidationErrors();
        }
    };

    // 组件挂载时初始化缓存
    onMounted(() => {
        // 确保初始路由被正确缓存
        if (route.name && route.meta.keepAlive) {
            store.dispatch('addCachedView', route);
        }

        // 添加全局点击事件监听器
        document.addEventListener('click', handleGlobalClick);
    });

    // 组件卸载时移除事件监听器
    onUnmounted(() => {
        document.removeEventListener('click', handleGlobalClick);
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
