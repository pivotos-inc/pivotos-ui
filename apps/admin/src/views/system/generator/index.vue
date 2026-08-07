<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElInput, ElMessage, ElMessageBox, ElSwitch, ElTableColumn, ElTabPane, ElTabs } from 'element-plus';
import { YTable, YForm, YDialog } from '@pivotos/ui';
import type { GenTableColumnVO, GenTableVO, DbTableVO } from '@pivotos/types';
import {
  listDbTables,
  importTable,
  listGenTables,
  deleteGenTable,
  synchGenTable,
  listGenColumns,
  updateGenColumn,
  previewCode,
  generateToProject,
  downloadCode,
} from '@/api/generator';

/* ================= 导入配置 ================= */
const importDialogVisible = ref(false);
const importLoading = ref(false);
const importFormRef = ref();
const importFormModel = reactive({
  tableNames: [] as string[],
  packageName: 'com.pivotos.system',
  moduleName: 'system',
  businessName: '',
  functionName: '',
  functionAuthor: 'PivotOS',
  tableComment: '',
});
const importSchemas = computed(() => [
  { prop: 'packageName', label: '父包名', component: 'el-input', placeholder: 'com.pivotos.system' },
  { prop: 'moduleName', label: '模块名', component: 'el-input', placeholder: 'system' },
  { prop: 'businessName', label: '业务名', component: 'el-input', placeholder: '业务标识（英文）' },
  { prop: 'functionName', label: '功能名称', component: 'el-input', placeholder: '功能描述（中文）' },
  { prop: 'functionAuthor', label: '生成作者', component: 'el-input', placeholder: 'PivotOS' },
]);

/* ================= DB 表列表 ================= */
const dbTableLoading = ref(false);
const dbTableRows = ref<DbTableVO[]>([]);
const dbTableTotal = ref(0);
const dbTableParams = reactive({ pageNum: 1, pageSize: 10, tableName: '', tableComment: '' });
const selectedTables = ref<DbTableVO[]>([]);

const dbTableColumns: any[] = [
  { type: 'selection', width: 50 },
  { prop: 'tableName', label: '表名', minWidth: 200 },
  { prop: 'tableComment', label: '表描述', minWidth: 200 },
  { prop: 'createTime', label: '创建时间', width: 180 },
];

async function loadDbTables() {
  dbTableLoading.value = true;
  try {
    const res: any = await listDbTables(dbTableParams);
    dbTableRows.value = res?.records ?? [];
    dbTableTotal.value = res?.total ?? 0;
  } finally {
    dbTableLoading.value = false;
  }
}

function handleDbTableSelect(selection: DbTableVO[]) {
  selectedTables.value = selection;
}

function openImport() {
  if (selectedTables.value.length === 0) {
    ElMessage.warning('请先选择要导入的表');
    return;
  }
  importFormModel.tableNames = selectedTables.value.map(t => t.tableName);
  importFormModel.businessName = '';
  importFormModel.functionName = '';
  importFormModel.tableComment = '';
  importDialogVisible.value = true;
}

async function handleImport() {
  importLoading.value = true;
  try {
    await importTable({ ...importFormModel });
    ElMessage.success('表导入成功');
    importDialogVisible.value = false;
    await loadGenTables();
  } finally {
    importLoading.value = false;
  }
}

/* ================= 已导入表列表 ================= */
const genTableLoading = ref(false);
const genTableRows = ref<GenTableVO[]>([]);
const genTableTotal = ref(0);
const genTableParams = reactive({ pageNum: 1, pageSize: 10, tableName: '' });

const genTableColumns: any[] = [
  { prop: 'tableName', label: '表名', width: 180 },
  { prop: 'tableComment', label: '表描述', minWidth: 150 },
  { prop: 'className', label: '实体类名', width: 140 },
  { prop: 'functionAuthor', label: '作者', width: 100 },
  { prop: 'createTime', label: '创建时间', width: 160 },
];

async function loadGenTables() {
  genTableLoading.value = true;
  try {
    const res: any = await listGenTables(genTableParams);
    genTableRows.value = res?.records ?? [];
    genTableTotal.value = res?.total ?? 0;
  } finally {
    genTableLoading.value = false;
  }
}

async function handleDelete(row: GenTableVO) {
  await ElMessageBox.confirm(`确定删除表「${row.tableName}」吗？删除后不可恢复。`, '确认删除', { type: 'warning' });
  await deleteGenTable(row.id);
  ElMessage.success('删除成功');
  await loadGenTables();
}

async function handleSynch(row: GenTableVO) {
  await synchGenTable(row.id);
  ElMessage.success('同步成功');
}

async function handleDownload(row: GenTableVO) {
  const res: any = await downloadCode(row.id);
  const blob = res instanceof Blob ? res : new Blob([res], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${row.tableName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('下载成功');
}

async function handleGenerate(row: GenTableVO) {
  await ElMessageBox.confirm(`确定将「${row.tableName}」的代码生成到工程吗？`, '确认生成', {
    confirmButtonText: '确定生成',
    type: 'warning',
  });
  await generateToProject(row.id);
  ElMessage.success('生成成功');
}

/* ================= 字段配置 ================= */
const columnDialogVisible = ref(false);
const columnLoading = ref(false);
const currentTableId = ref('');
const columns = ref<GenTableColumnVO[]>([]);

async function openColumns(row: GenTableVO) {
  currentTableId.value = row.id;
  columnDialogVisible.value = true;
  columnLoading.value = true;
  try {
    columns.value = await listGenColumns(row.id);
  } finally {
    columnLoading.value = false;
  }
}

async function handleColumnUpdate(col: GenTableColumnVO, field: keyof GenTableColumnVO, val: any) {
  (col as any)[field] = val;
  await updateGenColumn(col);
  ElMessage.success('保存成功');
}

/* ================= 代码预览 ================= */
const previewDialogVisible = ref(false);
const previewLoading = ref(false);
const previewFiles = ref<Record<string, string>>({});
const previewActiveFile = ref('');

async function openPreview(row: GenTableVO) {
  previewDialogVisible.value = true;
  previewLoading.value = true;
  try {
    previewFiles.value = await previewCode(row.id);
    previewActiveFile.value = Object.keys(previewFiles.value)[0] ?? '';
  } finally {
    previewLoading.value = false;
  }
}

const previewFileList = computed(() => Object.keys(previewFiles.value));

/* ================= 生命周期 ================= */
onMounted(() => {
  loadDbTables();
  loadGenTables();
});
</script>

<template>
  <div class="page-card">
    <ElTabs>
      <ElTabPane label="数据库表导入" name="import">
        <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center">
          <ElInput v-model="dbTableParams.tableName" placeholder="搜索表名" clearable style="width: 200px" @keyup.enter="loadDbTables" />
          <ElInput v-model="dbTableParams.tableComment" placeholder="搜索表描述" clearable style="width: 200px" @keyup.enter="loadDbTables" />
          <ElButton @click="loadDbTables">查询</ElButton>
          <ElButton type="primary" @click="openImport" :disabled="selectedTables.length === 0">
            导入选中表 ({{ selectedTables.length }})
          </ElButton>
        </div>
        <YTable
          v-model:page-num="dbTableParams.pageNum"
          v-model:page-size="dbTableParams.pageSize"
          v-loading="dbTableLoading"
          :data="dbTableRows"
          :columns="dbTableColumns"
          :total="dbTableTotal"
          row-key="tableName"
          @selection-change="handleDbTableSelect"
          @refresh="loadDbTables"
        />
        <!-- import dialog -->
        <YDialog v-model="importDialogVisible" title="导入表配置" width="520px" :confirm-loading="importLoading" @confirm="handleImport">
          <YForm ref="importFormRef" v-model="importFormModel" :schemas="importSchemas" :label-width="'100px'" />
          <div style="margin-top: 12px; color: #909399; font-size: 13px">
            已选表：{{ importFormModel.tableNames.join(', ') }}
          </div>
        </YDialog>
      </ElTabPane>

      <ElTabPane label="已导入表" name="gen">
        <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center">
          <ElInput v-model="genTableParams.tableName" placeholder="搜索表名" clearable style="width: 200px" @keyup.enter="loadGenTables" />
          <ElButton @click="loadGenTables">查询</ElButton>
        </div>
        <YTable
          v-model:page-num="genTableParams.pageNum"
          v-model:page-size="genTableParams.pageSize"
          :loading="genTableLoading"
          :data="genTableRows"
          :columns="genTableColumns"
          :total="genTableTotal"
          row-key="id"
          @refresh="loadGenTables"
        >
          <ElTableColumn label="操作" width="320" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" @click="openPreview(row)">预览</ElButton>
              <ElButton link type="primary" @click="openColumns(row)">字段</ElButton>
              <ElButton link type="success" @click="handleSynch(row)">同步</ElButton>
              <ElButton link type="primary" @click="handleDownload(row)">下载</ElButton>
              <ElButton link type="warning" @click="handleGenerate(row)">生成</ElButton>
              <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
            </template>
          </ElTableColumn>
        </YTable>
      </ElTabPane>
    </ElTabs>

    <!-- 字段配置弹窗 -->
    <YDialog v-model="columnDialogVisible" title="字段配置" width="900px">
      <YTable v-loading="columnLoading" :data="columns" row-key="id">
        <ElTableColumn prop="columnName" label="列名" width="140" />
        <ElTableColumn prop="columnComment" label="描述" width="120" />
        <ElTableColumn prop="javaType" label="Java类型" width="100" />
        <ElTableColumn prop="javaField" label="字段名" width="120" />
        <ElTableColumn label="列表" width="65">
          <template #default="{ row }">
            <ElSwitch :model-value="row.isList === 1" size="small" @change="(v: boolean) => handleColumnUpdate(row, 'isList', v ? 1 : 0)" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="查询" width="65">
          <template #default="{ row }">
            <ElSwitch :model-value="row.isQuery === 1" size="small" @change="(v: boolean) => handleColumnUpdate(row, 'isQuery', v ? 1 : 0)" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="新增" width="65">
          <template #default="{ row }">
            <ElSwitch :model-value="row.isInsert === 1" size="small" @change="(v: boolean) => handleColumnUpdate(row, 'isInsert', v ? 1 : 0)" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="编辑" width="65">
          <template #default="{ row }">
            <ElSwitch :model-value="row.isEdit === 1" size="small" @change="(v: boolean) => handleColumnUpdate(row, 'isEdit', v ? 1 : 0)" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="必填" width="65">
          <template #default="{ row }">
            <ElSwitch :model-value="row.isRequired === 1" size="small" @change="(v: boolean) => handleColumnUpdate(row, 'isRequired', v ? 1 : 0)" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="查询方式" width="100">
          <template #default="{ row }">
            <ElInput v-model="row.queryType" size="small" @change="(v: string) => handleColumnUpdate(row, 'queryType', v)" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="显示类型" width="110">
          <template #default="{ row }">
            <ElInput v-model="row.htmlType" size="small" @change="(v: string) => handleColumnUpdate(row, 'htmlType', v)" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="字典类型" width="120">
          <template #default="{ row }">
            <ElInput v-model="row.dictType" size="small" @change="(v: string) => handleColumnUpdate(row, 'dictType', v)" />
          </template>
        </ElTableColumn>
      </YTable>
    </YDialog>

    <!-- 代码预览弹窗 -->
    <YDialog v-model="previewDialogVisible" title="代码预览" width="900px" :show-footer="false">
      <div v-loading="previewLoading" style="display: flex; height: 500px">
        <div style="width: 200px; border-right: 1px solid #e4e7ed; overflow-y: auto; padding: 8px">
          <div
            v-for="file in previewFileList"
            :key="file"
            style="padding: 6px 8px; cursor: pointer; border-radius: 4px; font-size: 13px"
            :style="{ background: previewActiveFile === file ? '#ecf5ff' : 'transparent', color: previewActiveFile === file ? '#165dff' : '#333' }"
            @click="previewActiveFile = file"
          >
            {{ file.split('/').pop() }}
          </div>
        </div>
        <div style="flex: 1; overflow: auto">
          <pre style="margin: 0; padding: 12px; font-size: 13px; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; word-break: break-all"><code>{{ previewFiles[previewActiveFile] }}</code></pre>
        </div>
      </div>
    </YDialog>
  </div>
</template>

<style scoped>
.page-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 12px;
}
</style>
