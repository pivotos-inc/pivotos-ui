import type { PageResult, ResetPasswordBody, UserQuery, UserSaveRequest, UserVO } from '@pivotos/types';
import { request } from '../request';

/** 剔除空值查询参数（'' 与 undefined/null 不传给后端） */
function cleanParams(query?: UserQuery): Record<string, unknown> | undefined {
  if (!query) return undefined;
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null));
}

/** 用户分页（接收人选择等场景复用，需 system:user:list 权限） */
export function pageUsers(query: UserQuery): Promise<PageResult<UserVO>> {
  return request.get<unknown, PageResult<UserVO>>('/system/user/page', { params: cleanParams(query) });
}

/** 用户详情 */
export function getUser(id: string): Promise<UserVO> {
  return request.get<unknown, UserVO>(`/system/user/${id}`);
}

/** 新增用户 */
export function createUser(body: UserSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/user', body);
}

/** 修改用户 */
export function updateUser(body: UserSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/user', body);
}

/** 删除用户 */
export function deleteUser(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/user/${id}`);
}

/** 重置用户密码 */
export function resetUserPassword(body: ResetPasswordBody): Promise<void> {
  return request.put<unknown, void>('/system/user/reset-password', body);
}
