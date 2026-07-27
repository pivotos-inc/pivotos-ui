import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

/**
 * 静态路由（登录/404/示例页）。
 * 动态业务路由由后端 GET /system/menu/routers 下发后 addRoute（S12 实现）。
 */
export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/demo/table',
  },
  {
    path: '/demo/table',
    name: 'DemoTable',
    component: () => import('@/views/demo/YTableDemo.vue'),
    meta: { title: '组件示例' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/NotFound.vue'),
    meta: { title: '404' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: staticRoutes,
});

export default router;
