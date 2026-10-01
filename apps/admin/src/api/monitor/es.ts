import type { EsInfoVO } from '@pivotos/types';
import { request } from '../request';

/**
 * ES 监控 API（系统监控 · ES 监控）
 * 降级口径：后端在 simple / 未启用 / 连接不可达时返回 code=0 + available=false + reason 文案，
 * 前端不做异常提示，直接把 reason 展示在页面上。
 */
export function getEsInfo(): Promise<EsInfoVO> {
  return request.get<unknown, EsInfoVO>('/monitor/es');
}
