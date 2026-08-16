import type { JobHandlerVO, JobSaveRequest, JobVO } from '@pivotos/types';
import { request } from '../request';

const BASE = '/system/job';

/** 定时任务详情 */
export function getJob(id: string): Promise<JobVO> {
  return request.get<unknown, JobVO>(`${BASE}/${id}`);
}

/** 已注册 Handler 列表 */
export function getJobHandlers(): Promise<JobHandlerVO[]> {
  return request.get<unknown, JobHandlerVO[]>(`${BASE}/handlers`);
}

/** 新增定时任务 */
export function createJob(body: JobSaveRequest): Promise<string> {
  return request.post<unknown, string>(BASE, body);
}

/** 修改定时任务 */
export function updateJob(body: JobSaveRequest): Promise<void> {
  return request.put<unknown, void>(BASE, body);
}

/** 删除定时任务 */
export function deleteJob(id: string): Promise<void> {
  return request.delete<unknown, void>(`${BASE}/${id}`);
}

/** 启停切换（status: 0=暂停 1=运行） */
export function changeJobStatus(id: string, status: number): Promise<void> {
  return request.put<unknown, void>(`${BASE}/${id}/status`, null, { params: { status } });
}

/** 手动触发一次执行 */
export function triggerJobById(id: string): Promise<void> {
  return request.post<unknown, void>(`${BASE}/${id}/trigger`);
}

/** 预览最近 5 次执行时间 */
export function getNextTriggerTime(
  scheduleType: string,
  scheduleConf: string,
): Promise<string[]> {
  return request.get<unknown, string[]>(`${BASE}/nextTriggerTime`, {
    params: { scheduleType, scheduleConf },
  });
}
