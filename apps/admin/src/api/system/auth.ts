import type { LoginBody, LoginVO, UserInfoVO } from '@pivotos/types';
import { request } from '../request';

/** 账号密码登录（验证码开关 sys.account.captchaEnabled 当前为 false，P1 接入） */
export function login(body: LoginBody): Promise<LoginVO> {
  return request.post<unknown, LoginVO>('/system/auth/login', body, { allowRepeat: true });
}

/** 退出登录 */
export function logout(): Promise<void> {
  return request.post<unknown, void>('/system/auth/logout', undefined, { allowRepeat: true });
}

/** 当前登录用户信息（user + roles + perms） */
export function getInfo(): Promise<UserInfoVO> {
  return request.get<unknown, UserInfoVO>('/system/auth/getInfo');
}
