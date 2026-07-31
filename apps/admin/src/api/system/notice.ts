import type { NoticeSaveRequest, NoticeVO } from '@pivotos/types';
import { request } from '../request';

/** 公告详情（管理端，草稿/撤回态也可见） */
export function getNotice(id: string): Promise<NoticeVO> {
  return request.get<unknown, NoticeVO>(`/system/notice/${id}`);
}

/** 新增公告（保存为草稿） */
export function createNotice(body: NoticeSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/notice', body);
}

/** 修改公告（已发布不可改，需先撤回） */
export function updateNotice(body: NoticeSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/notice', body);
}

/** 删除公告 */
export function deleteNotice(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/notice/${id}`);
}

/** 发布公告 */
export function publishNotice(id: string): Promise<void> {
  return request.put<unknown, void>(`/system/notice/${id}/publish`);
}

/** 撤回公告 */
export function revokeNotice(id: string): Promise<void> {
  return request.put<unknown, void>(`/system/notice/${id}/revoke`);
}

/** 最新已发布公告（首页卡片，登录即可读） */
export function listPublishedNotices(limit = 5): Promise<NoticeVO[]> {
  return request.get<unknown, NoticeVO[]>('/system/notice/published', { params: { limit } });
}

/** 已发布公告详情（登录即可读） */
export function getPublishedNotice(id: string): Promise<NoticeVO> {
  return request.get<unknown, NoticeVO>(`/system/notice/published/${id}`);
}
