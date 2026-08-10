import { request } from '../request';

const BASE = '/system/joblog';

/** 手动触发任务（同步执行，返回结果文案） */
export function triggerJob(handler: string) {
  return request.post<unknown, string>(`${BASE}/trigger/${handler}`);
}
