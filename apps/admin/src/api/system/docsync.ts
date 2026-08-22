import { request } from '../request';

// ==================== 类型定义 ====================

/** 平台类型枚举 */
export type DocSyncTypeEnum =
  | 'TORNA'
  | 'YAPI'
  | 'APIFOX'
  | 'SHOWDOC'
  | 'XXL_API'
  | 'APIPOST'
  | 'EOLINK';

/** 平台配置字段元数据 */
export interface DocSyncConfigFieldDTO {
  fieldKey: string;
  label: string;
  required: boolean;
  inputType: string;
  placeholder: string;
  description: string;
}

/** 平台信息（含配置字段） */
export interface PlatformInfoDTO {
  type: DocSyncTypeEnum;
  displayName: string;
  autoSyncSupported: boolean;
  description: string;
  configFields: DocSyncConfigFieldDTO[];
}

/** 同步配置 VO */
export interface DocSyncConfigVO {
  id: string;
  name: string;
  platformType: DocSyncTypeEnum;
  serverUrl?: string;
  credential?: string;
  secondaryCredential?: string;
  projectId?: string;
  enabled: number;
  lastSyncTime?: string;
  lastSyncResult?: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

/** 配置查询参数 */
export interface DocSyncConfigQuery {
  pageNum?: number;
  pageSize?: number;
  name?: string;
  platformType?: DocSyncTypeEnum | '';
}

/** 配置保存请求 */
export interface DocSyncConfigSaveRequest {
  id?: string;
  name: string;
  platformType: DocSyncTypeEnum;
  serverUrl?: string;
  credential?: string;
  secondaryCredential?: string;
  projectId?: string;
  enabled?: number;
  remark?: string;
}

/** 同步结果（与后端 com.pivotos.docsync.api.dto.SyncResultDTO 对齐） */
export interface SyncResultDTO {
  /** 同步状态：SUCCESS / FAILED */
  status: string;
  /** 同步的接口数量 */
  apiCount: number;
  /** 结果描述 */
  message: string;
  /** 同步耗时（毫秒） */
  elapsedMs: number;
  /** 同步时间 */
  syncTime: string;
  /** 手动同步时提供的跳转 URL */
  managementUrl?: string;
}

// ==================== API 函数 ====================

/** 分页查询同步配置列表 */
export function pageDocSyncConfigs(params: DocSyncConfigQuery) {
  return request.get<unknown, { list: DocSyncConfigVO[]; total: number; pageNum: number; pageSize: number }>(
    '/system/docsync/page',
    { params },
  );
}

/** 获取配置详情 */
export function getDocSyncConfig(id: string): Promise<DocSyncConfigVO> {
  return request.get<unknown, DocSyncConfigVO>(`/system/docsync/${id}`);
}

/** 新增配置 */
export function createDocSyncConfig(body: DocSyncConfigSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/docsync', body);
}

/** 修改配置 */
export function updateDocSyncConfig(body: DocSyncConfigSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/docsync', body);
}

/** 删除配置 */
export function deleteDocSyncConfig(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/docsync/${id}`);
}

/** 切换启用状态 */
export function changeDocSyncStatus(id: string, enabled: number): Promise<void> {
  return request.put<unknown, void>(`/system/docsync/${id}/status`, enabled);
}

/** 获取所有支持的平台信息（含配置字段元数据） */
export function getDocSyncPlatforms(): Promise<PlatformInfoDTO[]> {
  return request.get<unknown, PlatformInfoDTO[]>('/system/docsync/platforms');
}

/** 获取指定平台的配置字段元数据 */
export function getDocSyncPlatformInfo(type: DocSyncTypeEnum): Promise<PlatformInfoDTO> {
  return request.get<unknown, PlatformInfoDTO>(`/system/docsync/platforms/${type}`);
}

/** 测试平台连通性 */
export function testDocSyncConnection(id: string): Promise<boolean> {
  return request.post<unknown, boolean>(`/system/docsync/${id}/test`);
}

/** 同步单个配置 */
export function syncDocSyncOne(id: string): Promise<SyncResultDTO> {
  return request.post<unknown, SyncResultDTO>(`/system/docsync/${id}/sync`);
}

/** 同步所有启用的配置 */
export function syncDocSyncAll(): Promise<SyncResultDTO[]> {
  return request.post<unknown, SyncResultDTO[]>('/system/docsync/sync-all');
}

/** 导出 OpenAPI JSON（返回下载 URL） */
export function exportDocSyncOpenApiUrl(id: string): string {
  return `/api/system/docsync/${id}/export`;
}
