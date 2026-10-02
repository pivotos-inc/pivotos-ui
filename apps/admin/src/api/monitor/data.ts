import type {
  DataComponentSnapshot,
  DataPreviewRequest,
  DataQueryRequest,
  DataQueryResult,
  DataSchemaItem,
  DataStatsItem,
  DataTableItem,
} from '@pivotos/types';
import { request } from '../request';

/**
 * 通用数据监控 API（系统监控 · 数据监控）
 *
 * 降级口径：组件未启用 / 未引入实现 / 不可达 / 语句被安全闸门拒绝时，
 * 后端一律返回 code=0 + available=false + reason 文案，前端不做异常提示，直接展示 reason。
 */
export function getDataComponents(): Promise<DataComponentSnapshot[]> {
  return request.get<unknown, DataComponentSnapshot[]>('/monitor/data/components');
}

export function getDataSchemas(component: string): Promise<DataSchemaItem[]> {
  return request.get<unknown, DataSchemaItem[]>('/monitor/data/schemas', { params: { component } });
}

/**
 * 列举表 / 索引 / key。
 *
 * pattern 只对 Redis 生效（key 空间可能极大，必须支持用 pattern 收窄，见后端三重保护）；
 * MySQL / ES 会忽略该参数。
 */
export function getDataTables(
  component: string,
  schema?: string,
  pattern?: string,
): Promise<DataTableItem[]> {
  return request.get<unknown, DataTableItem[]>('/monitor/data/tables', {
    params: { component, schema, pattern },
  });
}

export function getDataStats(
  component: string,
  schema?: string,
  table?: string,
): Promise<DataStatsItem> {
  return request.get<unknown, DataStatsItem>('/monitor/data/stats', { params: { component, schema, table } });
}

/** 预览（需 monitor:data:preview）：内部固定语句 */
export function previewData(payload: DataPreviewRequest): Promise<DataQueryResult> {
  return request.post<unknown, DataQueryResult>('/monitor/data/preview', payload);
}

/** 自由查询（需 monitor:data:query）：后端 SQL 安全闸门硬生效，超管也不豁免 */
export function queryData(payload: DataQueryRequest): Promise<DataQueryResult> {
  return request.post<unknown, DataQueryResult>('/monitor/data/query', payload);
}
