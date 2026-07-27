import type { Router } from 'vue-router';
import { hasPermi } from '@pivotos/core';
import { useUserStore } from '@/stores/user';
import { usePermissionStore } from '@/stores/permission';
import { useTagsViewStore } from '@/stores/tagsView';

const WHITE_LIST = ['/login'];

/**
 * 路由前置守卫：
 * 1. 无 Token → 白名单放行，否则跳登录（带 redirect 回跳）
 * 2. 已登录访问 /login → 回首页
 * 3. 首次进入（或刷新）→ getInfo + 动态路由装配后重放目标地址
 * 4. 无权限访问 → 403
 */
export function setupGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const userStore = useUserStore();
    const permissionStore = usePermissionStore();

    if (!userStore.token) {
      if (WHITE_LIST.includes(to.path)) return true;
      return { path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
    }

    if (to.path === '/login') {
      return { path: '/' };
    }

    // 会话已恢复但用户信息/动态路由未装配：先装配再重放
    if (!permissionStore.loaded) {
      try {
        await userStore.fetchInfo();
        await permissionStore.generateRoutes();
      } catch {
        // Token 失效等场景：清会话回登录页
        resetSession();
        return { path: '/login', query: { redirect: to.fullPath } };
      }
      const target = to.path === '/' ? permissionStore.homePath : to.fullPath;
      return { path: target, replace: true, query: to.query };
    }

    if (to.path === '/') {
      return { path: permissionStore.homePath, replace: true };
    }

    // 按钮/页面级权限点（meta.perms 预留，后端路由已按权限过滤）
    const needPerm = to.meta?.perms as string | undefined;
    if (needPerm && !hasPermi(needPerm)) {
      return { path: '/403' };
    }

    return true;
  });

  router.afterEach((to) => {
    const title = to.meta?.title ? `${String(to.meta.title)} · PivotOS` : 'PivotOS 管理端';
    document.title = title;
  });
}

/** 401 / 会话失效统一清理：用户态 + 动态路由 + 标签页 */
export function resetSession(): void {
  const userStore = useUserStore();
  const permissionStore = usePermissionStore();
  const tagsViewStore = useTagsViewStore();
  userStore.reset();
  permissionStore.reset();
  tagsViewStore.reset();
}
