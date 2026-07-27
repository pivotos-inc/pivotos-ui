import type { MessageManageVO, MessageSendRequest } from '@pivotos/types';
import { request } from '../request';

/** 后台消息详情 */
export function getMessage(id: string): Promise<MessageManageVO> {
  return request.get<unknown, MessageManageVO>(`/message/manage/${id}`);
}

/** 发送消息 */
export function sendMessage(body: MessageSendRequest): Promise<string> {
  return request.post<unknown, string>('/message/manage/send', body);
}
