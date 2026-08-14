import { ElNotification } from 'element-plus';
import { createRequest } from '@pivotos/core';

/**
 * 全局请求实例。
 * - baseURL 为 '/api'：开发环境经 Vite 代理把 /api/* 重写到后端 admin-server（见 vite.config.ts），
 *   生产/测试由 Nginx location /api/ 反代并剥离前缀（见 deploy/nginx-pivotos.conf）。
 *   所有环境统一走 /api 前缀，天然隔离 API 与 SPA 路由，零 CORS。
 * - 接口加密拦截器（enableCrypto）默认关闭，联调链路通后再开启（见《04》第五节）。
 * - 错误提示使用 ElNotification：支持多行长文本、可复制，hover 可查看完整内容。
 */
export const request = createRequest({
  baseURL: '/api',
  timeout: 15_000,
  onError: (msg) => ElNotification({ title: '请求失败', message: msg, type: 'error', duration: 5000 }),
});
