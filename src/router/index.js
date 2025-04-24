import { createRouter, createWebHashHistory } from 'vue-router';
import Main from '../view/Main.vue';
import ToolMain from '../view/tools/ToolMain.vue';
import StringGenerator from '../view/tools/StringGenerator.vue';
import BgpMain from '../view/bgp/BgpMain.vue';
import BgpConfig from '../view/bgp/BgpConfig.vue';
import BgpSendRoute from '../view/bgp/BgpSendRoute.vue';
import BgpReceiveRoute from '../view/bgp/BgpReceiveRoute.vue';
import BmpEmulator from '../view/BmpEmulator.vue';
import store from '../store';

const routes = [
    {
        path: '/',
        component: Main,
        name: 'Main',
        meta: { keepAlive: true },
        children: [
            { path: '/', redirect: '/tools' },
            {
                path: '/tools',
                component: ToolMain,
                name: 'ToolMain',
                meta: { keepAlive: true },
                children: [
                    { path: '', redirect: '/tools/string-generator' },
                    {
                        path: 'string-generator',
                        name: 'StringGenerator',
                        component: StringGenerator,
                        meta: { keepAlive: true }
                    }
                ]
            },
            {
                path: '/bgp',
                component: BgpMain,
                name: 'BgpMain',
                meta: { keepAlive: true },
                children: [
                    { path: '', redirect: '/bgp/bgp-config' },
                    {
                        path: 'bgp-config',
                        name: 'BgpConfig',
                        component: BgpConfig,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'bgp-send-route',
                        name: 'BgpSendRoute',
                        component: BgpSendRoute,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'bgp-receive-route',
                        name: 'BgpReceiveRoute',
                        component: BgpReceiveRoute,
                        meta: { keepAlive: true }
                    }
                ]
            },
            {
                path: '/bmp-emulator',
                name: 'BmpEmulator',
                component: BmpEmulator,
                meta: { keepAlive: true }
            }
        ]
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

// Add and remove cached views when route changes
router.beforeEach((to, from, next) => {
    // Add the target route to cached views
    if (to.name && to.meta && to.meta.keepAlive) {
        store.dispatch('addCachedView', to);

        // Also cache parent routes if they have keepAlive
        let matched = to.matched;
        matched.forEach(record => {
            if (record.name && record.meta.keepAlive) {
                store.dispatch('addCachedView', record);
            }
        });
    }
    next();
});

export default router;
