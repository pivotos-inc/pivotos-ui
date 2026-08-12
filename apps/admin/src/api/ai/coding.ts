import type { CodingParseBody, CodingSessionVO } from '@pivotos/types';
import { request } from '../request';

const BASE = '/ai-coding';

/** 自然语言解析 + 代码生成预览（走 LLM，耗时较长，超时放宽到 120s） */
export function parseCoding(body: CodingParseBody) {
  return request.post<unknown, CodingSessionVO>(`${BASE}/parse`, body, { timeout: 120_000 });
}

/** Plugin 骨架生成（S42 / 2.2-F12，走 LLM，超时放宽到 120s） */
export function parseCodingPlugin(body: CodingParseBody) {
  return request.post<unknown, CodingSessionVO>(`${BASE}/plugin/parse`, body, { timeout: 120_000 });
}

/** 主子表生成（S52 / 2.4-F5，走 LLM，超时放宽到 120s） */
export function parseCodingSub(body: CodingParseBody) {
  return request.post<unknown, CodingSessionVO>(`${BASE}/sub/parse`, body, { timeout: 120_000 });
}

/** 树表生成（S54 / tree intent，走 LLM，超时放宽到 120s） */
export function parseCodingTree(body: CodingParseBody) {
  return request.post<unknown, CodingSessionVO>(`${BASE}/tree/parse`, body, { timeout: 120_000 });
}

/** 分页查询历史会话（列表视图，不含生成文件） */
export function pageCodingSessions(params?: Record<string, unknown>) {
  return request.get<unknown, { list: CodingSessionVO[]; total: number }>(`${BASE}/session/page`, { params });
}

/** 查询会话详情（含生成文件） */
export function getCodingSession(id: string) {
  return request.get<unknown, CodingSessionVO>(`${BASE}/session/${id}`);
}

/** 确认应用：生成代码写入工程 */
export function applyCodingSession(id: string) {
  return request.post<unknown, void>(`${BASE}/session/${id}/apply`);
}
