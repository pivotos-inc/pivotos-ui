import type { RoleSaveRequest, RoleVO } from '@pivotos/types';
import { request } from '../request';

/** 全部正常角色（下拉选项，登录即可读） */
export function listAllRoles(): Promise<RoleVO[]> {
  return request.get<unknown, RoleVO[]>('/system/role/all');
}

/** 角色详情 */
export function getRole(id: string): Promise<RoleVO> {
  return request.get<unknown, RoleVO>(`/system/role/${id}`);
}

/** 角色已授权菜单ID集合（编辑回显） */
export function listRoleMenuIds(id: string): Promise<string[]> {
  return request.get<unknown, string[]>(`/system/role/${id}/menu-ids`);
}

/** 新增角色 */
export function createRole(body: RoleSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/role', body);
}

/** 修改角色 */
export function updateRole(body: RoleSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/role', body);
}

/** 删除角色 */
export function deleteRole(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/role/${id}`);
}
