import { defineStore } from 'pinia';
import type { RouteRecordRaw } from 'vue-router';
import type { RouterVO } from '@pivotos/types';
import { getRouters } from '@/api/system/router';
import router, { Layout } from '@/router';

/** views 组件映射表（构建期静态收集，component 字符串 → 异步组件） */
const viewModules = import.meta.glob('../views/**/*.vue');

function loadView(component: string) {
  const loader = viewModules[`../views/${component}.vue`];
  // 组件缺失时退化为 404 页，避免整棵动态路由挂掉
  return loader ?? viewModules['../views/error/NotFound.vue'];
}

/** RouterVO 树 → vue-router 记录（目录挂 Layout，菜单挂 views 组件） */
function transform(routerVO: RouterVO): RouteRecordRaw {
  const record = {
    path: routerVO.path,
    name: routerVO.name || undefined,
    component: routerVO.component === 'Layout' ? Layout : loadView(routerVO.component),
    meta: {
      title: routerVO.meta?.title,
      icon: routerVO.meta?.icon,
      hidden: routerVO.hidden ?? false,
    },
    ...(routerVO.children?.length ? { children: routerVO.children.map(transform) } : {}),
  };
  return record as RouteRecordRaw;
}

interface PermissionState {
  /** 动态路由是否已装配 */
  loaded: boolean;
  /** 后端下发的原始路由树（侧边栏数据源） */
  routes: RouteRecordRaw[];
  /** 已 addRoute 的路由名（登出时移除） */
  addedNames: string[];
}

/** 权限路由 store：动态路由装配与卸载 */
export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    loaded: false,
    routes: [],
    addedNames: [],
  }),
  getters: {
    /** 侧边栏完整路由源 = 动态路由 + 常量路由中挂 Layout 的部分（个人中心等隐藏页不进菜单） */
    sidebarRoutes: (state) => state.routes,
    /** 登录后首页落点：常驻首页（公告卡片，S26），登录即可访问不依赖菜单权限 */
    homePath(): string {
      return '/home';
    },
  },
  actions: {
    /** 拉取后端动态路由并装配进 router */
    async generateRoutes(): Promise<void> {
      const routerVOs = await getRouters();
      const dynamic = routerVOs.map(transform);
      dynamic.forEach((record) => {
        router.addRoute(record);
        if (record.name) this.addedNames.push(String(record.name));
      });
      this.routes = dynamic;
      this.loaded = true;
    },
    /** 登出/401 时卸载动态路由，回到未登录基座 */
    reset(): void {
      this.addedNames.forEach((name) => {
        if (router.hasRoute(name)) router.removeRoute(name);
      });
      this.addedNames = [];
      this.routes = [];
      this.loaded = false;
    },
  },
});
