<script setup lang="ts">
defineOptions({ name: 'DemoSchemaForm' });
import { computed, reactive, ref } from 'vue';
import { ElAlert, ElButton, ElCol, ElMessage, ElRow, ElTag } from 'element-plus';
import { YSchemaForm } from '@pivotos/ui';
import type { JsonSchemaObject, SchemaUploadResult } from '@pivotos/ui';

/**
 * 动态表单演示（FE-2）。
 *
 * 演示要点：
 * - 表单长什么样完全由左边的 JSON Schema 决定（可现场改 Schema 立即重渲染）；
 * - 校验规则也由 schema 描述（required / minLength / maxLength / pattern / minimum / maximum / minItems），
 *   页面里不写一条硬编码规则；
 * - 联动用 visibleWhen 函数（**不用字符串表达式、不用 eval**）：客户类型选「企业」才会出现
 *   「公司名称 / 税号」两列，隐藏的字段同时不参与校验。
 */

const DEFAULT_SCHEMA = `{
  "title": "客户建档",
  "fields": [
    { "key": "name", "title": "客户名称", "type": "string", "required": true, "minLength": 2, "maxLength": 20, "span": 12 },
    { "key": "type", "title": "客户类型", "type": "string", "required": true, "span": 12,
      "options": [{ "label": "个人", "value": "personal" }, { "label": "企业", "value": "enterprise" }] },
    { "key": "companyName", "title": "公司名称", "type": "string", "required": true, "span": 12,
      "visibleWhen": "type === 'enterprise'" },
    { "key": "taxNo", "title": "统一社会信用代码", "type": "string", "span": 12,
      "pattern": "^[0-9A-Z]{18}$", "patternMessage": "统一社会信用代码为 18 位数字或大写字母",
      "visibleWhen": "type === 'enterprise'" },
    { "key": "email", "title": "邮箱", "type": "string", "format": "email", "required": true, "span": 12 },
    { "key": "site", "title": "官网", "type": "string", "format": "url", "span": 12 },
    { "key": "level", "title": "星级", "type": "integer", "minimum": 1, "maximum": 5, "default": 3, "span": 12 },
    { "key": "amount", "title": "预计年采购额", "type": "number", "minimum": 0, "span": 12 },
    { "key": "tagWanted", "title": "意向标签", "type": "array", "minItems": 1, "maxItems": 3, "span": 12,
      "options": [
        { "label": "框架合作", "value": "framework" },
        { "label": "定制开发", "value": "custom" },
        { "label": "运维托管", "value": "ops" },
        { "label": "咨询培训", "value": "consult" }
      ] },
    { "key": "source", "title": "来源渠道", "type": "string", "span": 12, "widget": "radio",
      "options": [{ "label": "官网留资", "value": "site" }, { "label": "展会", "value": "expo" }, { "label": "转介绍", "value": "referral" }] },
    { "key": "enabled", "title": "是否启用客户池", "type": "boolean", "default": true, "span": 12 },
    { "key": "contractDate", "title": "合同签署日", "type": "string", "format": "date", "span": 12 },
    { "key": "remark", "title": "备注", "type": "string", "format": "textarea", "maxLength": 200, "span": 24 },
    { "key": "attachment", "title": "附件", "type": "string", "format": "upload", "span": 24 }
  ]
}`;

/**
 * visibleWhen 在 schema（JSON）里只能写成字符串，这里**编译成函数**而不是 eval：
 * 只支持最简单的 `key === 'literal'` 形态，其他一律按「恒显示」处理（宁可多显示，不能静默报错）。
 */
function compileVisibleWhen(expr: string): ((model: Record<string, unknown>) => boolean) | undefined {
  const matched = /^\s*(\w+)\s*===\s*['"]([^'"]*)['"]\s*$/.exec(expr);
  if (!matched) return undefined;
  const [, key, expected] = matched;
  return (model: Record<string, unknown>) => String(model[key]) === expected;
}

interface RawSchema {
  title?: string;
  fields?: Record<string, unknown>[];
}

/** 把 JSON 里的 visibleWhen 字符串还原成函数（schema 是可序列化的 JSON，函数不是） */
function hydrateSchema(raw: RawSchema): JsonSchemaObject {
  return {
    title: raw.title,
    fields: (raw.fields ?? []).map((field) => {
      const expr = field['visibleWhen'];
      return {
        ...field,
        visibleWhen: typeof expr === 'string' ? compileVisibleWhen(expr) : undefined,
      } as JsonSchemaObject['fields'][number];
    }),
  };
}

const schemaText = ref(DEFAULT_SCHEMA);
const parseError = ref('');

const schema = computed<JsonSchemaObject>(() => {
  try {
    const raw = JSON.parse(schemaText.value) as RawSchema;
    parseError.value = '';
    return hydrateSchema(raw);
  } catch (e) {
    parseError.value = e instanceof Error ? e.message : String(e);
    return { fields: [] };
  }
});

/** schema 变化后重建模型：联动字段的旧值应该清掉，否则隐藏字段仍会被提交 */
const model = reactive<Record<string, unknown>>({});
function rebuildModel(): void {
  Object.keys(model).forEach((k) => delete model[k]);
}
const formRef = ref<InstanceType<typeof YSchemaForm>>();

const modelJson = computed(() => JSON.stringify(model, null, 2));

/** 演示用上传器：真实项目请注入 /file/upload 之类的 Endpoint（见 FileUpload 组件） */
async function mockUpload(file: File): Promise<SchemaUploadResult> {
  return { url: `demo://local/${encodeURIComponent(file.name)}`, name: file.name };
}

async function handleValidate(): Promise<void> {
  try {
    await formRef.value?.validate();
    ElMessage.success('校验通过，右侧为最终提交模型');
  } catch {
    ElMessage.warning('存在未通过的校验项，请在表单内查看提示');
  }
}

function handleReset(): void {
  formRef.value?.resetFields();
  rebuildModel();
  formRef.value?.clearValidate();
}

function handleApply(): void {
  rebuildModel();
  formRef.value?.clearValidate();
  ElMessage.success('Schema 已应用');
}
</script>

<template>
  <div class="demo-schema">
    <ElAlert
      type="info"
      show-icon
      :closable="false"
      title="FE-2 动态表单：表单结构与校验规则都由 JSON Schema 描述"
      description="左侧编辑 Schema 后点「应用 Schema」立即重渲染。验证点：① 必填 / 长度 / 正则 / 数值区间均由 Schema 推导，页面不写死规则；② 联动字段（客户类型选「企业」才出现的公司名称、税号）隐藏后不参与校验；③ 上传控件执行器由业务侧注入（本页用本地演示执行器，不出网）。"
      class="demo-schema__alert"
    />

    <ElRow :gutter="12">
      <ElCol :span="10">
        <div class="page-card">
          <div class="demo-schema__title">Schema（JSON）</div>
          <textarea v-model="schemaText" class="demo-schema__editor" spellcheck="false" />
          <div class="demo-schema__bar">
            <ElButton type="primary" @click="handleApply">应用 Schema</ElButton>
            <ElButton @click="handleValidate">校验</ElButton>
            <ElButton @click="handleReset">重置</ElButton>
          </div>
          <div v-if="parseError" class="demo-schema__error">JSON 解析失败：{{ parseError }}</div>
        </div>
      </ElCol>

      <ElCol :span="14">
        <div class="page-card">
          <div class="demo-schema__title">
            渲染结果 <ElTag size="small" effect="plain">{{ schema.fields.length }} 个字段</ElTag>
          </div>
          <YSchemaForm
            ref="formRef"
            :model-value="model"
            :schema="schema"
            :upload-fn="mockUpload"
            label-width="140px"
          />
          <div class="demo-schema__title">表单模型（实时）</div>
          <pre class="demo-schema__model">{{ modelJson }}</pre>
        </div>
      </ElCol>
    </ElRow>
  </div>
</template>

<style scoped>
.demo-schema__alert {
  margin-bottom: 12px;
}

.demo-schema__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 500;
}

.demo-schema__editor {
  width: 100%;
  height: 620px;
  padding: 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  font-family: var(--el-font-family-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
}

.demo-schema__bar {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.demo-schema__error {
  margin-top: 8px;
  color: var(--el-color-danger);
  font-size: 12px;
}

.demo-schema__model {
  max-height: 220px;
  margin: 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 12px;
  line-height: 1.6;
}
</style>
