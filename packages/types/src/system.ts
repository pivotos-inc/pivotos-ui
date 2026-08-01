import type { BaseVO, Emptyable, PageQuery } from './common';

/* ================= 用户 ================= */

/** 用户分页查询（对齐 UserQuery） */
export interface UserQuery extends PageQuery {
  username?: string;
  nickname?: string;
  mobile?: string;
  deptId?: string;
  postId?: string;
  status?: Emptyable<number>;
}

/** 用户新增/修改请求（对齐 UserSaveRequest；id 为空为新增，password 仅新增必填） */
export interface UserSaveRequest {
  id?: string;
  username: string;
  nickname: string;
  password?: string;
  deptId?: string;
  postId?: string;
  email?: string;
  mobile?: string;
  gender?: number;
  avatar?: string;
  status?: number;
  remark?: string;
  roleIds?: string[];
}

/** 重置密码请求（对齐 ResetPasswordBody） */
export interface ResetPasswordBody {
  userId: string;
  password: string;
}

/* ================= 角色 ================= */

/** 角色视图对象（对齐 RoleVO） */
export interface RoleVO extends BaseVO {
  roleName: string;
  roleCode: string;
  sort?: number;
  status?: number;
  remark?: string;
}

/** 角色分页查询（对齐 RoleQuery） */
export interface RoleQuery extends PageQuery {
  roleName?: string;
  roleCode?: string;
  status?: Emptyable<number>;
}

/** 角色新增/修改请求（对齐 RoleSaveRequest） */
export interface RoleSaveRequest {
  id?: string;
  roleName: string;
  roleCode: string;
  sort?: number;
  status?: number;
  remark?: string;
  menuIds?: string[];
}

/* ================= 菜单 ================= */

/** 菜单视图对象（对齐 MenuVO，children 用于树形返回） */
export interface MenuVO extends BaseVO {
  parentId: string;
  menuName: string;
  /** M目录 C菜单 F按钮 */
  menuType: 'M' | 'C' | 'F';
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sort?: number;
  visible?: number;
  status?: number;
  children?: MenuVO[];
}

/** 菜单查询（对齐 MenuQuery，树形列表不分页） */
export interface MenuQuery {
  menuName?: string;
  status?: Emptyable<number>;
}

/** 菜单新增/修改请求（对齐 MenuSaveRequest） */
export interface MenuSaveRequest {
  id?: string;
  parentId: string;
  menuName: string;
  menuType: 'M' | 'C' | 'F';
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sort?: number;
  visible?: number;
  status?: number;
}

/* ================= 部门 ================= */

/** 部门视图对象（对齐 DeptVO，children 用于树形返回） */
export interface DeptVO extends BaseVO {
  parentId: string;
  deptName: string;
  ancestors?: string;
  leaderId?: string;
  sort?: number;
  status?: number;
  children?: DeptVO[];
}

/** 部门查询（对齐 DeptQuery，树形列表不分页） */
export interface DeptQuery {
  deptName?: string;
  status?: Emptyable<number>;
}

/** 部门新增/修改请求（对齐 DeptSaveRequest） */
export interface DeptSaveRequest {
  id?: string;
  parentId: string;
  deptName: string;
  leaderId?: string;
  sort?: number;
  status?: number;
}

/* ================= 岗位 ================= */

/** 岗位视图对象（对齐 PostVO） */
export interface PostVO extends BaseVO {
  postCode: string;
  postName: string;
  sort?: number;
  status?: number;
  remark?: string;
}

/** 岗位查询（对齐 PostQuery，不分页直接列表） */
export interface PostQuery {
  postCode?: string;
  postName?: string;
  status?: Emptyable<number>;
}

/** 岗位新增/修改请求（对齐 PostSaveRequest） */
export interface PostSaveRequest {
  id?: string;
  postCode: string;
  postName: string;
  sort?: number;
  status?: number;
  remark?: string;
}

/* ================= 字典 ================= */

/** 字典类型视图对象（对齐 DictTypeVO） */
export interface DictTypeVO extends BaseVO {
  dictName: string;
  dictType: string;
  status?: number;
  remark?: string;
}

/** 字典类型分页查询（对齐 DictTypeQuery） */
export interface DictTypeQuery extends PageQuery {
  dictName?: string;
  dictType?: string;
  status?: Emptyable<number>;
}

/** 字典类型新增/修改请求（对齐 DictTypeSaveRequest） */
export interface DictTypeSaveRequest {
  id?: string;
  dictName: string;
  dictType: string;
  status?: number;
  remark?: string;
}

/** 字典数据分页查询（对齐 DictDataQuery） */
export interface DictDataQuery extends PageQuery {
  dictType?: string;
  dictLabel?: string;
  status?: Emptyable<number>;
}

/** 字典数据新增/修改请求（对齐 DictDataSaveRequest） */
export interface DictDataSaveRequest {
  id?: string;
  dictType: string;
  dictLabel: string;
  dictValue: string;
  sort?: number;
  status?: number;
  remark?: string;
}

/* ================= 参数配置 ================= */

/** 参数配置视图对象（对齐 ConfigVO） */
export interface ConfigVO extends BaseVO {
  configName: string;
  configKey: string;
  configValue: string;
  configType?: string;
  remark?: string;
}

/** 参数配置分页查询（对齐 ConfigQuery） */
export interface ConfigQuery extends PageQuery {
  configName?: string;
  configKey?: string;
  configType?: string;
}

/** 参数配置新增/修改请求（对齐 ConfigSaveRequest） */
export interface ConfigSaveRequest {
  id?: string;
  configName: string;
  configKey: string;
  configValue: string;
  configType?: string;
  remark?: string;
}

/* ================= 登录日志 ================= */

/** 登录日志视图对象（对齐 LoginLogVO） */
export interface LoginLogVO extends BaseVO {
  username: string;
  ip?: string;
  userAgent?: string;
  /** 0成功 1失败 */
  status: number;
  msg?: string;
  loginTime: string;
}

/** 登录日志分页查询（对齐 LoginLogQuery） */
export interface LoginLogQuery extends PageQuery {
  username?: string;
  ip?: string;
  status?: Emptyable<number>;
  beginTime?: string;
  endTime?: string;
}

/* ================= 操作日志 ================= */

/** 操作日志视图对象（对齐 OperLogVO） */
export interface OperLogVO extends BaseVO {
  module: string;
  operType: string;
  operName?: string;
  operUserId?: string;
  method?: string;
  requestMethod?: string;
  requestUrl?: string;
  requestParams?: string;
  /** 0成功 1失败 */
  status: number;
  errorMsg?: string;
  duration?: number;
  operTime: string;
}

/** 操作日志分页查询（对齐 OperLogQuery） */
export interface OperLogQuery extends PageQuery {
  module?: string;
  operType?: string;
  operName?: string;
  status?: Emptyable<number>;
  beginTime?: string;
  endTime?: string;
}

/* ================= 通知公告 ================= */

/** 通知公告视图对象（对齐 NoticeVO） */
export interface NoticeVO extends BaseVO {
  title: string;
  /** 1通知 2公告 */
  noticeType: number;
  /** 富文本 HTML（列表接口不回吐，仅详情） */
  content?: string;
  /** 0草稿 1已发布 2已撤回 */
  status: number;
  publishTime?: string;
  remark?: string;
}

/** 通知公告分页查询（对齐 NoticeQuery） */
export interface NoticeQuery extends PageQuery {
  title?: string;
  noticeType?: Emptyable<number>;
  status?: Emptyable<number>;
}

/** 通知公告新增/修改请求（对齐 NoticeSaveRequest） */
export interface NoticeSaveRequest {
  id?: string;
  title: string;
  noticeType: number;
  content?: string;
  remark?: string;
}
