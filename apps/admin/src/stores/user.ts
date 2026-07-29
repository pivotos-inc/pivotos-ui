import { defineStore } from 'pinia';
import type { UserVO } from '@pivotos/types';
import * as authApi from '@/api/system/auth';

const TOKEN_KEY = 'pivotos-token';

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // 隐私模式等场景下 localStorage 不可用，会话退化为内存态
  }
}

interface UserState {
  /** Sa-Token 令牌（localStorage 持久化） */
  token: string;
  /** 当前用户基本信息 */
  info: UserVO | null;
  /** 按钮级权限串集合（超管为 ["*:*:*"]） */
  perms: string[];
  /** 角色编码集合（超管为 ["super_admin"]） */
  roles: string[];
}

/** 用户会话 store：Token / 用户信息 / 权限 / 角色 */
export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: readToken(),
    info: null,
    perms: [],
    roles: [],
  }),
  getters: {
    nickname: (state) => state.info?.nickname || state.info?.username || '',
    avatar: (state) => state.info?.avatar || '',
  },
  actions: {
    /** 账号密码登录：拿 Token 并持久化 */
    async login(username: string, password: string): Promise<void> {
      const { token } = await authApi.login({ username, password });
      this.token = token;
      writeToken(token);
    },
    /** 拉取当前用户信息（登录后 / 刷新后路由守卫调用） */
    async fetchInfo(): Promise<void> {
      const { user, roles, perms } = await authApi.getInfo();
      this.info = user;
      this.roles = roles ?? [];
      this.perms = perms ?? [];
    },
    /** 退出登录：通知后端 + 清理本地会话（动态路由由守卫侧负责移除） */
    async logout(): Promise<void> {
      try {
        await authApi.logout();
      } catch {
        // 后端登出失败不阻断本地清理
      }
      this.reset();
    },
    /** 清理本地会话态 */
    reset(): void {
      this.token = '';
      this.info = null;
      this.perms = [];
      this.roles = [];
      writeToken('');
    },
  },
});
