<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { ElButton, ElDialog, ElMessage, ElUpload, ElTable, ElTableColumn, ElTag } from 'element-plus';
import { Download, Upload, List, Close } from '@element-plus/icons-vue';
import type { UploadFile, UploadRawFile } from 'element-plus';
import type { ImportError, ImportResult, ImportStreamFn, ImportStreamRow } from './types';

defineOptions({ name: 'YExcel' });

interface Props {
  /** 导出：传入请求参数，返回 Blob（axios responseType: 'blob' 解包后） */
  exportFn?: (params: Record<string, unknown>) => Promise<Blob>;
  /** 导出按钮文本 */
  exportText?: string;
  /** 导入：上传文件，返回导入结果 */
  importFn?: (file: File) => Promise<ImportResult>;
  /** 流式导入：SSE 逐行推送结果 */
  streamImportFn?: ImportStreamFn;
  /** 导入按钮文本 */
  importText?: string;
  /** 模板下载：返回 Blob */
  templateFn?: () => Promise<Blob>;
  /** 模板按钮文本 */
  templateText?: string;
  /** 导出时附加的查询条件（与列表页搜索条件一致） */
  exportParams?: Record<string, unknown>;
  /** 导出文件名（不含扩展名） */
  exportFilename?: string;
  /** 是否隐藏模板按钮 */
  hideTemplate?: boolean;
  /** 是否隐藏导入按钮 */
  hideImport?: boolean;
  /** 是否隐藏导出按钮 */
  hideExport?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  exportFn: undefined,
  importFn: undefined,
  streamImportFn: undefined,
  templateFn: undefined,
  exportParams: undefined,
  exportText: '导出',
  importText: '导入',
  templateText: '模板下载',
  exportFilename: '导出数据',
  hideTemplate: false,
  hideImport: false,
  hideExport: false,
});

interface Emits {
  (e: 'exportSuccess'): void;
  (e: 'exportError', error: Error): void;
  (e: 'importSuccess', result: ImportResult): void;
  (e: 'importError', error: Error): void;
}

const emit = defineEmits<Emits>();

const hasStreamImport = computed(() => !!props.streamImportFn);

// ==================== 导出 ====================
const exportLoading = ref(false);

async function handleExport(): Promise<void> {
  if (!props.exportFn) {
    ElMessage.warning('未配置导出方法');
    return;
  }
  exportLoading.value = true;
  try {
    const blob = await props.exportFn(props.exportParams ?? {});
    saveBlob(blob, `${props.exportFilename}.xlsx`);
    ElMessage.success('导出成功');
    emit('exportSuccess');
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    ElMessage.error('导出失败');
    emit('exportError', err);
  } finally {
    exportLoading.value = false;
  }
}

// ==================== 导入（普通模式） ====================
const importVisible = ref(false);
const importLoading = ref(false);
const importErrors = ref<ImportError[]>([]);
const importSuccessCount = ref(0);

function handleImportDialogOpen(): void {
  if (!props.importFn && !hasStreamImport.value) {
    ElMessage.warning('未配置导入方法');
    return;
  }
  importErrors.value = [];
  importSuccessCount.value = 0;
  importVisible.value = true;
  // 重置流式状态
  resetStreamState();
}

async function handleFileUpload(file: UploadFile): Promise<void> {
  const raw = file.raw as UploadRawFile;

  if (hasStreamImport.value) {
    startStreamImport(raw);
    return;
  }

  // 普通批量导入
  importLoading.value = true;
  try {
    const result = await props.importFn!(raw);
    importSuccessCount.value = result.successRows.length;
    importErrors.value = result.errors;
    if (result.errors.length === 0) {
      ElMessage.success(`导入成功：${result.successRows.length} 条`);
    } else {
      ElMessage.warning(
        `导入完成：成功 ${result.successRows.length} 条，失败 ${result.errors.length} 条`,
      );
    }
    emit('importSuccess', result);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    ElMessage.error('导入失败：' + err.message);
    emit('importError', err);
  } finally {
    importLoading.value = false;
  }
}

// ==================== 流式导入 ====================
const streamActive = ref(false);
const streamDone = ref(false);
const streamTotal = ref(0);
const streamSuccess = ref(0);
const streamError = ref(0);
const streamRows = ref<ImportStreamRow[]>([]);
const streamErrorMessage = ref('');
const resultsContainer = ref<HTMLDivElement>();
const streamAbortController = ref<AbortController>();

function resetStreamState(): void {
  streamActive.value = false;
  streamDone.value = false;
  streamTotal.value = 0;
  streamSuccess.value = 0;
  streamError.value = 0;
  streamRows.value = [];
  streamErrorMessage.value = '';
  streamAbortController.value = undefined;
}

function startStreamImport(file: File): void {
  resetStreamState();
  streamActive.value = true;

  const controller = new AbortController();
  streamAbortController.value = controller;

  props.streamImportFn!(file, {
    onRow(row: ImportStreamRow) {
      // 仅在列表中展示失败的行，避免大量成功行刷屏
      if (row.status !== 'success') {
        streamRows.value = [...streamRows.value, row];
        streamError.value++;
      } else {
        streamSuccess.value++;
      }
      streamTotal.value = streamSuccess.value + streamError.value;
      // 自动滚动到底部
      nextTick(() => {
        if (resultsContainer.value) {
          resultsContainer.value.scrollTop = resultsContainer.value.scrollHeight;
        }
      });
    },
    onDone(result: ImportStreamDone) {
      streamDone.value = true;
      streamActive.value = false;
      streamTotal.value = result.totalRows;
      if (result.errorCount === 0) {
        ElMessage.success(`导入成功：${result.successCount} 条`);
      } else {
        ElMessage.warning(
          `导入完成：成功 ${result.successCount} 条，失败 ${result.errorCount} 条`,
        );
      }
    },
    onError(message: string) {
      streamErrorMessage.value = message;
      streamActive.value = false;
      streamDone.value = false;
      ElMessage.error('导入失败：' + message);
    },
  }, controller.signal);
}

function cancelStreamImport(): void {
  streamAbortController.value?.abort();
  streamActive.value = false;
  streamDone.value = true;
  ElMessage.warning('已取消导入');
}

function handleDialogClose(): void {
  if (streamActive.value) {
    // 正在流式导入时不允许关闭
    return;
  }
  importVisible.value = false;
  resetStreamState();
}

// ==================== 模板下载 ====================
const templateLoading = ref(false);

async function handleTemplate(): Promise<void> {
  if (!props.templateFn) {
    ElMessage.warning('未配置模板下载方法');
    return;
  }
  templateLoading.value = true;
  try {
    const blob = await props.templateFn();
    saveBlob(blob, '导入模板.xlsx');
    ElMessage.success('模板下载成功');
  } catch {
    ElMessage.error('模板下载失败');
  } finally {
    templateLoading.value = false;
  }
}

// ==================== 工具 ====================
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="y-excel">
    <!-- 导出按钮 -->
    <ElButton v-if="!hideExport" :loading="exportLoading" :icon="Download" @click="handleExport">
      {{ exportText }}
    </ElButton>

    <!-- 导入按钮 -->
    <ElButton v-if="!hideImport" :icon="Upload" @click="handleImportDialogOpen">
      {{ importText }}
    </ElButton>

    <!-- 模板下载按钮 -->
    <ElButton v-if="!hideTemplate" :loading="templateLoading" :icon="List" @click="handleTemplate">
      {{ templateText }}
    </ElButton>

    <!-- 导入弹窗 -->
    <ElDialog
      v-model="importVisible"
      title="导入数据"
      width="580px"
      :close-on-click-modal="!streamActive"
      :close-on-press-escape="!streamActive"
      :show-close="!streamActive"
      @close="handleDialogClose"
    >
      <!-- 上传区域：未开始导入时显示 -->
      <div v-if="!streamActive && !streamDone" class="y-excel__upload-area">
        <ElUpload
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleFileUpload"
          drag
        >
          <div class="y-excel__upload-tip">
            将 .xlsx 文件拖拽到此处，或<em>点击选择文件</em>
          </div>
        </ElUpload>
      </div>

      <!-- 普通导入：错误回执表 -->
      <div v-if="!hasStreamImport && importErrors.length > 0 && !importLoading" class="y-excel__batch-results">
        <h4>导入回执（{{ importErrors.length }} 条错误）</h4>
        <ElTable :data="importErrors" size="small" class="y-excel__error-table">
          <ElTableColumn prop="rowNum" label="行号" width="80" />
          <ElTableColumn prop="message" label="错误信息" />
        </ElTable>
      </div>

      <!-- 流式导入：实时结果区域 -->
      <div v-if="hasStreamImport && (streamActive || streamDone || streamErrorMessage)" class="y-excel__stream-area">
        <!-- 统计栏 -->
        <div class="y-excel__stream-stats">
          <span class="y-excel__stream-stat">
            已处理 <strong>{{ streamTotal }}</strong> 条
          </span>
          <span class="y-excel__stream-stat y-excel__stream-stat--success">
            成功 <strong>{{ streamSuccess }}</strong> 条
          </span>
          <span class="y-excel__stream-stat y-excel__stream-stat--error">
            失败 <strong>{{ streamError }}</strong> 条
          </span>
        </div>

        <!-- 进度条 -->
        <div v-if="streamActive" class="y-excel__stream-progress">
          <div class="y-excel__stream-progress-bar" />
        </div>

        <!-- 实时结果表格（最多显示 10 行高度） -->
        <div
          v-if="streamRows.length > 0"
          ref="resultsContainer"
          class="y-excel__stream-results"
        >
          <ElTable :data="streamRows" size="small" class="y-excel__stream-table">
            <ElTableColumn prop="rowNum" label="行号" width="72" align="center" />
            <ElTableColumn prop="username" label="用户名" width="120" />
            <ElTableColumn label="状态" width="74" align="center">
              <template #default="{ row }">
                <ElTag :type="row.status === 'success' ? 'success' : 'danger'" size="small" effect="plain">
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="message" label="消息" min-width="180" show-overflow-tooltip />
          </ElTable>
        </div>

        <!-- 取消按钮（仅在导入中显示） -->
        <div v-if="streamActive" class="y-excel__stream-actions">
          <ElButton type="warning" :icon="Close" size="small" @click="cancelStreamImport">
            取消导入
          </ElButton>
        </div>

        <!-- 错误提示 -->
        <div v-if="streamErrorMessage" class="y-excel__stream-error-msg">
          错误：{{ streamErrorMessage }}
        </div>

        <!-- 完成提示 -->
        <div v-if="streamDone && !streamErrorMessage" class="y-excel__stream-done-msg">
          导入结束，共 {{ streamTotal }} 条（成功 {{ streamSuccess }}，失败 {{ streamError }}）
        </div>
      </div>

      <!-- 普通导入加载中 -->
      <div v-if="importLoading && !hasStreamImport" class="y-excel__loading">
        正在导入中...
      </div>
    </ElDialog>
  </div>
</template>

<style scoped>
.y-excel {
  display: inline-flex;
  gap: 8px;
}

.y-excel__upload-tip {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
  padding: 16px 0;
}

.y-excel__upload-tip em {
  color: var(--el-color-primary);
  font-style: normal;
}

.y-excel__loading {
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 24px 0;
  font-size: 14px;
}

/* === 流式导入样式 === */
.y-excel__stream-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.y-excel__stream-stats {
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 13px;
}

.y-excel__stream-stat strong {
  font-size: 15px;
  margin: 0 2px;
}

.y-excel__stream-stat--success strong {
  color: var(--el-color-success);
}

.y-excel__stream-stat--error strong {
  color: var(--el-color-danger);
}

.y-excel__stream-progress {
  height: 3px;
  background: var(--el-fill-color);
  border-radius: 2px;
  overflow: hidden;
}

.y-excel__stream-progress-bar {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-success));
  animation: y-excel-progress-move 1.5s ease-in-out infinite;
}

@keyframes y-excel-progress-move {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 结果表格容器：最多显示 ~10 行 + 表头 ≈ 380px */
.y-excel__stream-results {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}

.y-excel__stream-table :deep(.el-table__body-wrapper) {
  /* 表格内部不重复滚动 */
}

.y-excel__stream-actions {
  text-align: center;
}

.y-excel__stream-error-msg {
  color: var(--el-color-danger);
  font-size: 13px;
  padding: 8px 12px;
  background: var(--el-color-danger-light-9);
  border-radius: 4px;
}

.y-excel__stream-done-msg {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-align: center;
  padding: 8px 0;
}

/* === 普通导入回执样式 === */
.y-excel__batch-results {
  margin-top: 12px;
}

.y-excel__batch-results h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
}

.y-excel__error-table {
  margin-top: 8px;
}

.y-excel__upload-area {
  /* 上传区域 */
}
</style>
