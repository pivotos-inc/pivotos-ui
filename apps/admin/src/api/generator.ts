import type {
  DbTableVO,
  GenTableVO,
  GenTableColumnVO,
  ImportTableRequest,
  PreviewCodeResult,
} from '@pivotos/types';
import { request } from './request';

const BASE = '/generator';

/** 查询数据库表列表 */
export function listDbTables(params?: Record<string, unknown>) {
  return request.get<unknown, { records: DbTableVO[]; total: number }>(`${BASE}/db/list`, { params });
}

/** 导入表结构 */
export function importTable(body: ImportTableRequest) {
  return request.post<unknown, void>(`${BASE}/import`, body);
}

/** 分页查询已导入的生成表 */
export function listGenTables(params?: Record<string, unknown>) {
  return request.get<unknown, { records: GenTableVO[]; total: number }>(`${BASE}/list`, { params });
}

/** 查询生成表详情 */
export function getGenTable(id: string) {
  return request.get<unknown, GenTableVO>(`${BASE}/${id}`);
}

/** 删除生成表 */
export function deleteGenTable(ids: string) {
  return request.delete<unknown, void>(`${BASE}/${ids}`);
}

/** 同步数据库字段 */
export function synchGenTable(id: string) {
  return request.put<unknown, void>(`${BASE}/synch/${id}`);
}

/** 查询表的字段列表 */
export function listGenColumns(tableId: string) {
  return request.get<unknown, GenTableColumnVO[]>(`${BASE}/column/${tableId}`);
}

/** 更新字段配置 */
export function updateGenColumn(body: GenTableColumnVO) {
  return request.put<unknown, void>(`${BASE}/column`, body);
}

/** 更新表配置（模板类型/树/主子，S50 / 2.4-F1） */
export function updateGenTable(body: Partial<GenTableVO> & { id: string }) {
  return request.put<unknown, void>(`${BASE}/table`, body);
}

/** 预览代码 */
export function previewCode(tableId: string) {
  return request.get<unknown, PreviewCodeResult>(`${BASE}/preview/${tableId}`);
}

/** 下载代码（返回 blob 触发浏览器下载） */
export function downloadCode(tableId: string) {
  return request.get(`${BASE}/download/${tableId}`, { responseType: 'blob' });
}

/** 生成到工程 */
export function generateToProject(tableId: string) {
  return request.post<unknown, void>(`${BASE}/generate/${tableId}`);
}
