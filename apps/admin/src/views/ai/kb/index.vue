<script setup lang="ts">
defineOptions({ name: 'AiKb' });
import { computed, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag, FileUpload } from '@pivotos/components';
import type { KbChunkVO, KbDocPageQuery, KbDocUploadBody, KbDocumentVO, KbSearchBody, KbSearchResult, KnowledgeBaseSaveBody, KnowledgeBaseVO } from '@pivotos/types';
import { useDict, useTablePage } from '@/hooks';
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  deleteKbDoc,
  getKnowledgeBase,
  listDocChunks,
  pageKbDocs,
  reindexKbDoc,
  searchKb,
  updateKnowledgeBase,
  uploadKbDoc,
} from '@/api/ai/kb';
import { uploadFile } from '@/api/file';

const { sys_common_status } = useDict('sys_common_status');

/* ================= 知识库列表 ================= */

const VECTOR_STORE_OPTIONS: YFormOption[] = [
  { label: 'Simple（内存 + JSON）', value: 'simple' },
  { label: 'Milvus', value: 'milvus' },
  { label: 'pgvector（预留）', value: 'pgvector' },
  { label: 'Qdrant（预留）', value: 'qdrant' },
];

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

const { loading, rows, total, params, load } = useTablePage<KnowledgeBaseVO>({
  url: '/ai/kb/base/page',
  query: {},
});

const columns: YTableColumn<KnowledgeBaseVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'name', label: '知识库名称', minWidth: 160 },
  { prop: 'description', label: '描述', minWidth: 180, showOverflowTooltip: true },
  {
    prop: 'vectorStoreType',
    label: '向量存储',
    width: 150,
    formatter: (row) => VECTOR_STORE_OPTIONS.find((o) => o.value === row.vectorStoreType)?.label ?? row.vectorStoreType,
  },
  { prop: 'embeddingModel', label: 'Embedding 模型', width: 160, formatter: (row) => row.embeddingModel || '-' },
  { prop: 'chunkSize', label: '分块大小', width: 100, align: 'center' },
  { prop: 'chunkOverlap', label: '重叠', width: 80, align: 'center' },
  { prop: 'hybridSearch', label: '混合检索', width: 100, align: 'center', formatter: (row) => row.hybridSearch === false ? '关' : '开' },
  { prop: 'rerank', label: '重排', width: 80, align: 'center', formatter: (row) => row.rerank === false ? '关' : '开' },
  { prop: 'docCount', label: '文档数', width: 90, align: 'center' },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'status' },
  { prop: 'createTime', label: '创建时间', width: 170 },
];

/* ================= 新增 / 编辑知识库 ================= */

const kbDialogVisible = ref(false);
const kbConfirmLoading = ref(false);
const kbFormRef = ref<InstanceType<typeof YForm>>();
const kbForm = reactive<Record<string, unknown>>({});
const isKbEdit = computed(() => !!kbForm.id);

const kbFormSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'name',
    label: '知识库名称',
    component: 'input',
    placeholder: '请输入知识库名称',
    rules: [{ required: true, message: '知识库名称不能为空', trigger: 'blur' }],
  },
  { field: 'description', label: '描述', component: 'textarea', placeholder: '请输入描述' },
  {
    field: 'vectorStoreType',
    label: '向量存储',
    component: 'select',
    placeholder: '请选择向量存储类型',
    options: VECTOR_STORE_OPTIONS,
    emptyOption: false,
    rules: [{ required: true, message: '向量存储类型不能为空', trigger: 'change' }],
    props: { disabled: isKbEdit.value },
  },
  { field: 'embeddingModel', label: 'Embedding 模型', component: 'input', placeholder: '为空则使用系统默认模型' },
  {
    field: 'chunkSize',
    label: '分块大小',
    component: 'number',
    placeholder: '请输入分块大小',
    rules: [{ required: true, message: '分块大小不能为空', trigger: 'blur' }],
    props: { min: 1, step: 1 },
  },
  {
    field: 'chunkOverlap',
    label: '分块重叠',
    component: 'number',
    placeholder: '请输入分块重叠',
    rules: [{ required: true, message: '分块重叠不能为空', trigger: 'blur' }],
    props: { min: 0, step: 1 },
  },
  {
    field: 'hybridSearch',
    label: '混合检索',
    component: 'radio',
    options: [
      { label: '开启', value: true },
      { label: '关闭', value: false },
    ],
  },
  {
    field: 'rerank',
    label: '重排',
    component: 'radio',
    options: [
      { label: '开启', value: true },
      { label: '关闭', value: false },
    ],
  },
  {
    field: 'status',
    label: '状态',
    component: 'radio',
    options: statusOptions.value,
    rules: [{ required: true, message: '状态不能为空', trigger: 'change' }],
  },
]);

function openKbAdd(): void {
  Object.keys(kbForm).forEach((k) => delete kbForm[k]);
  Object.assign(kbForm, {
    vectorStoreType: 'milvus',
    chunkSize: 500,
    chunkOverlap: 100,
    hybridSearch: true,
    rerank: true,
    status: 0,
  });
  kbDialogVisible.value = true;
}

async function openKbEdit(row: KnowledgeBaseVO): Promise<void> {
  const detail = await getKnowledgeBase(row.id);
  Object.keys(kbForm).forEach((k) => delete kbForm[k]);
  Object.assign(kbForm, {
    id: detail.id,
    name: detail.name,
    description: detail.description,
    vectorStoreType: detail.vectorStoreType,
    embeddingModel: detail.embeddingModel,
    chunkSize: detail.chunkSize,
    chunkOverlap: detail.chunkOverlap,
    hybridSearch: detail.hybridSearch ?? true,
    rerank: detail.rerank ?? true,
    status: detail.status,
  });
  kbDialogVisible.value = true;
}

async function handleKbSubmit(): Promise<void> {
  const valid = await kbFormRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  kbConfirmLoading.value = true;
  try {
    const body: KnowledgeBaseSaveBody = {
      id: (kbForm.id as string) || undefined,
      name: kbForm.name as string,
      description: (kbForm.description as string) || undefined,
      vectorStoreType: kbForm.vectorStoreType as KnowledgeBaseSaveBody['vectorStoreType'],
      embeddingModel: (kbForm.embeddingModel as string) || undefined,
      chunkSize: Number(kbForm.chunkSize),
      chunkOverlap: Number(kbForm.chunkOverlap),
      hybridSearch: kbForm.hybridSearch !== false,
      rerank: kbForm.rerank !== false,
      status: Number(kbForm.status),
    };
    if (isKbEdit.value) {
      await updateKnowledgeBase(body);
    } else {
      await createKnowledgeBase(body);
    }
    ElMessage.success(isKbEdit.value ? '修改成功' : '新增成功');
    kbDialogVisible.value = false;
    await load();
  } finally {
    kbConfirmLoading.value = false;
  }
}

async function handleKbDelete(row: KnowledgeBaseVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除知识库「${row.name}」吗？关联文档与向量将一并清理。`, '提示', { type: 'warning' });
  await deleteKnowledgeBase(row.id);
  ElMessage.success('删除成功');
  await load();
}

/* ================= 检索调试 ================= */

const searchDialogVisible = ref(false);
const searchForm = reactive<KbSearchBody>({ kbId: '', query: '', topK: 5 });
const searchFormRef = ref<InstanceType<typeof YForm>>();
const searchResults = ref<KbSearchResult[]>([]);
const searchLoading = ref(false);

const searchFormSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'query',
    label: '查询',
    component: 'textarea',
    placeholder: '输入要检索的自然语言问题',
    rules: [{ required: true, message: '查询内容不能为空', trigger: 'blur' }],
    props: { rows: 3 },
  },
  {
    field: 'topK',
    label: '召回数量',
    component: 'number',
    placeholder: '默认 5',
    rules: [{ required: true, message: '召回数量不能为空', trigger: 'blur' }],
    props: { min: 1, max: 50, step: 1 },
  },
]);

const searchResultColumns: YTableColumn<KbSearchResult>[] = [
  {
    prop: 'content',
    label: '文本内容',
    minWidth: 240,
    showOverflowTooltip: true,
    formatter: (row) => row.content || '-',
  },
  {
    prop: 'score',
    label: 'RRF 分数',
    width: 100,
    align: 'center',
    formatter: (row) => (row.score != null ? row.score.toFixed(4) : '-'),
  },
  {
    prop: 'rerankScore',
    label: '重排分数',
    width: 100,
    align: 'center',
    formatter: (row) => (row.rerankScore != null ? row.rerankScore.toFixed(4) : '-'),
  },
  {
    prop: 'vectorRank',
    label: '向量排名',
    width: 90,
    align: 'center',
    formatter: (row) => (row.vectorRank ? String(row.vectorRank) : '-'),
  },
  {
    prop: 'bm25Rank',
    label: 'BM25 排名',
    width: 100,
    align: 'center',
    formatter: (row) => (row.bm25Rank ? String(row.bm25Rank) : '-'),
  },
  {
    prop: 'source',
    label: '来源文件',
    minWidth: 140,
    showOverflowTooltip: true,
    formatter: (row) =>
      row.fileName ||
      (row.metadata?.fileName as string) ||
      (row.metadata?.file_name as string) ||
      (row.metadata?.source as string) ||
      '-',
  },
];

function openSearchDebug(row: KnowledgeBaseVO): void {
  currentKb.value = row;
  searchForm.kbId = row.id;
  searchForm.query = '';
  searchForm.topK = 5;
  searchResults.value = [];
  searchDialogVisible.value = true;
}

async function handleSearch(): Promise<void> {
  const valid = await searchFormRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  searchLoading.value = true;
  try {
    searchResults.value = await searchKb({
      kbId: currentKb.value!.id,
      query: searchForm.query,
      topK: Number(searchForm.topK),
    });
  } finally {
    searchLoading.value = false;
  }
}

/* ================= 文档管理 ================= */

const currentKb = ref<KnowledgeBaseVO>();
const docDialogVisible = ref(false);
const uploadDialogVisible = ref(false);

const docQuery = reactive<KbDocPageQuery>({ kbId: '', fileName: '', status: '' });
const docLoading = ref(false);
const docRows = ref<KbDocumentVO[]>([]);
const docTotal = ref(0);
const docPageNum = ref(1);
const docPageSize = ref(10);

const DOC_STATUS_MAP: Record<number, string> = {
  0: '待索引',
  1: '索引中',
  2: '已完成',
  3: '失败',
};

const docColumns: YTableColumn<KbDocumentVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'fileName', label: '文件名', minWidth: 200, showOverflowTooltip: true },
  { prop: 'fileType', label: '类型', width: 100 },
  {
    prop: 'fileSize',
    label: '大小',
    width: 100,
    formatter: (row) => formatFileSize(row.fileSize),
  },
  { prop: 'vectorCount', label: '向量数', width: 90, align: 'center' },
  {
    prop: 'status',
    label: '索引状态',
    width: 100,
    align: 'center',
    formatter: (row) => DOC_STATUS_MAP[row.status] ?? row.status,
  },
  { prop: 'errorMsg', label: '错误信息', minWidth: 160, showOverflowTooltip: true, formatter: (row) => row.errorMsg || '-' },
  { prop: 'createTime', label: '上传时间', width: 170 },
];

async function loadDocs(): Promise<void> {
  if (!currentKb.value) return;
  docLoading.value = true;
  try {
    const page = await pageKbDocs({
      kbId: currentKb.value.id,
      fileName: docQuery.fileName || undefined,
      status: docQuery.status === '' ? undefined : Number(docQuery.status),
      pageNum: docPageNum.value,
      pageSize: docPageSize.value,
    });
    docRows.value = page.list ?? [];
    docTotal.value = page.total ?? 0;
  } finally {
    docLoading.value = false;
  }
}

function searchDocs(): void {
  docPageNum.value = 1;
  void loadDocs();
}

function resetDocs(): void {
  docQuery.fileName = '';
  docQuery.status = '';
  searchDocs();
}

function openDocManage(row: KnowledgeBaseVO): void {
  currentKb.value = row;
  docDialogVisible.value = true;
  resetDocs();
}

/* ================= 文档上传 ================= */

const pendingDoc = reactive<Partial<KbDocUploadBody>>({});
const uploadConfirmLoading = ref(false);

async function handleDocUpload(file: File): Promise<string> {
  const url = await uploadFile(file);
  Object.assign(pendingDoc, {
    fileName: file.name,
    fileUrl: url,
    fileType: file.type || undefined,
    fileSize: file.size,
  });
  return url;
}

function openUploadDoc(): void {
  Object.assign(pendingDoc, { fileName: undefined, fileUrl: undefined, fileType: undefined, fileSize: undefined });
  uploadDialogVisible.value = true;
}

async function handleUploadSubmit(): Promise<void> {
  if (!currentKb.value) return;
  if (!pendingDoc.fileUrl) {
    ElMessage.warning('请先上传文件');
    return;
  }
  uploadConfirmLoading.value = true;
  try {
    await uploadKbDoc({
      kbId: currentKb.value.id,
      fileName: pendingDoc.fileName!,
      fileUrl: pendingDoc.fileUrl,
      fileType: pendingDoc.fileType,
      fileSize: pendingDoc.fileSize,
    });
    ElMessage.success('上传成功，正在索引');
    uploadDialogVisible.value = false;
    await loadDocs();
    await load();
  } finally {
    uploadConfirmLoading.value = false;
  }
}

async function handleDocDelete(row: KbDocumentVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除文档「${row.fileName}」吗？`, '提示', { type: 'warning' });
  await deleteKbDoc(row.id);
  ElMessage.success('删除成功');
  await loadDocs();
  await load();
}

async function handleDocReindex(row: KbDocumentVO): Promise<void> {
  await ElMessageBox.confirm(`确定重新向量化文档「${row.fileName}」吗？`, '提示', { type: 'info' });
  await reindexKbDoc(row.id);
  ElMessage.success('已重新索引');
  await loadDocs();
}

/* ================= 分块查看 / 解析预览 ================= */

const currentDoc = ref<KbDocumentVO>();
const chunkDialogVisible = ref(false);
const previewDialogVisible = ref(false);
const chunkLoading = ref(false);
const chunkRows = ref<KbChunkVO[]>([]);

const chunkColumns: YTableColumn<KbChunkVO>[] = [
  { type: 'expand', slot: 'chunkExpand' },
  { prop: 'chunkIndex', label: '块序号', width: 90, align: 'center' },
  {
    prop: 'charCount',
    label: '字符数',
    width: 90,
    align: 'center',
    formatter: (row) => String(row.content?.length ?? 0),
  },
  { prop: 'content', label: '分块内容（点击展开查看完整文本）', minWidth: 300, showOverflowTooltip: true },
];

/** 解析预览全文：按块序号拼接（相邻块含重叠区间） */
const previewText = computed(() => chunkRows.value.map((c) => c.content).join('\n\n'));

async function loadChunks(row: KbDocumentVO): Promise<void> {
  currentDoc.value = row;
  chunkRows.value = [];
  chunkLoading.value = true;
  try {
    chunkRows.value = await listDocChunks(row.id);
  } finally {
    chunkLoading.value = false;
  }
}

function openDocChunks(row: KbDocumentVO): void {
  chunkDialogVisible.value = true;
  void loadChunks(row);
}

function openDocPreview(row: KbDocumentVO): void {
  previewDialogVisible.value = true;
  void loadChunks(row);
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
</script>

<template>
  <div class="page-card">
    <div class="kb-page__bar">
      <ElButton v-hasPermi="'ai:kb:add'" type="primary" :icon="Plus" @click="openKbAdd">新增知识库</ElButton>
    </div>

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
      <template #status="{ row }">
        <DictTag :value="(row as KnowledgeBaseVO).status" :options="sys_common_status" />
      </template>
      <ElTableColumn label="操作" width="320" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton v-hasPermi="'ai:kb:edit'" link type="primary" @click="openKbEdit(row as KnowledgeBaseVO)">编辑</ElButton>
          <ElButton link type="primary" @click="openDocManage(row as KnowledgeBaseVO)">文档管理</ElButton>
          <ElButton link type="success" @click="openSearchDebug(row as KnowledgeBaseVO)">检索调试</ElButton>
          <ElButton v-hasPermi="'ai:kb:delete'" link type="danger" @click="handleKbDelete(row as KnowledgeBaseVO)">删除</ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <!-- 知识库表单 -->
    <YDialog
      v-model="kbDialogVisible"
      :title="isKbEdit ? '编辑知识库' : '新增知识库'"
      width="560px"
      :confirm-loading="kbConfirmLoading"
      @confirm="handleKbSubmit"
    >
      <YForm ref="kbFormRef" v-model="kbForm" :schemas="kbFormSchemas" label-width="120px" />
    </YDialog>

    <!-- 文档管理 -->
    <YDialog
      v-model="docDialogVisible"
      :title="`${currentKb?.name ?? ''} - 文档管理`"
      width="900px"
      :show-footer="false"
    >
      <div class="doc-manage">
        <div class="doc-manage__bar">
          <ElButton v-hasPermi="'ai:kb:doc:add'" type="primary" :icon="Plus" @click="openUploadDoc">上传文档</ElButton>
        </div>
        <YSearchForm v-model="docQuery" :schemas="[
          { field: 'fileName', label: '文件名', component: 'input', placeholder: '按文件名模糊查询' },
          { field: 'status', label: '索引状态', component: 'select', placeholder: '全部', options: [
            { label: '待索引', value: 0 },
            { label: '索引中', value: 1 },
            { label: '已完成', value: 2 },
            { label: '失败', value: 3 },
          ]},
        ]" @search="searchDocs" @reset="resetDocs" />
        <YTable
          v-model:page-num="docPageNum"
          v-model:page-size="docPageSize"
          :loading="docLoading"
          :data="docRows"
          :columns="docColumns"
          :total="docTotal"
          row-key="id"
          @refresh="loadDocs"
        >
          <ElTableColumn label="操作" width="300" align="center" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" @click="openDocChunks(row as KbDocumentVO)">查看分块</ElButton>
              <ElButton link type="primary" @click="openDocPreview(row as KbDocumentVO)">解析预览</ElButton>
              <ElButton v-hasPermi="'ai:kb:doc:reindex'" link type="primary" @click="handleDocReindex(row as KbDocumentVO)">重新索引</ElButton>
              <ElButton v-hasPermi="'ai:kb:doc:delete'" link type="danger" @click="handleDocDelete(row as KbDocumentVO)">删除</ElButton>
            </template>
          </ElTableColumn>
        </YTable>
      </div>
    </YDialog>

    <!-- 上传文档 -->
    <YDialog
      v-model="uploadDialogVisible"
      title="上传文档"
      width="520px"
      :confirm-loading="uploadConfirmLoading"
      @confirm="handleUploadSubmit"
    >
      <div class="upload-tip">支持 PDF、Word、TXT、Markdown 等常见文档格式；上传后将自动解析、分块并写入向量库。</div>
      <FileUpload :upload="handleDocUpload" :max-size-mb="50" accept=".pdf,.doc,.docx,.txt,.md" />
    </YDialog>

    <!-- 查看分块 -->
    <YDialog
      v-model="chunkDialogVisible"
      :title="`${currentDoc?.fileName ?? ''} - 分块查看`"
      width="860px"
      :show-footer="false"
    >
      <YTable
        :loading="chunkLoading"
        :data="chunkRows"
        :columns="chunkColumns"
        hide-pagination
        row-key="id"
      >
        <template #chunkExpand="{ row }">
          <pre class="chunk-full">{{ (row as KbChunkVO).content }}</pre>
        </template>
        <template #empty>
          <span>该文档暂无文本块（未完成索引或旧数据未回填）</span>
        </template>
      </YTable>
    </YDialog>

    <!-- 解析预览 -->
    <YDialog
      v-model="previewDialogVisible"
      :title="`${currentDoc?.fileName ?? ''} - 解析预览`"
      width="780px"
      :show-footer="false"
    >
      <div v-loading="chunkLoading" class="doc-preview">
        <div class="doc-preview__meta">
          <span>分块大小：{{ currentDoc?.chunkSize ?? '-' }}</span>
          <span>分块重叠：{{ currentDoc?.chunkOverlap ?? '-' }}</span>
          <span>分块数：{{ currentDoc?.chunkCount ?? chunkRows.length }}</span>
          <span>向量数：{{ currentDoc?.vectorCount ?? '-' }}</span>
        </div>
        <div class="doc-preview__tip">以下为按分块顺序拼接的解析全文；相邻分块存在重叠区间，重复内容属正常现象。</div>
        <pre class="doc-preview__body">{{ previewText || '暂无解析内容' }}</pre>
      </div>
    </YDialog>

    <!-- 检索调试 -->
    <YDialog
      v-model="searchDialogVisible"
      :title="`${currentKb?.name ?? ''} - 检索调试`"
      width="880px"
      :show-footer="false"
    >
      <div class="search-debug">
        <div class="search-debug__form">
          <YForm ref="searchFormRef" v-model="searchForm" :schemas="searchFormSchemas" label-width="90px" inline />
          <ElButton type="primary" :loading="searchLoading" @click="handleSearch">执行检索</ElButton>
        </div>
        <YTable
          :loading="searchLoading"
          :data="searchResults"
          :columns="searchResultColumns"
          hide-pagination
          row-key="id"
        >
          <template #empty>
            <span>请输入查询并点击“执行检索”</span>
          </template>
        </YTable>
      </div>
    </YDialog>
  </div>
</template>

<style scoped>
.kb-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.doc-manage__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.upload-tip {
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.search-debug__form {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.search-debug__form :deep(.el-form) {
  flex: 1;
}
.chunk-full {
  margin: 0;
  padding: 8px 16px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
  line-height: 1.7;
}
.doc-preview__meta {
  display: flex;
  gap: 20px;
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.doc-preview__tip {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.doc-preview__body {
  max-height: 480px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
  line-height: 1.7;
}
</style>
