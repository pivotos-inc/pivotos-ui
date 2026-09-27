import type {
  TenantInitRequest,
  TenantInitVO,
  TenantSaveRequest,
  TenantVO,
} from '@pivotos/types';
import { request } from '../request';

const BASE = '/system/tenant';

/** 租户详情 */
export function getTenant(id: string): Promise<TenantVO> {
  return request.get<unknown, TenantVO>(`${BASE}/${id}`);
}

/** 新增租户 */
export function createTenant(body: TenantSaveRequest): Promise<string> {
  return request.post<unknown, string>(BASE, body);
}

/** 修改租户（含状态切换） */
export function updateTenant(body: TenantSaveRequest): Promise<void> {
  return request.put<unknown, void>(BASE, body);
}

/** 删除租户 */
export function deleteTenant(id: string): Promise<void> {
  return request.delete<unknown, void>(`${BASE}/${id}`);
}

/** 初始化向导：建租户 → 配套餐 → 建管理员 */
export function initTenant(body: TenantInitRequest): Promise<TenantInitVO> {
  return request.post<unknown, TenantInitVO>(`${BASE}/init`, body);
}
