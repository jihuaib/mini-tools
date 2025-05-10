<template>
    <div class="settings-layout">
        <!-- 左侧分类菜单 -->
        <div class="settings-sidebar">
            <a-menu
                v-model:selectedKeys="selectedCategory"
                mode="inline"
                class="settings-menu"
                @select="handleCategorySelect"
            >
                <a-menu-item key="general">
                    <template #icon><SettingOutlined /></template>
                    <span>通用设置</span>
                </a-menu-item>
                <a-menu-item key="tools">
                    <template #icon><ToolOutlined /></template>
                    <span>工具设置</span>
                </a-menu-item>
            </a-menu>
        </div>

        <!-- 右侧设置内容区域 -->
        <div class="settings-content">
            <router-view v-slot="{ Component }">
                <keep-alive>
                    <component :is="Component" />
                </keep-alive>
            </router-view>
        </div>
    </div>
</template>

<script setup>
    import { ref } from 'vue';
    import { useRouter } from 'vue-router';
    import { SettingOutlined, ToolOutlined } from '@ant-design/icons-vue';

    const router = useRouter();
    const selectedCategory = ref(['general']);

    // 处理分类选择
    const handleCategorySelect = ({ key }) => {
        router.push(`/settings/${key}`);
    };

    // 根据当前路由初始化选中的菜单项
    const initSelectedMenu = () => {
        const path = router.currentRoute.value.path;
        const category = path.split('/').pop();
        if (category && category !== 'settings') {
            selectedCategory.value = [category];
        } else {
            // 默认选中通用设置
            selectedCategory.value = ['general'];
            router.push('/settings/general');
        }
    };

    // 组件挂载时初始化菜单
    initSelectedMenu();
</script>

<style scoped>
    .settings-layout {
        display: flex;
        height: 100%;
        background-color: #fff;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }

    .settings-sidebar {
        width: 200px;
        border-right: 1px solid #f0f0f0;
        height: 100%;
    }

    .settings-menu {
        height: 100%;
        border-right: none;
    }

    .settings-content {
        flex: 1;
        padding: 20px;
        overflow: auto;
    }
</style>
