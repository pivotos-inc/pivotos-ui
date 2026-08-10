import type { OnlineUserVO, OnlineUserQuery, PageResult, PageQuery } from '@pivotos/types';
import { request } from '../request';

/**
 * 在线用户 API
 */
export function listOnlineUsers(params: OnlineUserQuery & PageQuery): Promise<PageResult<OnlineUserVO>> {
  return request.get<unknown, PageResult<OnlineUserVO>>('/system/online-user/list', { params });
}

/**
 * 强退指定 Token 会话
 */
export function kickoutUser(tokenValue: string): Promise<void> {
  return request.delete<unknown, void>(`/system/online-user/kickout/${encodeURIComponent(tokenValue)}`);
}

/**
 * 清空所有在线用户（保留当前用户）
 */
export function clearAllUsers(): Promise<string> {
  return request.delete<unknown, string>('/system/online-user/clear-all');
}
