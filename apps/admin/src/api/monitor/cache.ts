import type { CacheInfoVO } from '@pivotos/types';
import { request } from '../request';

/**
 * 缓存监控 API（S48 2.3-F7）
 */
export function getCacheInfo(): Promise<CacheInfoVO> {
  return request.get<unknown, CacheInfoVO>('/monitor/cache');
}
