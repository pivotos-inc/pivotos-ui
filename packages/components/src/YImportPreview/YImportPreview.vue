<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElButton, ElCheckbox, ElMessage, ElProgress, ElTag, ElUpload } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { Document, Upload } from '@element-plus/icons-vue';
import { YTable } from '@pivotos/ui';
import { buildPreviewRows, downloadTemplate, mapHeaders, readSheet, summarize } from './preview';
import type { ImportPreviewColumn, ImportPreviewRow, ImportPreviewSummary } from './types';

/**
 * YImportPreview —— 导入前预览（FE-3）。
 *
 * 三段式：本地解析 → 表格预览（错误行标红 + 重复行去重标红）→ 用户确认后才落库。
 * 落库动作由业务侧注入 commitFn（不注入则只 emit confirm），本组件不持有任何 request 实例。
 */

interface Props {
  /** 列定义（决定表头匹配、校验与预览列） */
  columns: ImportPreviewColumn[];
  /** 参与去重的字段（组合键；缺省不去重） */
  uniqueKeys?: string[];
  /** 确认导入执行器：接收「校验通过的行数据」，返回值透传给 committed 事件 */
  commitFn?: (rows: Record<string, unknown>[]) => Promise<unknown>;
  /** 单次预览的最大解析行数（防御超大文件把浏览器拖死） */
  maxRows?: number;
  /** 是否开启虚拟滚动（大文件预览建议开启） */
  virtual?: boolean;
  virtualHeight?: number | string;
  /** 模板文件名（不含扩展名） */
  templateFilename?: string;
  /** 确认按钮文案 */
  confirmText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  uniqueKeys: undefined,
  commitFn: undefined,
  maxRows: 5000,
  virtual: true,
  virtualHeight: 420,
  templateFilename: '导入模板',
  confirmText: '确认导入',
});

const emit = defineEmits<{
  /** 解析完成（无论是否有错行） */
  parsed: [rows: ImportPreviewRow[], summary: ImportPreviewSummary];
  /** 用户确认（未注入 commitFn 时业务侧监听此事件） */
  confirm: [rows: Record<string, unknown>[]];
  /** commitFn 执行完成 */
  committed: [result: unknown];
  /** 失败（解析失败 / 提交失败） */
  error: [message: string];
}>();

interface PreviewRowView {
  __rowNum: number;
  __sheetRowNum: number;
  __valid: boolean;
  __errors: string[];
  [key: string]: unknown;
}

const rows = ref<ImportPreviewRow[]>([]);
const parsing = ref(false);
const committing = ref(false);
const fileName = ref('');
const onlyError = ref(false);
const fatal = ref('');
const truncated = ref(false);

const summary = computed<ImportPreviewSummary>(() => summarize(rows.value));

/** YTable 的 prop 不支持点路径（虚拟模式是我自己取值），故把元数据摊平成 __ 前缀字段 */
const viewRows = computed<PreviewRowView[]>(() => {
  const source = onlyError.value ? rows.value.filter((r) => !r.valid) : rows.value;
  return source.map((row) => ({
    __rowNum: row.rowNum,
    __sheetRowNum: row.sheetRowNum,
    __valid: row.valid,
    __errors: row.errors.map((e) => e.message),
    ...row.data,
  }));
});

const previewColumns = computed(() => [
  { prop: '__rowNum', label: '行号', width: 72, align: 'center' as const },
  ...props.columns.map((col) => ({
    prop: col.key,
    label: col.label,
    width: col.width ?? 140,
    align: 'left' as const,
  })),
  { prop: '__errors', label: '校验结果', width: 260, align: 'left' as const, slot: 'yipErrors' },
]);

function rowClassGetter(row: Record<string, unknown>): string {
  return row['__valid'] === false ? 'yip-error-row' : '';
}

async function handleFile(file: UploadFile): Promise<void> {
  const raw = file.raw;
  if (!raw) return;
  reset(false);
  parsing.value = true;
  fileName.value = file.name ?? '';
  try {
    const buffer = await raw.arrayBuffer();
    const table = readSheet(buffer);
    if (table.length < 2) {
      fatal.value = '文件为空或只有表头，请先下载模板填写数据';
      return;
    }
    const headers = table[0];
    const bodyRows = table.slice(1);
    truncated.value = bodyRows.length > props.maxRows;
    const limited = truncated.value ? bodyRows.slice(0, props.maxRows) : bodyRows;

    const mapping = mapHeaders(headers, props.columns);
    if (mapping.missingColumns.length > 0) {
      fatal.value = `文件缺少必填列：${mapping.missingColumns.join('、')}（请对照模板补齐后重新上传）`;
      return;
    }

    rows.value = buildPreviewRows(limited, props.columns, mapping.indexMap, props.uniqueKeys);
    emit('parsed', rows.value, summary.value);
    if (summary.value.error > 0) {
      ElMessage.warning(`解析完成：${summary.value.total} 行，其中 ${summary.value.error} 行有错误`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    fatal.value = `解析失败：${message}`;
    emit('error', message);
  } finally {
    parsing.value = false;
  }
}

function reset(clearFile = true): void {
  rows.value = [];
  fatal.value = '';
  truncated.value = false;
  if (clearFile) fileName.value = '';
}

function handleTemplate(): void {
  downloadTemplate(props.columns, props.templateFilename);
}

async function handleConfirm(): Promise<void> {
  const validRows = rows.value.filter((r) => r.valid).map((r) => r.data);
  if (validRows.length === 0) return;
  committing.value = true;
  try {
    if (props.commitFn) {
      const result = await props.commitFn(validRows);
      emit('committed', result);
      ElMessage.success(`导入成功：${validRows.length} 条`);
    } else {
      emit('confirm', validRows);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    ElMessage.error(`导入失败：${message}`);
    emit('error', message);
  } finally {
    committing.value = false;
  }
}

defineExpose({
  /** 清空预览（业务侧可在「新增」弹窗关闭时调用） */
  reset,
  handleTemplate,
  rows: () => rows.value,
  summary: () => summary.value,
});
</script>

<template>
  <div class="y-import-preview">
    <!-- 操作区：上传 / 模板 / 统计 / 确认 -->
    <div class="y-import-preview__bar">
      <ElUpload
        :auto-upload="false"
        :show-file-list="false"
        accept=".xlsx,.xls"
        :on-change="handleFile"
      >
        <ElButton :icon="Upload" :loading="parsing">选择 Excel</ElButton>
      </ElUpload>
      <ElButton :icon="Document" @click="handleTemplate">下载模板</ElButton>
      <ElCheckbox v-model="onlyError" :disabled="summary.error === 0">只看错误行</ElCheckbox>
      <span class="y-import-preview__stat">
        共 <strong>{{ summary.total }}</strong> 行
      </span>
      <span class="y-import-preview__stat y-import-preview__stat--ok">
        通过 <strong>{{ summary.valid }}</strong>
      </span>
      <span class="y-import-preview__stat y-import-preview__stat--error">
        错误 <strong>{{ summary.error }}</strong>
      </span>
      <span class="y-import-preview__stat">
        重复 <strong>{{ summary.duplicate }}</strong>
      </span>
      <ElButton
        type="primary"
        :loading="committing"
        :disabled="summary.valid === 0 || rows.length === 0"
        @click="handleConfirm"
      >
        {{ confirmText }}（{{ summary.valid }}）
      </ElButton>
    </div>

    <div v-if="fileName" class="y-import-preview__file">文件：{{ fileName }}</div>

    <ElTag v-if="truncated" type="warning" effect="plain" class="y-import-preview__tag">
      文件行数超过 {{ maxRows }} 行，仅预览前 {{ maxRows }} 行；如需全量请拆分文件后重新导入
    </ElTag>

    <div v-if="parsing" class="y-import-preview__hint">
      <ElProgress :percentage="100" :indeterminate="true" :duration="1" :show-text="false" />
      <span>正在解析...</span>
    </div>

    <div v-else-if="fatal" class="y-import-preview__fatal">{{ fatal }}</div>

    <YTable
      v-else-if="rows.length > 0"
      class="y-import-preview__table"
      :data="viewRows"
      :columns="previewColumns"
      :virtual="virtual"
      :virtual-height="virtualHeight"
      :row-class-name="rowClassGetter"
      hide-pagination
      row-key="__rowNum"
    >
      <template #yipErrors="{ row }">
        <span v-if="!(row as PreviewRowView).__errors.length" class="y-import-preview__ok">通过</span>
        <span v-else class="y-import-preview__bad">
          {{ ((row as PreviewRowView).__errors as string[]).join('；') }}
        </span>
      </template>
    </YTable>

    <div v-else class="y-import-preview__empty">
      请先选择 Excel 文件（或下载模板填写后上传），解析结果会在此处预览，确认无误后再落库
    </div>
  </div>
</template>

<style scoped>
.y-import-preview {
  width: 100%;
}

.y-import-preview__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.y-import-preview__stat {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.y-import-preview__stat strong {
  margin: 0 2px;
  font-size: 15px;
}

.y-import-preview__stat--ok strong {
  color: var(--el-color-success);
}

.y-import-preview__stat--error strong {
  color: var(--el-color-danger);
}

.y-import-preview__file,
.y-import-preview__tag,
.y-import-preview__hint,
.y-import-preview__fatal {
  margin-top: 10px;
}

.y-import-preview__fatal {
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  font-size: 13px;
}

.y-import-preview__empty {
  margin-top: 12px;
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

/* 错误行标红：ElTable 的行由子组件渲染，普通 scoped 选择器够不着，必须 :deep */
.y-import-preview__table :deep(.yip-error-row) {
  background-color: var(--el-color-danger-light-9) !important;
}

.y-import-preview__ok {
  color: var(--el-color-success);
}

.y-import-preview__bad {
  color: var(--el-color-danger);
}
</style>
