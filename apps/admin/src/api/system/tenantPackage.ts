import type { TenantPackageQuery, TenantPackageSaveRequest, TenantPackageVO } from '@pivotos/types';
import { request } from '../request';

const BASE = '/system/tenant-package';

/** 剔除空值查询参数 */
function cleanParams(query?: TenantPackageQuery): Record<string, unknown> | undefined {
  if (!query) return undefined;
  return Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );
}

/** 套餐列表 */
export function listTenantPackages(query?: TenantPackageQuery): Promise<TenantPackageVO[]> {
  return request.get<unknown, TenantPackageVO[]>(`${BASE}/list`, { params: cleanParams(query) });
}

/** 套餐详情 */
export function getTenantPackage(id: string): Promise<TenantPackageVO> {
  return request.get<unknown, TenantPackageVO>(`${BASE}/${id}`);
}

/** 新增套餐 */
export function createTenantPackage(body: TenantPackageSaveRequest): Promise<string> {
  return request.post<unknown, string>(BASE, body);
}

/** 修改套餐 */
export function updateTenantPackage(body: TenantPackageSaveRequest): Promise<void> {
  return request.put<unknown, void>(BASE, body);
}

/** 删除套餐 */
export function deleteTenantPackage(id: string): Promise<void> {
  return request.delete<unknown, void>(`${BASE}/${id}`);
}
