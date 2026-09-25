import type { AiToolInvokeQuery, AiToolInvokeVO, AiToolQuery, AiToolVO, PageResult } from '@pivotos/types';
import { request } from '../request';

/** 工具分页查询（附角色白名单，S98 A2） */
export function pageTools(query: AiToolQuery): Promise<PageResult<AiToolVO>> {
  return request.get<unknown, PageResult<AiToolVO>>('/ai/tool/page', { params: query });
}

/** 全量更新工具角色白名单（空数组 = 登录用户皆可调用） */
export function updateToolRoles(id: string, roles: string[]): Promise<void> {
  return request.put<unknown, void>(`/ai/tool/${id}/roles`, { roles });
}

/** 停用/启用工具（0正常 1停用） */
export function updateToolStatus(id: string, status: number): Promise<void> {
  return request.put<unknown, void>(`/ai/tool/${id}/status`, null, { params: { status } });
}

/** 工具调用审计分页查询 */
export function pageToolInvokes(query: AiToolInvokeQuery): Promise<PageResult<AiToolInvokeVO>> {
  return request.get<unknown, PageResult<AiToolInvokeVO>>('/ai/tool/invoke/page', { params: query });
}
