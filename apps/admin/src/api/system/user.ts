import type { ResetPasswordBody, UserSaveRequest, UserVO } from '@pivotos/types';
import { request } from '../request';

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
