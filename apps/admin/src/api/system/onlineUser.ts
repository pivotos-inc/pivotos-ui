import type { OnlineUserVO } from '@pivotos/types';
import { request } from '../request';

const BASE = '/system/online-user';

/** 查询在线用户列表 */
export function listOnlineUsers(): Promise<OnlineUserVO[]> {
  return request.get<unknown, OnlineUserVO[]>(`${BASE}/list`);
}

/** 强退指定 Token 对应的会话 */
export function kickoutUser(tokenValue: string): Promise<void> {
  return request.delete<unknown, void>(`${BASE}/kickout/${tokenValue}`);
}
