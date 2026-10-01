<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElCol,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElProgress,
  ElRadio,
  ElRadioGroup,
  ElRow,
  ElSelect,
  ElSwitch,
  ElTooltip,
  ElUpload,
} from 'element-plus';
import type { FormInstance, UploadRequestOptions } from 'element-plus';
import { applyDefaults, buildRules, resolveWidget } from './schema';
import type { JsonSchemaField, JsonSchemaObject, SchemaUploadResult } from './types';

/**
 * YSchemaForm —— JSON Schema 驱动的动态表单（FE-2）。
 *
 * 与 YForm 的关系：渲染骨架一致（ElForm + ElRow/ElCol + ElFormItem），
 * 差别在输入是「数据视角」的 JSON Schema（type/format/enum/required/校验约束），
 * 因此可以由后端配置下发；**YForm 一行代码未改**。
 */

interface Props {
  /** 表单数据对象（沿用 YForm 约定：直接改传入的响应式对象，不重复 emit update:modelValue） */
  modelValue: Record<string, unknown>;
  /** JSON Schema 定义 */
  schema: JsonSchemaObject;
  labelWidth?: string | number;
  /** 整表禁用（优先级低于字段级 disabled 的显式 true，兼容写法见 isDisabled） */
  disabled?: boolean;
  /** 上传控件的接受类型 */
  uploadAccept?: string;
  /**
   * 上传执行器：由业务侧注入（@pivotos/ui 不持有任何 request 实例，与 @pivotos/components 同口径）。
   * 未注入时上传控件给出显式提示，不静默失败。
   */
  uploadFn?: (file: File) => Promise<SchemaUploadResult>;
}

const props = withDefaults(defineProps<Props>(), {
  labelWidth: '120px',
  disabled: false,
  uploadAccept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip',
  uploadFn: undefined,
});

const emit = defineEmits<{
  'field-change': [key: string, value: unknown];
  'upload-error': [key: string, message: string];
}>();

const formRef = ref<FormInstance>();

/** 条件显隐：visibleWhen 返回 false 的字段不渲染、也不参与校验 */
const visibleFields = computed<JsonSchemaField[]>(() =>
  props.schema.fields.filter((field) => {
    if (!field.visibleWhen) return true;
    try {
      return field.visibleWhen(props.modelValue);
    } catch {
      // visibleWhen 抛异常时按「显示」处理：隐藏会让用户彻底看不到该字段，
      // 属于静默失效；宁可显示出来让错误可见
      return true;
    }
  }),
);

/** 首次渲染前补齐默认值（只补 model 里缺失的 key） */
applyDefaults(props.schema.fields, props.modelValue);

/**
 * Schema 换了一份（运行时动态下发场景）要再补一次默认值。
 * 不监听 modelValue 本身 —— 用户清空某个字段后不该被 default 重新填回去。
 */
watch(
  () => props.schema.fields,
  (fields) => applyDefaults(fields, props.modelValue),
);

function setValue(field: JsonSchemaField, value: unknown): void {
  props.modelValue[field.key] = value;
  emit('field-change', field.key, value);
}

function isDisabled(field: JsonSchemaField): boolean {
  return field.disabled === true ? true : props.disabled;
}

function widgetOf(field: JsonSchemaField) {
  return resolveWidget(field);
}

function rulesOf(field: JsonSchemaField) {
  return buildRules(field);
}

function optionsOf(field: JsonSchemaField) {
  return field.options ?? [];
}

/** 只读展示：把各种形态的值收敛成可阅读文本 */
function displayText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.length ? value.join('、') : '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

// ==================== 上传 ====================
const uploadingKeys = ref<Record<string, boolean>>({});
const uploadErrors = ref<Record<string, string>>({});

async function handleUpload(field: JsonSchemaField, options: UploadRequestOptions): Promise<void> {
  // UploadRequestOptions#onError 的签名是 UploadAjaxError（要求 status/method/url），
  // 与普通 Error 不兼容；这里只借用它的「失败」语义，故做一次显式收窄
  const fail = (err: Error): void => (options.onError as unknown as (e: Error) => void)(err);
  const done = options.onSuccess as unknown as (res: unknown) => void;

  const handler = props.uploadFn;
  if (!handler) {
    uploadErrors.value[field.key] = '未配置上传方法（uploadFn）';
    fail(new Error('uploadFn missing'));
    return;
  }
  uploadingKeys.value[field.key] = true;
  uploadErrors.value[field.key] = '';
  try {
    const result = await handler(options.file);
    if (!result?.url) throw new Error('上传执行器未返回 url');
    setValue(field, result.url);
    done(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    uploadErrors.value[field.key] = message;
    emit('upload-error', field.key, message);
    fail(e instanceof Error ? e : new Error(message));
  } finally {
    uploadingKeys.value[field.key] = false;
  }
}

function clearUpload(field: JsonSchemaField): void {
  setValue(field, '');
  uploadErrors.value[field.key] = '';
}

/** 上传值可能是字符串或 { url, name }，统一取可读名 */
function uploadedName(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const tail = value.split('/').pop() ?? value;
  return decodeURIComponent(tail);
}

defineExpose({
  validate: () => formRef.value?.validate(),
  validateField: (field: string | string[]) => formRef.value?.validateField(field),
  resetFields: () => formRef.value?.resetFields(),
  clearValidate: () => formRef.value?.clearValidate(),
  /** 当前可见字段（含联动过滤结果），供上层做「Submit 前二次校验」或调试 */
  visibleFields: () => visibleFields.value,
});
</script>

<template>
  <ElForm
    ref="formRef"
    class="y-schema-form"
    :model="modelValue"
    :label-width="labelWidth"
    :disabled="disabled"
    @submit.prevent
  >
    <ElRow :gutter="16">
      <ElCol v-for="field in visibleFields" :key="field.key" :span="field.span ?? 24">
        <ElFormItem :prop="field.key" :rules="rulesOf(field)">
          <template #label>
            <span>{{ field.title }}</span>
            <ElTooltip v-if="field.description" :content="field.description" placement="top">
              <span class="y-schema-form__desc">?</span>
            </ElTooltip>
          </template>

          <!-- 只读 -->
          <span v-if="field.readonly" class="y-schema-form__readonly">
            {{ displayText(modelValue[field.key]) }}
          </span>

          <!-- 文本 / 密码 / 多行 -->
          <ElInput
            v-else-if="widgetOf(field) === 'input' || widgetOf(field) === 'password' || widgetOf(field) === 'textarea'"
            :model-value="(modelValue[field.key] as string | undefined)"
            :type="widgetOf(field) === 'textarea' ? 'textarea' : widgetOf(field) === 'password' ? 'password' : 'text'"
            :rows="widgetOf(field) === 'textarea' ? 3 : undefined"
            :maxlength="field.maxLength"
            :placeholder="field.placeholder ?? `请输入${field.title}`"
            :disabled="isDisabled(field)"
            clearable
            @update:model-value="(v: string) => setValue(field, v)"
          />

          <!-- 数字 -->
          <ElInputNumber
            v-else-if="widgetOf(field) === 'number'"
            :model-value="(modelValue[field.key] as number | undefined)"
            :min="field.minimum"
            :max="field.maximum"
            :precision="field.type === 'integer' ? 0 : undefined"
            :disabled="isDisabled(field)"
            style="width: 100%"
            controls-position="right"
            @update:model-value="(v: number | undefined) => setValue(field, v)"
          />

          <!-- 单选下拉 -->
          <ElSelect
            v-else-if="widgetOf(field) === 'select'"
            :model-value="(modelValue[field.key] as string | number | boolean | undefined)"
            :placeholder="field.placeholder ?? `请选择${field.title}`"
            :disabled="isDisabled(field)"
            style="width: 100%"
            clearable
            @update:model-value="(v: unknown) => setValue(field, v)"
          >
            <ElOption
              v-for="opt in optionsOf(field)"
              :key="String(opt.value)"
              :label="opt.label"
              :value="opt.value"
              :disabled="opt.disabled"
            />
          </ElSelect>

          <!-- 多选下拉 -->
          <ElSelect
            v-else-if="widgetOf(field) === 'multiple-select'"
            :model-value="(modelValue[field.key] as unknown[] | undefined)"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :placeholder="field.placeholder ?? `请选择${field.title}`"
            :disabled="isDisabled(field)"
            style="width: 100%"
            @update:model-value="(v: unknown) => setValue(field, v)"
          >
            <ElOption
              v-for="opt in optionsOf(field)"
              :key="String(opt.value)"
              :label="opt.label"
              :value="opt.value"
              :disabled="opt.disabled"
            />
          </ElSelect>

          <!-- 单选组 -->
          <ElRadioGroup
            v-else-if="widgetOf(field) === 'radio'"
            :model-value="(modelValue[field.key] as string | number | boolean | undefined)"
            :disabled="isDisabled(field)"
            @update:model-value="(v: unknown) => setValue(field, v)"
          >
            <ElRadio
              v-for="opt in optionsOf(field)"
              :key="String(opt.value)"
              :value="opt.value"
              :disabled="opt.disabled"
            >
              {{ opt.label }}
            </ElRadio>
          </ElRadioGroup>

          <!-- 多选组 -->
          <ElCheckboxGroup
            v-else-if="widgetOf(field) === 'checkbox'"
            :model-value="(modelValue[field.key] as (string | number)[] | undefined)"
            :disabled="isDisabled(field)"
            @update:model-value="(v: unknown) => setValue(field, v)"
          >
            <ElCheckbox
              v-for="opt in optionsOf(field)"
              :key="String(opt.value)"
              :value="opt.value"
              :disabled="opt.disabled"
            >
              {{ opt.label }}
            </ElCheckbox>
          </ElCheckboxGroup>

          <!-- 开关 -->
          <ElSwitch
            v-else-if="widgetOf(field) === 'switch'"
            :model-value="(modelValue[field.key] as boolean | undefined)"
            :disabled="isDisabled(field)"
            @update:model-value="(v: unknown) => setValue(field, v)"
          />

          <!-- 日期 / 日期时间 / 日期区间 -->
          <ElDatePicker
            v-else-if="widgetOf(field) === 'date' || widgetOf(field) === 'datetime'"
            :model-value="(modelValue[field.key] as string | undefined)"
            :type="widgetOf(field) === 'datetime' ? 'datetime' : 'date'"
            :value-format="widgetOf(field) === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
            :placeholder="field.placeholder ?? `请选择${field.title}`"
            :disabled="isDisabled(field)"
            style="width: 100%"
            @update:model-value="(v: unknown) => setValue(field, v)"
          />
          <ElDatePicker
            v-else-if="widgetOf(field) === 'date-range'"
            :model-value="(modelValue[field.key] as [string, string] | undefined)"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :disabled="isDisabled(field)"
            style="width: 100%"
            @update:model-value="(v: unknown) => setValue(field, v)"
          />

          <!-- 上传：值存 url 字符串，回显文件名 + 可清除 -->
          <div v-else-if="widgetOf(field) === 'upload'" class="y-schema-form__upload">
            <ElUpload
              :show-file-list="false"
              :accept="uploadAccept"
              :disabled="isDisabled(field)"
              :http-request="(opts: UploadRequestOptions) => handleUpload(field, opts)"
            >
              <ElButton :disabled="isDisabled(field)">
                {{ modelValue[field.key] ? '重新上传' : '点击上传' }}
              </ElButton>
            </ElUpload>
            <span v-if="uploadedName(modelValue[field.key])" class="y-schema-form__file">
              {{ uploadedName(modelValue[field.key]) }}
              <ElButton link type="danger" @click="clearUpload(field)">清除</ElButton>
            </span>
            <ElProgress
              v-if="uploadingKeys[field.key]"
              class="y-schema-form__progress"
              :percentage="100"
              :indeterminate="true"
              :duration="1"
              :show-text="false"
            />
            <span v-if="uploadErrors[field.key]" class="y-schema-form__error">
              {{ uploadErrors[field.key] }}
            </span>
          </div>

          <!-- 兜底：未知 widget 不静默吞掉，直接提示便于早期发现 schema 错误 -->
          <ElInput
            v-else
            :model-value="String(modelValue[field.key] ?? '')"
            placeholder="未知控件类型，请检查 schema"
            disabled
          />
        </ElFormItem>
      </ElCol>
      <slot />
    </ElRow>
  </ElForm>
</template>

<style scoped>
.y-schema-form__desc {
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 12px;
  text-align: center;
  cursor: help;
}

.y-schema-form__readonly {
  color: var(--el-text-color-regular);
}

.y-schema-form__upload {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.y-schema-form__file {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.y-schema-form__progress {
  flex: 1;
  min-width: 80px;
}

.y-schema-form__error {
  color: var(--el-color-danger);
  font-size: 12px;
}
</style>
