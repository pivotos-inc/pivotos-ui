import type { StartInstanceCmd, WorkflowInstanceVO } from '@pivotos/types';
import type { PageResult } from '@pivotos/types';
import { request } from '../request';

/** 发起流程实例 */
export function startInstance(cmd: StartInstanceCmd): Promise<WorkflowInstanceVO> {
  return request.post<unknown, WorkflowInstanceVO>('/workflow/instance/start', cmd);
}

/** 撤回流程 */
export function revokeInstance(instanceId: string): Promise<void> {
  return request.put<unknown, void>(`/workflow/instance/${instanceId}/revoke`);
}

/** 终止流程 */
export function terminateInstance(instanceId: string): Promise<void> {
  return request.put<unknown, void>(`/workflow/instance/${instanceId}/terminate`);
}

/** 实例详情 */
export function getInstance(instanceId: string): Promise<WorkflowInstanceVO> {
  return request.get<unknown, WorkflowInstanceVO>(`/workflow/instance/${instanceId}`);
}

/** 我发起的实例分页 */
export function pageMyInstances(params: Record<string, unknown>): Promise<PageResult<WorkflowInstanceVO>> {
  return request.get<unknown, PageResult<WorkflowInstanceVO>>('/workflow/instance/page', { params });
}
