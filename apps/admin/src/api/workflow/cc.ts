import type { PageResult, WorkflowCcQuery, WorkflowCcVO } from '@pivotos/types';
import { request } from '../request';

/** 抄送我的分页（S78 F1） */
export function pageCcMine(params: WorkflowCcQuery): Promise<PageResult<WorkflowCcVO>> {
  return request.get<unknown, PageResult<WorkflowCcVO>>('/workflow/cc/page', { params });
}

/** 标记已读（仅本人记录） */
export function readCc(id: string): Promise<void> {
  return request.put<unknown, void>(`/workflow/cc/${id}/read`);
}
