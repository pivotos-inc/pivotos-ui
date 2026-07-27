/**
 * YTable 列定义。
 * - type 为 Element Plus 内置特殊列（index / selection / expand）
 * - slot 指定插槽名后，单元格内容交由业务侧渲染
 * - perm 指定权限串后，无权限时整列隐藏（按钮级权限请配合 v-hasPermi）
 */
export interface YTableColumn<T = Record<string, unknown>> {
  /** 字段名（type 列可不填） */
  prop?: string;
  /** 列标题 */
  label?: string;
  /** 特殊列类型 */
  type?: 'index' | 'selection' | 'expand';
  /** 固定宽度 */
  width?: string | number;
  /** 最小宽度 */
  minWidth?: string | number;
  /** 对齐方式，默认 left */
  align?: 'left' | 'center' | 'right';
  /** 固定列 */
  fixed?: boolean | 'left' | 'right';
  /** 超长省略 + tooltip，默认 true */
  showOverflowTooltip?: boolean;
  /** 内容格式化（优先于 prop 原值展示） */
  formatter?: (row: T, column: unknown, cellValue: unknown, index: number) => string;
  /** 单元格插槽名 */
  slot?: string;
  /** 列级权限串（无权限隐藏整列） */
  perm?: string;
}
