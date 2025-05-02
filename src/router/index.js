import { createRouter, createWebHashHistory } from 'vue-router';
import Main from '../view/Main.vue';
import ToolMain from '../view/tools/ToolMain.vue';
import StringGenerator from '../view/tools/StringGenerator.vue';
import BgpMain from '../view/bgp/BgpMain.vue';
import BgpConfig from '../view/bgp/BgpConfig.vue';
import BgpPeerInfo from '../view/bgp/BgpPeerInfo.vue';
import RouteConfig from '../view/bgp/RouteConfig.vue';
import BmpMain from '../view/bmp/BmpMain.vue';
import BmpConfig from '../view/bmp/BmpConfig.vue';
import BmpPeer from '../view/bmp/BmpPeer.vue';
import BmpRoute from '../view/bmp/BmpRoute.vue';
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
                        path: 'bgp-peer-info',
                        name: 'BgpPeerInfo',
                        component: BgpPeerInfo,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'route-config',
                        name: 'RouteConfig',
                        component: RouteConfig,
                        meta: { keepAlive: true }
                    }
                ]
            },
            {
                path: '/bmp',
                name: 'BmpMain',
                component: BmpMain,
                meta: { keepAlive: true },
                children: [
                    { path: '', redirect: '/bmp/bmp-config' },
                    {
                        path: 'bmp-config',
                        name: 'BmpConfig',
                        component: BmpConfig,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'bmp-peer',
                        name: 'BmpPeer',
                        component: BmpPeer,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'bmp-route',
                        name: 'BmpRoute',
                        component: BmpRoute,
                        meta: { keepAlive: true }
                    }
                ]
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
