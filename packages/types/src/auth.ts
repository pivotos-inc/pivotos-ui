import type { BaseVO } from './common';

/** 登录请求体（对齐 LoginBody） */
export interface LoginBody {
  username: string;
  password: string;
}

/** 登录响应（对齐 LoginVO） */
export interface LoginVO {
  token: string;
}

/** 用户视图对象（对齐 UserVO，脱敏） */
export interface UserVO extends BaseVO {
  username: string;
  nickname: string;
  deptId?: string;
  email?: string;
  mobile?: string;
  gender?: number;
  avatar?: string;
  status?: number;
  remark?: string;
}

/** 当前登录用户信息（对齐 UserInfoVO = user + roles + perms） */
export interface UserInfoVO {
  user: UserVO;
  /** 角色编码，超管为 ["super_admin"] */
  roles: string[];
  /** 权限标识，超管为 ["*:*:*"] */
  perms: string[];
}

/** 账号体系（对齐 LoginUser.accountType） */
export type AccountType = 'sys-user' | 'app-user' | 'wx-mini-user';
