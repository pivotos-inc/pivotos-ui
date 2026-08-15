import type { AiChartSpecVO, DashboardSummaryVO } from '@pivotos/types';
import { request } from '../request';

/**
 * 运营看板 API（S71 PL-REPORT 一期）
 * 工作台与数据大屏共用的聚合只读端点，登录即可访问。
 */
export function getDashboardSummary(): Promise<DashboardSummaryVO> {
  return request.get<unknown, DashboardSummaryVO>('/monitor/dashboard/summary');
}

/** AI 生成图表（S72 PL-REPORT 二期）：自然语言 → 结构化 ChartSpec */
export function generateAiChart(question: string): Promise<AiChartSpecVO> {
  return request.post<unknown, AiChartSpecVO>('/monitor/dashboard/ai-chart', { question });
}
