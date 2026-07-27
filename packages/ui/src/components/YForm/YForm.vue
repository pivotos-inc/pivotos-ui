<script setup lang="ts">
import { ref } from 'vue';
import {
  ElCheckbox,
  ElCheckboxGroup,
  ElCol,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElRow,
  ElSelect,
  ElSwitch,
} from 'element-plus';
import type { FormInstance, FormItemRule } from 'element-plus';
import type { YFormSchema } from './types';

interface Props {
  /** 表单数据对象（v-model） */
  modelValue: Record<string, unknown>;
  /** Schema 定义 */
  schemas: YFormSchema[];
  labelWidth?: string | number;
  /** inline 模式（查询表单场景） */
  inline?: boolean;
  /** 顶层校验规则 */
  rules?: Record<string, FormItemRule[]>;
}

withDefaults(defineProps<Props>(), {
  labelWidth: '100px',
  inline: false,
  rules: undefined,
});

/**
 * 约定：YForm 直接改传入的 reactive 模型对象（v-model 约定见 eslint 规则说明），
 * 因此不重复声明 update:modelValue emit。
 */
const formRef = ref<FormInstance>();

/** 是否注入"请选择"空值项：select 单选且未显式关闭 */
function showEmptyOption(s: YFormSchema): boolean {
  if (s.component !== 'select') return false;
  if ((s.props as Record<string, unknown> | undefined)?.multiple) return false;
  return s.emptyOption !== false;
}

/** 空值项文案：emptyOption 为字符串时用之，否则默认"请选择" */
function emptyOptionLabel(s: YFormSchema): string {
  return typeof s.emptyOption === 'string' ? s.emptyOption : '请选择';
}

defineExpose({
  validate: () => formRef.value?.validate(),
  validateField: (field: string | string[]) => formRef.value?.validateField(field),
  resetFields: () => formRef.value?.resetFields(),
  clearValidate: () => formRef.value?.clearValidate(),
});
</script>

<template>
  <ElForm
    ref="formRef"
    :model="modelValue"
    :label-width="labelWidth"
    :inline="inline"
    :rules="rules"
    @submit.prevent
  >
    <ElRow :gutter="inline ? 0 : 16">
      <ElCol v-for="s in schemas" :key="s.field" :span="inline ? undefined : (s.span ?? 24)">
        <ElFormItem :label="s.label" :prop="s.field" :rules="s.rules">
          <ElInput
            v-if="s.component === 'input'"
            :model-value="(modelValue[s.field] as string | undefined)"
            :placeholder="s.placeholder"
            clearable
            v-bind="s.props"
            @update:model-value="(v: string) => (modelValue[s.field] = v)"
          />
          <ElInput
            v-else-if="s.component === 'textarea'"
            type="textarea"
            :model-value="(modelValue[s.field] as string | undefined)"
            :placeholder="s.placeholder"
            v-bind="s.props"
            @update:model-value="(v: string) => (modelValue[s.field] = v)"
          />
          <ElInputNumber
            v-else-if="s.component === 'number'"
            :model-value="(modelValue[s.field] as number | undefined)"
            v-bind="s.props"
            @update:model-value="(v: number | undefined) => (modelValue[s.field] = v)"
          />
          <ElSelect
            v-else-if="s.component === 'select'"
            :model-value="(modelValue[s.field] as string | number | boolean | undefined)"
            :placeholder="s.placeholder"
            clearable
            style="width: 100%; min-width: 140px"
            v-bind="s.props"
            @update:model-value="(v: unknown) => (modelValue[s.field] = v)"
          >
            <ElOption v-if="showEmptyOption(s)" :label="emptyOptionLabel(s)" value="" />
            <ElOption
              v-for="o in s.options ?? []"
              :key="String(o.value)"
              :label="o.label"
              :value="o.value"
              :disabled="o.disabled"
            />
          </ElSelect>
          <ElRadioGroup
            v-else-if="s.component === 'radio'"
            :model-value="(modelValue[s.field] as string | number | boolean | undefined)"
            v-bind="s.props"
            @update:model-value="(v: unknown) => (modelValue[s.field] = v)"
          >
            <ElRadio v-for="o in s.options ?? []" :key="String(o.value)" :value="o.value" :disabled="o.disabled">
              {{ o.label }}
            </ElRadio>
          </ElRadioGroup>
          <ElCheckboxGroup
            v-else-if="s.component === 'checkbox'"
            :model-value="(modelValue[s.field] as (string | number)[] | undefined)"
            v-bind="s.props"
            @update:model-value="(v: unknown) => (modelValue[s.field] = v)"
          >
            <ElCheckbox v-for="o in s.options ?? []" :key="String(o.value)" :value="o.value" :disabled="o.disabled">
              {{ o.label }}
            </ElCheckbox>
          </ElCheckboxGroup>
          <ElSwitch
            v-else-if="s.component === 'switch'"
            :model-value="(modelValue[s.field] as boolean | undefined)"
            v-bind="s.props"
            @update:model-value="(v: unknown) => (modelValue[s.field] = v)"
          />
          <ElDatePicker
            v-else-if="s.component === 'date'"
            :model-value="(modelValue[s.field] as string | undefined)"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="s.placeholder"
            style="width: 100%"
            v-bind="s.props"
            @update:model-value="(v: unknown) => (modelValue[s.field] = v)"
          />
          <ElDatePicker
            v-else-if="s.component === 'daterange'"
            :model-value="(modelValue[s.field] as [string, string] | undefined)"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
            v-bind="s.props"
            @update:model-value="(v: unknown) => (modelValue[s.field] = v)"
          />
          <!-- 自定义控件：同名插槽出口（如 #icon / #receiverIds） -->
          <slot v-else-if="s.component === 'slot'" :name="s.field" :model="modelValue" />
        </ElFormItem>
      </ElCol>
      <!-- 业务侧追加表单项（如按钮组） -->
      <slot />
    </ElRow>
  </ElForm>
</template>
