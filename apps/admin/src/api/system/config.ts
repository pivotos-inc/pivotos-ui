import type { ConfigSaveRequest, ConfigVO } from '@pivotos/types';
import { request } from '../request';

/** 参数配置详情 */
export function getConfig(id: string): Promise<ConfigVO> {
  return request.get<unknown, ConfigVO>(`/system/config/${id}`);
}

/** 按键名读参数值（登录即可读，不存在返回 null） */
export function getConfigValueByKey(configKey: string): Promise<string | null> {
  return request.get<unknown, string | null>(
    `/system/config/configKey/${encodeURIComponent(configKey)}`,
  );
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
