import { defineStore } from 'pinia';

interface UserState {
  /** Sa-Token 令牌（S12 登录页写入） */
  token: string;
  /** 按钮级权限串集合 */
  perms: string[];
  /** 角色编码集合 */
  roles: string[];
}

/** 用户会话 store：Token / 权限 / 角色（S12 接入登录后持久化） */
export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: '',
    perms: [],
    roles: [],
  }),
  actions: {
    reset(): void {
      this.token = '';
      this.perms = [];
      this.roles = [];
    },
  },
});
