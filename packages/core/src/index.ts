// 认证持有器（宿主注册）
export {
  registerTokenGetter,
  getToken,
  registerUnauthorizedHandler,
} from './auth/holder';

// 权限
export { registerPermSource, hasPermi, hasRole } from './permission/checker';
export type { PermSource } from './permission/checker';

// 请求
export { createRequest } from './request';
export type { CreateRequestOptions, RequestConfig } from './request';
export { ServiceError, RepeatSubmitError } from './request/error';

// 指令
export { vHasPermi, vHasRole, setupPermissionDirectives } from './directives/permission';

// hooks（工厂模式：注入 request 实例后使用）
export { createUseDict } from './hooks/useDict';
export { createUseTablePage } from './hooks/useTablePage';
export { createUseDownload } from './hooks/useDownload';

// 工具
export { listToTree } from './utils/tree';
export type { TreeNode } from './utils/tree';
export { formatDate } from './utils/date';
