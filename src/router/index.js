import {createRouter, createWebHistory} from 'vue-router'
import Main from "../view/Main.vue";
import StringGenerator from "../view/StringGenerator.vue";
import BgpEmulator from "../view/BgpEmulator.vue";

const routes = [
    {
        path: "/",
        component: Main,
        children: [
            { path: '/', redirect: '/string-generator' },
            { path: '/string-generator', component: StringGenerator },
            { path: '/bgp-emulator', component: BgpEmulator },
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
