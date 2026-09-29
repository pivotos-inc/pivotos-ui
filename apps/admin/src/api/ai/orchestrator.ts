import type { AiOrchestratorRunRequest, AiToolPlanQuery, AiToolPlanVO, PageResult } from '@pivotos/types';
import { request } from '../request';

/** 按意图生成调用链计划（不执行任何工具，S116 A5-1） */
export function draftPlan(intent: string): Promise<AiToolPlanVO> {
  return request.post<AiOrchestratorRunRequest, AiToolPlanVO>('/ai/orchestrator/plan', { intent });
}

/** 生成计划并立即执行：含写步骤且未确认时停在写步骤前 */
export function runPlan(intent: string, confirmed = false): Promise<AiToolPlanVO> {
  return request.post<AiOrchestratorRunRequest, AiToolPlanVO>('/ai/orchestrator/run', { intent, confirmed });
}

/** 按计划 ID 执行（二次确认后置 confirmed=true 继续） */
export function runPlanById(id: string, confirmed = false): Promise<AiToolPlanVO> {
  return request.post<AiOrchestratorRunRequest, AiToolPlanVO>(`/ai/orchestrator/${id}/run`, { confirmed });
}

/** 编排记录分页查询 */
export function pagePlans(query: AiToolPlanQuery): Promise<PageResult<AiToolPlanVO>> {
  return request.get<unknown, PageResult<AiToolPlanVO>>('/ai/orchestrator/page', { params: query });
}

/** 编排明细（含每步入参与输出） */
export function getPlan(id: string): Promise<AiToolPlanVO> {
  return request.get<unknown, AiToolPlanVO>(`/ai/orchestrator/${id}`);
}

/** 编排可用工具清单（已排除配置中的高危工具） */
export function listOrchestratorTools(): Promise<string[]> {
  return request.get<unknown, string[]>('/ai/orchestrator/tools');
}
