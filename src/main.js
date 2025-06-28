import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import './assets/styles/common.css';
import App from './App.vue';
import router from './router';
import store from './store';
// 引入弹出框缩放自适应处理工具
import './utils/modalResizeHandler';

const app = createApp(App);

app.use(Antd).use(router).use(store).mount('#app');
