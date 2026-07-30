import type {
  AiApiKeySaveBody,
  AiApiKeyVO,
  AiProviderOptionVO,
  AiProviderSaveBody,
  AiProviderVO,
} from '@pivotos/types';
import { request } from '../request';

/* ---------- 供应商管理 ---------- */

/** 供应商列表（含停用，附启用 Key 数） */
export function listProviders(): Promise<AiProviderVO[]> {
  return request.get<unknown, AiProviderVO[]>('/ai/provider/list');
}

/** 新增供应商 */
export function createProvider(body: AiProviderSaveBody): Promise<string> {
  return request.post<unknown, string>('/ai/provider', body);
}

/** 修改供应商 */
export function updateProvider(body: AiProviderSaveBody): Promise<void> {
  return request.put<unknown, void>('/ai/provider', body);
}

/** 删除供应商（级联删除其 Key） */
export function deleteProvider(id: string): Promise<void> {
  return request.delete<unknown, void>(`/ai/provider/${id}`);
}

/* ---------- Key 管理 ---------- */

/** Key 列表（脱敏，只回尾 4 位） */
export function listKeys(providerId: string): Promise<AiApiKeyVO[]> {
  return request.get<unknown, AiApiKeyVO[]>(`/ai/provider/${providerId}/keys`);
}

/** 新增 Key（明文仅此一次上送，落库后不可回看） */
export function createKey(body: AiApiKeySaveBody): Promise<string> {
  return request.post<unknown, string>('/ai/provider/key', body);
}

/** 修改 Key（apiKey 留空 = 不变更本体） */
export function updateKey(body: AiApiKeySaveBody): Promise<void> {
  return request.put<unknown, void>('/ai/provider/key', body);
}

/** 删除 Key */
export function deleteKey(id: string): Promise<void> {
  return request.delete<unknown, void>(`/ai/provider/key/${id}`);
}

/* ---------- 对话侧下拉（登录即可） ---------- */

/** 启用供应商选项（对话页供应商下拉） */
export function listProviderOptions(): Promise<AiProviderOptionVO[]> {
  return request.get<unknown, AiProviderOptionVO[]>('/ai/provider/options');
}

/** 供应商可用模型（动态查供应商 /models，后端 5 分钟缓存） */
export function listProviderModels(providerId: string): Promise<string[]> {
  return request.get<unknown, string[]>(`/ai/provider/${providerId}/models`);
}
