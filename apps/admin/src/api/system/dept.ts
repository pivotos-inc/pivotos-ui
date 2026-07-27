import type { DeptQuery, DeptSaveRequest, DeptVO } from '@pivotos/types';
import { request } from '../request';

/** 剔除空值查询参数（'' 是查询表单"请选择"空值项，undefined/null 无意义） */
function cleanParams(query?: DeptQuery): Record<string, unknown> | undefined {
  if (!query) return undefined;
  return Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );
}

/** 部门树查询（登录即可读，用户表单部门下拉也用此接口） */
export function treeDepts(query?: DeptQuery): Promise<DeptVO[]> {
  return request.get<unknown, DeptVO[]>('/system/dept/tree', { params: cleanParams(query) });
}

/** 部门详情 */
export function getDept(id: string): Promise<DeptVO> {
  return request.get<unknown, DeptVO>(`/system/dept/${id}`);
}

/** 新增部门 */
export function createDept(body: DeptSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/dept', body);
}

/** 修改部门 */
export function updateDept(body: DeptSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/dept', body);
}

/** 删除部门 */
export function deleteDept(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/dept/${id}`);
}
