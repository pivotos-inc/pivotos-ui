import { ElMessage } from 'element-plus';
import { createRequest } from '@pivotos/core';

/**
 * 全局请求实例。
 * - baseURL 为 '/'：开发环境经 Vite 代理把 /system 转发到 admin-server（见 vite.config.ts），
 *   生产由 Nginx 反代（见《07-部署上线流程》）。
 * - 接口加密拦截器（enableCrypto）默认关闭，联调链路通后再开启（见《04》第五节）。
 */
export const request = createRequest({
  baseURL: '/',
  timeout: 15_000,
  onError: (msg) => ElMessage.error(msg),
});
