import type {
  KbChunkVO,
  KbDocPageQuery,
  KbDocUploadBody,
  KbDocumentVO,
  KbSearchBody,
  KbSearchResult,
  KnowledgeBaseSaveBody,
  KnowledgeBaseVO,
  PageResult,
} from '@pivotos/types';
import { request } from '../request';

/* ---------- 知识库管理 ---------- */

/** 知识库分页 */
export function pageKnowledgeBases(query?: { pageNum?: number; pageSize?: number }): Promise<PageResult<KnowledgeBaseVO>> {
  return request.get<unknown, PageResult<KnowledgeBaseVO>>('/ai/kb/base/page', { params: query });
}

/** 启用中的知识库下拉列表 */
export function listKnowledgeBaseOptions(): Promise<KnowledgeBaseVO[]> {
  return request.get<unknown, KnowledgeBaseVO[]>('/ai/kb/base/list');
}

/** 知识库详情 */
export function getKnowledgeBase(id: string): Promise<KnowledgeBaseVO> {
  return request.get<unknown, KnowledgeBaseVO>(`/ai/kb/base/${id}`);
}

/** 新增知识库 */
export function createKnowledgeBase(body: KnowledgeBaseSaveBody): Promise<string> {
  return request.post<unknown, string>('/ai/kb/base', body);
}

/** 修改知识库 */
export function updateKnowledgeBase(body: KnowledgeBaseSaveBody): Promise<void> {
  return request.put<unknown, void>('/ai/kb/base', body);
}

/** 删除知识库（级联清理向量与文档） */
export function deleteKnowledgeBase(id: string): Promise<void> {
  return request.delete<unknown, void>(`/ai/kb/base/${id}`);
}

/* ---------- 知识库文档 ---------- */

/** 文档分页 */
export function pageKbDocs(query: KbDocPageQuery): Promise<PageResult<KbDocumentVO>> {
  return request.get<unknown, PageResult<KbDocumentVO>>('/ai/kb/doc/page', { params: query });
}

/** 文档详情 */
export function getKbDoc(id: string): Promise<KbDocumentVO> {
  return request.get<unknown, KbDocumentVO>(`/ai/kb/doc/${id}`);
}

/** 上传文档并触发索引 */
export function uploadKbDoc(body: KbDocUploadBody): Promise<string> {
  return request.post<unknown, string>('/ai/kb/doc/upload', body);
}

/** 删除文档（同时清向量） */
export function deleteKbDoc(id: string): Promise<void> {
  return request.delete<unknown, void>(`/ai/kb/doc/${id}`);
}

/** 重新向量化文档 */
export function reindexKbDoc(id: string): Promise<void> {
  return request.post<unknown, void>(`/ai/kb/doc/${id}/reindex`);
}

/** 文档文本块列表（分块查看/解析预览用） */
export function listDocChunks(id: string): Promise<KbChunkVO[]> {
  return request.get<unknown, KbChunkVO[]>(`/ai/kb/doc/${id}/chunks`);
}

/** 知识库相似性检索调试（管理端验证 RAG 召回） */
export function searchKb(body: KbSearchBody): Promise<KbSearchResult[]> {
  return request.post<unknown, KbSearchResult[]>('/ai/kb/base/search', body);
}
