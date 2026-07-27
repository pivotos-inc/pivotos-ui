import type { MenuQuery, MenuSaveRequest, MenuVO } from '@pivotos/types';
import { request } from '../request';

/** 菜单树查询（不分页） */
export function treeMenus(query?: MenuQuery): Promise<MenuVO[]> {
  return request.get<unknown, MenuVO[]>('/system/menu/tree', { params: query });
}

/** 菜单详情 */
export function getMenu(id: string): Promise<MenuVO> {
  return request.get<unknown, MenuVO>(`/system/menu/${id}`);
}

/** 新增菜单 */
export function createMenu(body: MenuSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/menu', body);
}

/** 修改菜单 */
export function updateMenu(body: MenuSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/menu', body);
}

/** 删除菜单 */
export function deleteMenu(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/menu/${id}`);
}
