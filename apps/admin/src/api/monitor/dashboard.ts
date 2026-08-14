import type { DashboardSummaryVO } from '@pivotos/types';
import { request } from '../request';

/**
 * 运营看板 API（S71 PL-REPORT 一期）
 * 工作台与数据大屏共用的聚合只读端点，登录即可访问。
 */
export function getDashboardSummary(): Promise<DashboardSummaryVO> {
  return request.get<unknown, DashboardSummaryVO>('/monitor/dashboard/summary');
}
