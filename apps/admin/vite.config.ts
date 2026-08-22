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
        // 统一 /api 代理：前端 baseURL='/api'，所有 API 请求经此前缀转发到后端并剥离 /api。
        // 与 Nginx location /api/ { rewrite ^/api/(.*)$ /$1 break; proxy_pass … } 语义一致，
        // 开发 / 测试 / 生产三环境零 CORS。
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
          // 大文件上传支持：5 分钟代理超时
          proxyTimeout: 300_000,
          timeout: 300_000,
        },
      },
    },
  };
});
