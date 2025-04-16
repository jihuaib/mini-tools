import {createRouter, createWebHashHistory} from 'vue-router'
import Main from "../view/Main.vue";
import StringGenerator from "../view/StringGenerator.vue";
import BgpEmulator from "../view/BgpEmulator.vue";

const routes = [
    {
        path: '/',
        component: Main,
        children: [
            { path: '/', redirect: '/string-generator' },
            {
                path: '/string-generator',
                name: 'StringGenerator',
                component: StringGenerator
            },
            {
                path: '/bgp-emulator',
                name: 'BgpEmulator',
                component: BgpEmulator
            }
        ]
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

export default router
