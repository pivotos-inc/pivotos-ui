<script setup lang="ts">
import { ref } from 'vue';
import { ElButton, ElDialog, ElMessage, ElUpload, ElTable, ElTableColumn } from 'element-plus';
import { Download, Upload, List } from '@element-plus/icons-vue';
import type { UploadFile, UploadRawFile } from 'element-plus';
import type { ImportError, ImportResult } from './types';

defineOptions({ name: 'YExcel' });

interface Props {
  /** 导出：传入请求参数，返回 Blob（axios responseType: 'blob' 解包后） */
  exportFn?: (params: Record<string, unknown>) => Promise<Blob>;
  /** 导出按钮文本 */
  exportText?: string;
  /** 导入：上传文件，返回导入结果 */
  importFn?: (file: File) => Promise<ImportResult>;
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

// ==================== 导入 ====================
const importVisible = ref(false);
const importLoading = ref(false);
const importErrors = ref<ImportError[]>([]);
const importSuccessCount = ref(0);

function handleImportDialogOpen(): void {
  if (!props.importFn) {
    ElMessage.warning('未配置导入方法');
    return;
  }
  importErrors.value = [];
  importSuccessCount.value = 0;
  importVisible.value = true;
}

async function handleFileUpload(file: UploadFile): Promise<void> {
  importLoading.value = true;
  try {
    const raw = file.raw as UploadRawFile;
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

    <!-- 导入弹窗（含错误回执） -->
    <ElDialog
      v-model="importVisible"
      title="导入数据"
      width="520px"
      :close-on-click-modal="false"
    >
      <ElUpload
        :auto-upload="false"
        :show-file-list="false"
        accept=".xlsx,.xls"
        :on-change="handleFileUpload"
        drag
      >
        <div class="y-excel__upload-tip">将 .xlsx 文件拖拽到此处，或<em>点击选择文件</em></div>
      </ElUpload>
      <ElTable v-if="importErrors.length > 0" :data="importErrors" size="small" class="y-excel__error-table">
        <ElTableColumn prop="rowNum" label="行号" width="80" />
        <ElTableColumn prop="message" label="错误信息" />
      </ElTable>
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

.y-excel__error-table {
  margin-top: 16px;
}
</style>
