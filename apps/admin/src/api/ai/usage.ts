import type { AiUsageProviderVO, AiUsageSummaryVO, AiUsageUserVO } from '@pivotos/types';
import { request } from '../request';

/** 用量汇总：总量卡片 + 场景分布 + 日趋势（days 默认 7，后端上限 90） */
export function getUsageSummary(days: number): Promise<AiUsageSummaryVO> {
  return request.get<unknown, AiUsageSummaryVO>('/ai/usage/summary', { params: { days } });
}

/** 按供应商 × Key 聚合 */
export function getUsageByProvider(days: number): Promise<AiUsageProviderVO[]> {
  return request.get<unknown, AiUsageProviderVO[]>('/ai/usage/by-provider', { params: { days } });
}

/** 按用户聚合 */
export function getUsageByUser(days: number): Promise<AiUsageUserVO[]> {
  return request.get<unknown, AiUsageUserVO[]>('/ai/usage/by-user', { params: { days } });
}
