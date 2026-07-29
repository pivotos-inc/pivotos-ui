/**
 * @pivotos/ui —— PivotOS UI 抽象层（导出白名单）。
 *
 * 纪律：业务侧（apps/* 与 @pivotos/components）只能从本文件导出的符号拿组件，
 * 禁止直接 import element-plus。新增封装组件必须在此登记导出。
 */

// 表格（分页/加载态/权限列内置）
export { default as YTable } from './components/YTable/YTable.vue';
export type { YTableColumn } from './components/YTable/types';

// 表单（Schema 驱动）
export { default as YForm } from './components/YForm/YForm.vue';
export type { YFormComponentType, YFormOption, YFormSchema } from './components/YForm/types';

// 弹窗
export { default as YDialog } from './components/YDialog/YDialog.vue';

// 查询表单
export { default as YSearchForm } from './components/YSearchForm/YSearchForm.vue';

// 主题系统（CSS 变量 + 暗色模式）
export { initTheme, useDarkMode } from './theme';
export type { ThemeMode } from './theme';
