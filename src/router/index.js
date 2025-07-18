import { createRouter, createWebHashHistory } from 'vue-router';
import Main from '../view/Main.vue';
import ToolMain from '../view/tools/ToolMain.vue';
import StringGenerator from '../view/tools/StringGenerator.vue';
import PacketParser from '../view/tools/PacketParser.vue';
import Formatter from '../view/tools/Formatter.vue';
import PacketCapture from '../view/tools/PacketCapture.vue';
import BgpMain from '../view/bgp/BgpMain.vue';
import BgpConfig from '../view/bgp/BgpConfig.vue';
import BgpPeerInfo from '../view/bgp/BgpPeerInfo.vue';
import RouteConfig from '../view/bgp/RouteConfig.vue';
import BmpMain from '../view/bmp/BmpMain.vue';
import BmpConfig from '../view/bmp/BmpConfig.vue';
import BmpPeer from '../view/bmp/BmpPeer.vue';
import BmpPeerRoute from '../view/bmp/BmpPeerRoute.vue';
import RpkiMain from '../view/rpki/RpkiMain.vue';
import RpkiConfig from '../view/rpki/RpkiConfig.vue';
import RpkiRoaConfig from '../view/rpki/RpkiRoaConfig.vue';
import FtpMain from '../view/ftp/FtpMain.vue';
import FtpConfig from '../view/ftp/FtpConfig.vue';
import SnmpMain from '../view/snmp/SnmpMain.vue';
import SnmpConfig from '../view/snmp/SnmpConfig.vue';
import SnmpTrap from '../view/snmp/SnmpTrap.vue';
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
                    {
                        path: '/',
                        redirect: '/tools/string-generator'
                    },
                    {
                        path: 'string-generator',
                        name: 'StringGenerator',
                        component: StringGenerator,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'packet-parser',
                        name: 'PacketParser',
                        component: PacketParser,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'formatter',
                        name: 'Formatter',
                        component: Formatter,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'packet-capture',
                        name: 'PacketCapture',
                        component: PacketCapture,
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
                    {
                        path: '/',
                        redirect: '/bgp/bgp-config'
                    },
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
                    {
                        path: '/',
                        redirect: '/bmp/bmp-config'
                    },
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
                        path: 'peer/:clientId/:peerId',
                        name: 'BmpPeerRoute',
                        component: BmpPeerRoute,
                        props: true,
                        meta: { keepAlive: true }
                    }
                ]
            },
            {
                path: '/rpki',
                name: 'RpkiMain',
                component: RpkiMain,
                meta: { keepAlive: true },
                children: [
                    {
                        path: '/',
                        redirect: '/rpki/rpki-config'
                    },
                    {
                        path: 'rpki-config',
                        name: 'RpkiConfig',
                        component: RpkiConfig,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'rpki-roa-config',
                        name: 'RpkiRoaConfig',
                        component: RpkiRoaConfig,
                        meta: { keepAlive: true }
                    }
                ]
            },
            {
                path: '/ftp',
                name: 'FtpMain',
                component: FtpMain,
                meta: { keepAlive: true },
                children: [
                    {
                        path: '/',
                        redirect: '/ftp/ftp-config'
                    },
                    {
                        path: 'ftp-config',
                        name: 'FtpConfig',
                        component: FtpConfig,
                        meta: { keepAlive: true }
                    }
                ]
            },
            {
                path: '/snmp',
                name: 'SnmpMain',
                component: SnmpMain,
                meta: { keepAlive: true },
                children: [
                    {
                        path: '/',
                        redirect: '/snmp/snmp-config'
                    },
                    {
                        path: 'snmp-config',
                        name: 'SnmpConfig',
                        component: SnmpConfig,
                        meta: { keepAlive: true }
                    },
                    {
                        path: 'snmp-trap',
                        name: 'SnmpTrap',
                        component: SnmpTrap,
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

router.beforeEach((to, _from, next) => {
    if (to.name && to.meta && to.meta.keepAlive) {
        store.dispatch('addCachedView', to);
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
