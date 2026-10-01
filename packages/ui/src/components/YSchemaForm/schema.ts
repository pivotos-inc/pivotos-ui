import type { FormItemRule } from 'element-plus';
import type { JsonSchemaField, JsonSchemaWidget } from './types';

/**
 * Schema → 控件形态推导（纯函数）。
 *
 * 优先级：**显式 widget > format > type**。推导必须是确定性的（不查网络、不看环境），
 * 否则「同一份 schema 在不同页面渲染成不同控件」，排查成本极高。
 */
export function resolveWidget(field: JsonSchemaField): JsonSchemaWidget {
  if (field.widget) return field.widget;

  switch (field.format) {
    case 'textarea':
      return 'textarea';
    case 'password':
      return 'password';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'date-range':
      return 'date-range';
    case 'upload':
      return 'upload';
    default:
      break;
  }

  switch (field.type) {
    case 'boolean':
      return 'switch';
    case 'number':
    case 'integer':
      return 'number';
    case 'array':
      return 'checkbox';
    case 'string':
      // 带选项的字符串默认走单选下拉；无选项时才是文本框
      return field.options?.length ? 'select' : 'input';
    default:
      return 'input';
  }
}

/** 内置 pattern：统一写字符串形态，便于 JSON 序列化与跨端传输 */
const EMAIL_PATTERN = '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';
const URL_PATTERN = '^(https?|ftp)://[^\\s/$.?#][^\\s]*$';

/** 需要「请选择」而非「请输入」文案的控件 */
const PICKER_WIDGETS: JsonSchemaWidget[] = [
  'select',
  'multiple-select',
  'radio',
  'date',
  'datetime',
  'date-range',
  'upload',
];

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Schema → Element Plus 校验规则（纯函数，可单测）。
 *
 * 口径：
 * - `required` 的文案按控件类型分流（下拉/日期/上传说「请选择」，其余说「请输入」）；
 * - 只在「有值」时才做 format / 长度 / 区间校验（blank 一律放行），
 *   否则会出现「非必填字段留空却报格式错误」的经典误伤；
 * - 每条规则带 type 标记，便于上层按 schema 语义做二次处理。
 */
export function buildRules(field: JsonSchemaField): FormItemRule[] {
  const rules: FormItemRule[] = [];
  const widget = resolveWidget(field);
  const label = field.title || field.key;

  if (field.required) {
    const verb = PICKER_WIDGETS.includes(widget) ? '请选择' : '请输入';
    rules.push({
      required: true,
      message: field.type === 'array' ? `请至少选择一项` : `${verb}${label}`,
      trigger: widget === 'number' ? ['blur', 'change'] : ['blur', 'change'],
    });
  }

  if (field.type === 'string') {
    if (typeof field.minLength === 'number') {
      rules.push({
        validator: (_rule, value: unknown, callback) => {
          if (isBlank(value)) return callback();
          return String(value).length >= (field.minLength as number)
            ? callback()
            : callback(new Error(`${label}至少 ${field.minLength} 个字符`));
        },
        trigger: 'blur',
      });
    }
    if (typeof field.maxLength === 'number') {
      rules.push({
        max: field.maxLength,
        message: `${label}最多 ${field.maxLength} 个字符`,
        trigger: 'blur',
      });
    }
    const pattern = field.pattern ?? (field.format === 'email' ? EMAIL_PATTERN : field.format === 'url' ? URL_PATTERN : undefined);
    if (pattern) {
      rules.push({
        pattern: new RegExp(pattern),
        message: field.patternMessage ?? `${label}格式不正确`,
        trigger: 'blur',
      });
    }
  }

  if (field.type === 'number' || field.type === 'integer') {
    if (field.type === 'integer') {
      rules.push({
        validator: (_rule, value: unknown, callback) => {
          if (isBlank(value)) return callback();
          return Number.isInteger(Number(value)) ? callback() : callback(new Error(`${label}必须为整数`));
        },
        trigger: ['blur', 'change'],
      });
    }
    if (typeof field.minimum === 'number') {
      rules.push({
        validator: (_rule, value: unknown, callback) => {
          if (isBlank(value)) return callback();
          return Number(value) >= (field.minimum as number)
            ? callback()
            : callback(new Error(`${label}不能小于 ${field.minimum}`));
        },
        trigger: ['blur', 'change'],
      });
    }
    if (typeof field.maximum === 'number') {
      rules.push({
        validator: (_rule, value: unknown, callback) => {
          if (isBlank(value)) return callback();
          return Number(value) <= (field.maximum as number)
            ? callback()
            : callback(new Error(`${label}不能大于 ${field.maximum}`));
        },
        trigger: ['blur', 'change'],
      });
    }
  }

  if (field.type === 'array') {
    if (typeof field.minItems === 'number') {
      rules.push({
        validator: (_rule, value: unknown, callback) => {
          const len = Array.isArray(value) ? value.length : 0;
          if (len === 0) return callback();
          return len >= (field.minItems as number)
            ? callback()
            : callback(new Error(`${label}至少选择 ${field.minItems} 项`));
        },
        trigger: 'change',
      });
    }
    if (typeof field.maxItems === 'number') {
      rules.push({
        validator: (_rule, value: unknown, callback) => {
          const len = Array.isArray(value) ? value.length : 0;
          return len <= (field.maxItems as number)
            ? callback()
            : callback(new Error(`${label}最多选择 ${field.maxItems} 项`));
        },
        trigger: 'change',
      });
    }
  }

  // 业务侧追加规则放在最后：ElForm 顺序执行，先过 schema 内建约束再看定制规则
  if (field.rules?.length) {
    rules.push(...field.rules);
  }

  return rules;
}

/** 默认值填充（只填 model 中尚不存在的 key，避免覆盖业务侧已给的初值） */
export function applyDefaults(fields: JsonSchemaField[], model: Record<string, unknown>): void {
  for (const field of fields) {
    if (field.default === undefined) continue;
    if (model[field.key] !== undefined) continue;
    model[field.key] = Array.isArray(field.default)
      ? [...field.default]
      : field.default && typeof field.default === 'object'
        ? { ...(field.default as Record<string, unknown>) }
        : field.default;
  }
}
