import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import './assets/styles/common.css';
import App from './App.vue';
import router from './router';
import store from './store';
import EventBus from './utils/eventBus';
// 引入弹出框缩放自适应处理工具
import './utils/modalResizeHandler';

// 初始化全局事件监听器
if (window.commonApi && window.commonApi.onUnifiedEvent) {
    window.commonApi.onUnifiedEvent(({ type, data }) => {
        EventBus.emit(type, data);
    });
}

const app = createApp(App);

app.use(Antd).use(router).use(store).mount('#app');
