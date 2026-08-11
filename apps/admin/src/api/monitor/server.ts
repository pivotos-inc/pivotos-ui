import type { ServerInfoVO } from '@pivotos/types';
import { request } from '../request';

/**
 * 服务监控 API（S48 2.3-F7）
 */
export function getServerInfo(): Promise<ServerInfoVO> {
  return request.get<unknown, ServerInfoVO>('/monitor/server');
}
