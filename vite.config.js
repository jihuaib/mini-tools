import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    base: "./", // 必须设置为相对路径
    server: {
        host: "127.0.0.1",
        port: 3000,
    },
});
