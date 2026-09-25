import type { AxiosResponse } from 'axios';
import { request } from '../request';
import type { WarmDefJson } from '@/utils/workflow/bpmnDefJson';

/**
 * warm-flow 设计器后端契约（内置 jar 控制器 /warm-flow/*，与 /workflow/ 域隔离复用）。
 *
 * ⚠️ 口径差异（S103 K6）：warm-flow ApiResult 成功码是 200，平台统一 R 成功码是 0，
 * 全局 request 包装只认 0——必须 raw 模式拿原始响应后自行解包，否则保存/回读全被误判「请求失败」。
 */
interface WarmApiResult<T> {
  code: number;
  msg?: string;
  data: T;
}

function unwrapWarm<T>(resp: AxiosResponse<WarmApiResult<T>>): T {
  const body = resp.data;
  if (body && (body.code === 200 || body.code === 0)) {
    return body.data;
  }
  throw new Error(body?.msg || `warm-flow 接口异常（code=${body?.code}）`);
}

/** 保存流程定义（新建/覆盖）；onlyNodeSkip=false 表示提交完整节点+跳转模型 */
export async function saveDefJson(def: WarmDefJson): Promise<void> {
  const resp = await request.post<unknown, AxiosResponse<WarmApiResult<void>>>(
    '/warm-flow/save-json',
    def,
    { raw: true, headers: { onlyNodeSkip: 'false' } },
  );
  unwrapWarm(resp);
}

/** 回读流程定义 DefJson（编辑回显 / 保存后比对取证） */
export async function queryDefJson(id: string | number): Promise<WarmDefJson> {
  const resp = await request.get<unknown, AxiosResponse<WarmApiResult<WarmDefJson>>>(
    `/warm-flow/query-def/${id}`,
    { raw: true },
  );
  return unwrapWarm(resp);
}
