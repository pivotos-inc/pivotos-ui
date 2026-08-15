import type { AddSignatureCmd, PageResult, ReductionSignatureCmd, TaskActionCmd, WorkflowHisTaskVO, WorkflowTaskVO, WorkflowUserOption } from '@pivotos/types';
import { request } from '../request';

/** 待办分页 */
export function pagePendingTasks(params: Record<string, unknown>): Promise<PageResult<WorkflowTaskVO>> {
  return request.get<unknown, PageResult<WorkflowTaskVO>>('/workflow/task/pending/page', { params });
}

/** 已办分页 */
export function pageCompletedTasks(params: Record<string, unknown>): Promise<PageResult<WorkflowHisTaskVO>> {
  return request.get<unknown, PageResult<WorkflowHisTaskVO>>('/workflow/task/completed/page', { params });
}

/** 审批通过 */
export function passTask(cmd: TaskActionCmd): Promise<void> {
  return request.put<unknown, void>('/workflow/task/pass', cmd);
}

/** 驳回 */
export function rejectTask(cmd: TaskActionCmd): Promise<void> {
  return request.put<unknown, void>('/workflow/task/reject', cmd);
}

/** 转办 */
export function transferTask(cmd: TaskActionCmd): Promise<void> {
  return request.put<unknown, void>('/workflow/task/transfer', cmd);
}

/** 委派 */
export function deputeTask(cmd: TaskActionCmd): Promise<void> {
  return request.put<unknown, void>('/workflow/task/depute', cmd);
}

/** 加签（S78 F2）：为待办任务追加审批人（或签语义） */
export function addSignatureTask(cmd: AddSignatureCmd): Promise<void> {
  return request.put<unknown, void>('/workflow/task/add-signature', cmd);
}

/** 减签（S82）：从待办任务移除审批人（引擎护栏：办理人不足两人不可减签） */
export function reductionSignatureTask(cmd: ReductionSignatureCmd): Promise<void> {
  return request.put<unknown, void>('/workflow/task/reduction-signature', cmd);
}

/** 待办任务当前审批人（S82：减签选人候选） */
export function taskApprovers(taskId: string): Promise<WorkflowUserOption[]> {
  return request.get<unknown, WorkflowUserOption[]>(`/workflow/task/${taskId}/approvers`);
}

/** 审批历史 */
export function taskHistory(instanceId: string): Promise<WorkflowHisTaskVO[]> {
  return request.get<unknown, WorkflowHisTaskVO[]>(`/workflow/task/history/${instanceId}`);
}
