import type { ConfigSaveRequest, ConfigVO } from '@pivotos/types';
import { request } from '../request';

/** 参数配置详情 */
export function getConfig(id: string): Promise<ConfigVO> {
  return request.get<unknown, ConfigVO>(`/system/config/${id}`);
}

/** 新增参数配置 */
export function createConfig(body: ConfigSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/config', body);
}

/** 修改参数配置 */
export function updateConfig(body: ConfigSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/config', body);
}

/** 删除参数配置 */
export function deleteConfig(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/config/${id}`);
}
