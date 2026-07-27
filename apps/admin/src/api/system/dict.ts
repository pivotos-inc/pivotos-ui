import type {
  DictDataQuery,
  DictDataSaveRequest,
  DictDataVO,
  DictTypeSaveRequest,
  DictTypeVO,
  PageResult,
} from '@pivotos/types';
import { request } from '../request';

/* ---------- 字典类型 ---------- */

/** 字典类型详情 */
export function getDictType(id: string): Promise<DictTypeVO> {
  return request.get<unknown, DictTypeVO>(`/system/dict/type/${id}`);
}

/** 新增字典类型 */
export function createDictType(body: DictTypeSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/dict/type', body);
}

/** 修改字典类型 */
export function updateDictType(body: DictTypeSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/dict/type', body);
}

/** 删除字典类型 */
export function deleteDictType(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/dict/type/${id}`);
}

/* ---------- 字典数据 ---------- */

/** 字典数据分页（主从联动右侧表格） */
export function pageDictData(query: DictDataQuery): Promise<PageResult<DictDataVO>> {
  return request.get<unknown, PageResult<DictDataVO>>('/system/dict/data/page', { params: query });
}

/** 新增字典数据 */
export function createDictData(body: DictDataSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/dict/data', body);
}

/** 修改字典数据 */
export function updateDictData(body: DictDataSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/dict/data', body);
}

/** 删除字典数据 */
export function deleteDictData(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/dict/data/${id}`);
}
