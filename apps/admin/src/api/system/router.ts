import type { RouterVO } from '@pivotos/types';
import { request } from '../request';

/** 当前用户动态路由（登录即可读） */
export function getRouters(): Promise<RouterVO[]> {
  return request.get<unknown, RouterVO[]>('/system/menu/routers');
}
