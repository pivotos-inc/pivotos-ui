import type { FormItemRule } from 'element-plus';

/** YForm 支持的控件类型 */
export type YFormComponentType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'daterange';

export interface YFormOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
}

/** Schema 驱动的表单项定义 */
export interface YFormSchema {
  /** 绑定字段名 */
  field: string;
  /** 标签 */
  label: string;
  /** 控件类型 */
  component: YFormComponentType;
  /** 透传给底层 EP 控件的 props */
  props?: Record<string, unknown>;
  /** select / radio / checkbox 的选项 */
  options?: YFormOption[];
  /**
   * select 顶部插入"请选择"空值项（value=''）并作为默认选中，默认 true。
   * 传字符串可自定义文案（如 '全部'）；传 false 关闭（如必选场景不需要空值项）。
   * multiple 多选时自动忽略。
   */
  emptyOption?: boolean | string;
  /** 单项校验规则（优先级高于顶层 rules） */
  rules?: FormItemRule[];
  /** 占位提示 */
  placeholder?: string;
  /** 栅格宽度（非 inline 模式生效，1-24，默认 24） */
  span?: number;
}
