import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

/** 布局框架（动态路由的目录节点与常量业务页共用） */
export const Layout = () => import('@/layout/Layout.vue');

/**
 * 常量路由：登录 / 403 / 404 + 挂 Layout 的隐藏页（个人中心）。
 * 业务菜单一律由后端 GET /system/menu/routers 下发后 addRoute（见 stores/permission）。
 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', hidden: true },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/profile',
    children: [
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人中心', hidden: true },
      },
    ],
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/Forbidden.vue'),
    meta: { title: '403', hidden: true },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/NotFound.vue'),
    meta: { title: '404', hidden: true },
  },
  {
    // 兜底必须用组件直渲而非 redirect 到 /404：redirect 在守卫执行前就改写目标地址，
    // 刷新动态路由页面（如 /system/menu）时原始地址丢失，守卫装配完路由也找不回
    // 目标（S13 验收实测踩坑）。组件直渲保留 URL，守卫重放后动态路由即可命中。
    path: '/:pathMatch(.*)*',
    component: () => import('@/views/error/NotFound.vue'),
    meta: { title: '404', hidden: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
});

export default router;
