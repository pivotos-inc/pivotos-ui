/** 权限数据源（宿主注入，返回当前用户 perms/roles） */
export interface PermSource {
  perms: () => string[];
  roles: () => string[];
}

const ALL_PERMISSION = '*:*:*';
const SUPER_ROLE = 'super_admin';

let source: PermSource = {
  perms: () => [],
  roles: () => [],
};

export function registerPermSource(permSource: PermSource): void {
  source = permSource;
}

/** 是否拥有任一权限（value 可为串或数组，数组为 OR 语义） */
export function hasPermi(value: string | string[]): boolean {
  const perms = source.perms();
  if (perms.includes(ALL_PERMISSION)) return true;
  const required = Array.isArray(value) ? value : [value];
  return required.some((p) => perms.includes(p));
}

/** 是否拥有任一角色 */
export function hasRole(value: string | string[]): boolean {
  const roles = source.roles();
  if (roles.includes(SUPER_ROLE)) return true;
  const required = Array.isArray(value) ? value : [value];
  return required.some((r) => roles.includes(r));
}
