import type { FormItemRule } from 'element-plus';

/**
 * YSchemaForm —— JSON Schema 驱动的动态表单契约。
 *
 * 设计取舍（与 YForm 的分工）：
 * - YForm 用「控件视角」的 schema（component: 'input' | 'select' …），适合开发期手写；
 * - YSchemaForm 用「数据视角」的 JSON Schema 子集（type / enum / required / minLength / pattern …），
 *   适合**运行期由后端或配置下发**（动态表单、表单设计器、低代码建模等场景）；
 * - 二者渲染层风格一致（ElForm + ElRow/ElCol + ElFormItem），互不引用，避免职责缠绕。
 */

/** JSON Schema 基础类型子集 */
export type JsonSchemaFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'array';

/** 控件形态（可由 type/format 推导，也可显式指定，显式优先） */
export type JsonSchemaWidget =
  | 'input'
  | 'textarea'
  | 'password'
  | 'number'
  | 'select'
  | 'multiple-select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'datetime'
  | 'date-range'
  | 'upload';

/** 语义化格式：既影响控件推导，也决定内置校验（email / url）与日期格式 */
export type JsonSchemaFormat =
  | 'text'
  | 'textarea'
  | 'password'
  | 'email'
  | 'url'
  | 'date'
  | 'datetime'
  | 'date-range'
  | 'upload';

export interface JsonSchemaOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
}

/** 单个字段的 Schema 定义 */
export interface JsonSchemaField {
  /** 字段名（对应表单 model 的 key，必须唯一） */
  key: string;
  /** 标签文案 */
  title: string;
  /** JSON Schema 类型 */
  type: JsonSchemaFieldType;
  /** 语义格式（参与控件推导与内置校验） */
  format?: JsonSchemaFormat;
  /** 控件显式指定（优先级高于 type/format 推导） */
  widget?: JsonSchemaWidget;
  /** 选项集：type=string 且带 options → select；type=array → 多选（checkbox） */
  options?: JsonSchemaOption[];
  /** 字段说明（渲染为 label 后缀 tooltip 文案） */
  description?: string;
  placeholder?: string;
  /** 默认值：初始化/window 重置时写入 model */
  default?: unknown;
  required?: boolean;
  /** 字符串长度约束 */
  minLength?: number;
  maxLength?: number;
  /** 正则校验（字符串统一用字符串形态，避免 Date→RegExp 序列化丢 RegExp 原型） */
  pattern?: string;
  /** 正则不匹配时的文案，缺省用内置文案 */
  patternMessage?: string;
  /** 数值区间（number / integer） */
  minimum?: number;
  maximum?: number;
  /** 数组长度约束（type=array） */
  minItems?: number;
  maxItems?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 栅格宽度（1-24，默认 24） */
  span?: number;
  /** 只读（渲染为文本，不生成控件）：用于详情/预览场景 */
  readonly?: boolean;
  /**
   * 条件显隐 / 联动：返回 false 时字段不渲染，**也不参与校验**。
   * 用函数而非表达式字符串 —— 禁 eval，且能在编译期拿到类型。
   */
  visibleWhen?: (model: Record<string, unknown>) => boolean;
  /** 追加的业务规则（叠加在 schema 推导规则之上） */
  rules?: FormItemRule[];
}

/** Schema 根定义 */
export interface JsonSchemaObject {
  /** 表单标题（可选，用于调试与后端下发自检） */
  title?: string;
  fields: JsonSchemaField[];
}

/** 上传执行器返回值：注入式设计，@pivotos/ui 不依赖任何 request 实例 */
export interface SchemaUploadResult {
  url: string;
  name?: string;
}
