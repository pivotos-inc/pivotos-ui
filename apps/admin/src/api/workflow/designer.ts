import { request } from '../request';
import type { WarmDefJson } from '@/utils/workflow/bpmnDefJson';

/** warm-flow 设计器后端契约（内置 jar 控制器 /warm-flow/*，与 /workflow/ 域隔离复用） */

/** 保存流程定义（新建/覆盖）；onlyNodeSkip=false 表示提交完整节点+跳转模型 */
export function saveDefJson(def: WarmDefJson): Promise<void> {
  return request.post<unknown, void>('/warm-flow/save-json', def, {
    headers: { onlyNodeSkip: 'false' },
  });
}

/** 回读流程定义 DefJson（编辑回显 / 保存后比对取证） */
export function queryDefJson(id: string | number): Promise<WarmDefJson> {
  return request.get<unknown, WarmDefJson>(`/warm-flow/query-def/${id}`);
}
