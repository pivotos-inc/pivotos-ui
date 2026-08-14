import type { FlowDefinitionVO } from '@pivotos/types';
import { request } from '../request';

/** 流程定义详情 */
export function getDefinition(id: string): Promise<FlowDefinitionVO> {
  return request.get<unknown, FlowDefinitionVO>(`/workflow/definition/${id}`);
}

/** 发布流程定义 */
export function publishDefinition(id: string): Promise<void> {
  return request.put<unknown, void>(`/workflow/definition/${id}/publish`);
}

/** 挂起/激活流程定义（切换 activity_status） */
export function toggleActivity(id: string): Promise<void> {
  return request.put<unknown, void>(`/workflow/definition/${id}/toggle-activity`);
}

/** 删除流程定义（逻辑删除） */
export function deleteDefinition(id: string): Promise<void> {
  return request.delete<unknown, void>(`/workflow/definition/${id}`);
}
