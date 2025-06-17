import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import './assets/styles/common.css';
import App from './App.vue';
import router from './router';
import store from './store';

const app = createApp(App);

app.use(Antd).use(router).use(store).mount('#app');
