import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      vue(),
      UnoCSS(),
      // 按需引入方案：业务模板中的 El* 组件自动解析；
      // 样式由 @pivotos/ui/styles 单入口统一加载（importStyle: false），P1 再做按需样式优化。
      Components({
        dts: false,
        resolvers: [ElementPlusResolver({ importStyle: false })],
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        // 代理到后端 admin-server，避免跨域（见《04》第五节）
        // 注意：按插件 API 前缀登记——新 Plugin（flow/file/job…）接入时各加一条
        // bypass 必须保留：API 前缀与 SPA 路由前缀同形（如 /system/menu 既是
        // 后端命名空间也是前端路由），浏览器刷新/回车地址栏时 Accept 含
        // text/html，回退 index.html 交给 SPA 路由；axios 调用 Accept 为
        // application/json 正常代理。新 Plugin 加条目时 bypass 一并复制。
        '/system': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
          bypass(req) {
            if (req.headers.accept?.includes('text/html')) {
              return '/index.html';
            }
          },
        },
        '/message': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
          bypass(req) {
            if (req.headers.accept?.includes('text/html')) {
              return '/index.html';
            }
          },
        },
      },
    },
  };
});
