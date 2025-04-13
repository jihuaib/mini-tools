<template>
  <div class="main-layout">
    <!-- 顶部菜单导航 -->
    <a-menu v-model:selectedKeys="current" mode="horizontal" :items="items" @select="handleSelect"/>
    <div class="content-area">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['StringGenerator', 'BgpEmulator']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const current = ref(['string-generator']);
const items = ref([
  {
    key: 'string-generator',
    label: '字符串生成工具',
    title: '字符串生成工具',
    route: '/string-generator',
  },
  {
    key: 'bgp-emulator',
    label: 'bgp模拟工具',
    title: 'bgp模拟工具',
    route: '/bgp-emulator',
  }
]);

// 菜单点击事件
const handleSelect = ({ key }) => {
  const selectedItem = items.value.find(item => item.key === key)
  if (selectedItem) {
    router.push(selectedItem.route);
  }
}
</script>

<style scoped>
.content-area {
  display: flex;
  flex-direction: column;
  margin: 20px auto;
  padding: 0 20px;
  width: 100%;
  max-width: 1200px;
  box-sizing: border-box;
}

.main-layout {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>