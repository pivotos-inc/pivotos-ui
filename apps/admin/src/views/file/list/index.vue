<script setup lang="ts">
defineOptions({ name: 'FileList' });
import { ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn, ElTag, ElUpload } from 'element-plus';
import type { UploadRequestOptions } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import type { FilePageQuery, SysFileVO } from '@pivotos/types';
import { deleteFile, presignDownload, uploadFile } from '@/api/file';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<SysFileVO, FilePageQuery>({
  url: '/file/page',
  query: { originalName: '', storageType: '' },
});

const STORAGE_TYPE_OPTIONS: YFormOption[] = [
  { label: 'MinIO', value: 'minio' },
  { label: '阿里云 OSS', value: 'oss' },
  { label: '腾讯云 COS', value: 'cos' },
  { label: '华为云 OBS', value: 'obs' },
  { label: 'S3 兼容', value: 's3' },
];

const searchSchemas: YFormSchema[] = [
  { field: 'originalName', label: '文件名', component: 'input', placeholder: '按原始文件名模糊查询' },
  { field: 'storageType', label: '存储类型', component: 'select', placeholder: '全部', options: STORAGE_TYPE_OPTIONS },
];

const columns: YTableColumn<SysFileVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'originalName', label: '文件名', minWidth: 180, showOverflowTooltip: true },
  { prop: 'objectKey', label: '对象键', minWidth: 260, showOverflowTooltip: true },
  { prop: 'fileSize', label: '大小', width: 100, align: 'center', slot: 'fileSize' },
  { prop: 'contentType', label: 'MIME 类型', width: 130, showOverflowTooltip: true },
  { prop: 'storageType', label: '存储', width: 90, align: 'center', slot: 'storageType' },
  { prop: 'bucket', label: '桶', width: 100 },
  { prop: 'createTime', label: '上传时间', width: 170 },
];

/** 字节数格式化（列表展示用） */
function formatSize(size?: number): string {
  if (size == null) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

// ---------- 上传（presign → PUT 直传 → register，成功后刷新列表） ----------
const uploading = ref(false);

async function handleUpload(options: UploadRequestOptions): Promise<void> {
  uploading.value = true;
  try {
    await uploadFile(options.file);
    ElMessage.success('上传成功');
    await load();
  } catch (err) {
    ElMessage.error(`上传失败：${err instanceof Error ? err.message : '未知错误'}`);
  } finally {
    uploading.value = false;
  }
}

// ---------- 下载（私有桶：换签限时 URL 后新窗口打开） ----------
async function handleDownload(row: SysFileVO): Promise<void> {
  const url = await presignDownload(row.objectKey);
  window.open(url, '_blank');
}

// ---------- 删除（对象 + 元数据同删） ----------
async function handleDelete(row: SysFileVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除文件「${row.originalName}」吗？存储对象将一并删除。`, '提示', {
    type: 'warning',
  });
  await deleteFile(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="file-page__bar">
      <ElUpload :show-file-list="false" :http-request="handleUpload" accept="image/*">
        <ElButton v-hasPermi="'file:file:upload'" type="primary" :icon="Upload" :loading="uploading">
          上传文件
        </ElButton>
      </ElUpload>
    </div>

    <YSearchForm v-model="params" :schemas="searchSchemas" @search="search" @reset="reset" />

    <YTable
      v-model:page-num="params.pageNum"
      v-model:page-size="params.pageSize"
      :loading="loading"
      :data="rows"
      :columns="columns"
      :total="total"
      row-key="id"
      @refresh="load"
    >
      <template #fileSize="{ row }">
        {{ formatSize((row as SysFileVO).fileSize) }}
      </template>
      <template #storageType="{ row }">
        <ElTag size="small" :type="(row as SysFileVO).storageType === 'minio' ? 'info' : 'success'">
          {{ (row as SysFileVO).storageType ?? '-' }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="140" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="handleDownload(row as SysFileVO)">下载</ElButton>
          <ElButton
            v-hasPermi="'file:file:remove'"
            link
            type="danger"
            @click="handleDelete(row as SysFileVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>
  </div>
</template>

<style scoped>
.file-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
