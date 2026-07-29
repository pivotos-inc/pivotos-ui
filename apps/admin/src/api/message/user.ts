import { request } from '../request';

/** 标记一条消息已读 */
export function markRead(userMessageId: string): Promise<void> {
  return request.put<unknown, void>(`/message/user/read/${userMessageId}`);
}

/** 全部标记已读，返回实际更新条数 */
export function markAllRead(): Promise<number> {
  return request.put<unknown, number>('/message/user/read-all');
}

/** 未读消息数 */
export function unreadCount(): Promise<number> {
  return request.get<unknown, number>('/message/user/unread-count');
}
