/**
 * @pivotos/components —— PivotOS 业务组件库（导出白名单）。
 *
 * 定位：跨页面复用的业务组件，基于 @pivotos/ui 与 Element Plus 原子组件封装。
 * 数据获取一律由业务侧注入（fetchOptions / upload 等 props），本包不直接依赖宿主 store 或 request 实例。
 */

// 字典回显
export { default as DictTag } from './DictTag/DictTag.vue';

// 部门树（含过滤）
export { default as DeptTree } from './DeptTree/DeptTree.vue';
export type { DeptTreeNode } from './DeptTree/types';

// 用户远程搜索选择
export { default as UserSelect } from './UserSelect/UserSelect.vue';
export type { UserSelectOption } from './UserSelect/types';

// 用户弹窗选择（多选 + 分页 + 搜索）
export { default as UserPicker } from './UserPicker/UserPicker.vue';
export type { UserPickerPage, UserPickerQuery, UserPickerUser } from './UserPicker/types';

// 图标弹窗选择（候选集由业务侧注入）
export { default as IconPicker } from './IconPicker/IconPicker.vue';
export type { IconPickerOption } from './IconPicker/types';

// 文件上传（注入上传执行器，对接 file Starter 签名直传）
export { default as FileUpload } from './FileUpload/FileUpload.vue';

// Excel 导入导出（注入业务侧 axios 调用，对接 starter-excel）
export { default as YExcel } from './YExcel/YExcel.vue';
export type { ImportResult, ImportError, ImportStreamRow, ImportStreamDone, ImportStreamCallbacks, ImportStreamFn } from './YExcel/types';
