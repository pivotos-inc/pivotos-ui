import { createUseDict, createUseTablePage } from '@pivotos/core';
import { request } from '@/api/request';

/**
 * 注入全局 request 实例后的 hooks（业务页面统一从这里取）。
 *
 * 用法：
 *   const { sys_common_status } = useDict('sys_common_status');
 *   const { loading, rows, total, params, load, search, reset } = useTablePage<UserVO>({ url: '/system/user/page' });
 */
export const useDict = createUseDict(request);
export const useTablePage = createUseTablePage(request);
