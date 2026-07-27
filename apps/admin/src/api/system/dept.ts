import type { DeptQuery, DeptSaveRequest, DeptVO } from '@pivotos/types';
import { request } from '../request';

/** 部门树查询（登录即可读，用户表单部门下拉也用此接口） */
export function treeDepts(query?: DeptQuery): Promise<DeptVO[]> {
  return request.get<unknown, DeptVO[]>('/system/dept/tree', { params: query });
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
