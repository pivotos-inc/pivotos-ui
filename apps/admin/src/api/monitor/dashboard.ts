import type { AiChartHistoryVO, AiChartSaveCmd, AiChartSpecVO, DashboardSummaryVO, PageResult } from '@pivotos/types';
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

/** 保存 AI 图表（S83）：收藏当前 ChartSpec，返回记录 ID */
export function saveAiChart(cmd: AiChartSaveCmd): Promise<string> {
  return request.post<unknown, string>('/monitor/ai-chart-history', cmd);
}

/** 我的 AI 图表历史分页（S83，按保存时间倒序） */
export function pageAiChartHistory(pageNum: number, pageSize: number): Promise<PageResult<AiChartHistoryVO>> {
  return request.get<unknown, PageResult<AiChartHistoryVO>>('/monitor/ai-chart-history/page', {
    params: { pageNum, pageSize },
  });
}

/** 删除 AI 图表历史（S83，仅归属人可删） */
export function deleteAiChart(id: string): Promise<void> {
  return request.delete<unknown, void>(`/monitor/ai-chart-history/${id}`);
}
