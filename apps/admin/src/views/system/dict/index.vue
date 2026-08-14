<script setup lang="ts">
defineOptions({ name: 'SystemDict' });
import { computed, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import type {
  DictDataQuery,
  DictDataSaveRequest,
  DictDataVO,
  DictTypeQuery,
  DictTypeSaveRequest,
  DictTypeVO,
} from '@pivotos/types';
import {
  createDictData,
  createDictType,
  deleteDictData,
  deleteDictType,
  getDictType,
  updateDictData,
  updateDictType,
} from '@/api/system/dict';
import { useDict, useTablePage } from '@/hooks';

const { sys_common_status } = useDict('sys_common_status');

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

// ---------- 左：字典类型 ----------
const {
  loading: typeLoading,
  rows: typeRows,
  total: typeTotal,
  params: typeParams,
  load: loadTypes,
  search: searchTypes,
  reset: resetTypes,
} = useTablePage<DictTypeVO, DictTypeQuery>({
  url: '/system/dict/type/page',
  query: { dictName: '', dictType: '', status: undefined },
});

const typeSearchSchemas = computed<YFormSchema[]>(() => [
  { field: 'dictName', label: '字典名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'dictType', label: '字典类型', component: 'input', placeholder: '按类型模糊查询' },
]);

const typeColumns: YTableColumn<DictTypeVO>[] = [
  { prop: 'dictName', label: '字典名称', minWidth: 120 },
  { prop: 'dictType', label: '字典类型', minWidth: 150 },
  { prop: 'status', label: '状态', width: 80, align: 'center', slot: 'status' },
];

const typeFormVisible = ref(false);
const typeConfirmLoading = ref(false);
const typeFormRef = ref<InstanceType<typeof YForm>>();
const typeFormModel = reactive<Record<string, unknown>>({});
const isTypeEdit = computed(() => !!typeFormModel.id);

const typeFormSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'dictName',
    label: '字典名称',
    component: 'input',
    placeholder: '请输入字典名称',
    rules: [{ required: true, message: '字典名称不能为空', trigger: 'blur' }],
  },
  {
    field: 'dictType',
    label: '字典类型',
    component: 'input',
    placeholder: '如 sys_common_status',
    props: { disabled: isTypeEdit.value },
    rules: [{ required: true, message: '字典类型不能为空', trigger: 'blur' }],
  },
  { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

function openTypeAdd(): void {
  Object.keys(typeFormModel).forEach((k) => delete typeFormModel[k]);
  Object.assign(typeFormModel, { status: 0 });
  typeFormVisible.value = true;
}

async function openTypeEdit(row: DictTypeVO): Promise<void> {
  const detail = await getDictType(row.id);
  Object.keys(typeFormModel).forEach((k) => delete typeFormModel[k]);
  Object.assign(typeFormModel, { ...detail });
  typeFormVisible.value = true;
}

async function handleTypeSubmit(): Promise<void> {
  const valid = await typeFormRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  typeConfirmLoading.value = true;
  try {
    const body: DictTypeSaveRequest = {
      id: typeFormModel.id as string | undefined,
      dictName: typeFormModel.dictName as string,
      dictType: typeFormModel.dictType as string,
      status: typeFormModel.status as number | undefined,
      remark: typeFormModel.remark as string | undefined,
    };
    if (isTypeEdit.value) {
      await updateDictType(body);
    } else {
      await createDictType(body);
    }
    ElMessage.success(isTypeEdit.value ? '修改成功' : '新增成功');
    typeFormVisible.value = false;
    await loadTypes();
  } finally {
    typeConfirmLoading.value = false;
  }
}

async function handleTypeDelete(row: DictTypeVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除字典「${row.dictName}」吗？`, '提示', { type: 'warning' });
  await deleteDictType(row.id);
  ElMessage.success('删除成功');
  if (currentType.value === row.dictType) currentType.value = '';
  await loadTypes();
}

// ---------- 右：字典数据（主从联动） ----------
const currentType = ref('');

const {
  loading: dataLoading,
  rows: dataRows,
  total: dataTotal,
  params: dataParams,
  load: loadData,
  search: searchData,
} = useTablePage<DictDataVO, DictDataQuery>({
  url: '/system/dict/data/page',
  query: { dictType: '' },
  immediate: false,
});

function selectType(row: DictTypeVO): void {
  currentType.value = row.dictType;
  dataParams.dictType = row.dictType;
  void searchData();
}

const dataColumns: YTableColumn<DictDataVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'dictLabel', label: '字典标签', minWidth: 110 },
  { prop: 'dictValue', label: '字典键值', width: 100, align: 'center' },
  { prop: 'sort', label: '排序', width: 70, align: 'center' },
  { prop: 'status', label: '状态', width: 80, align: 'center', slot: 'status' },
  { prop: 'remark', label: '备注', minWidth: 120 },
];

const dataFormVisible = ref(false);
const dataConfirmLoading = ref(false);
const dataFormRef = ref<InstanceType<typeof YForm>>();
const dataFormModel = reactive<Record<string, unknown>>({});
const isDataEdit = computed(() => !!dataFormModel.id);

const dataFormSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'dictLabel',
    label: '字典标签',
    component: 'input',
    placeholder: '请输入字典标签',
    rules: [{ required: true, message: '字典标签不能为空', trigger: 'blur' }],
  },
  {
    field: 'dictValue',
    label: '字典键值',
    component: 'input',
    placeholder: '请输入字典键值',
    rules: [{ required: true, message: '字典键值不能为空', trigger: 'blur' }],
  },
  { field: 'sort', label: '显示顺序', component: 'number', props: { min: 0 } },
  { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

function openDataAdd(): void {
  if (!currentType.value) {
    ElMessage.warning('请先在左侧选择字典类型');
    return;
  }
  Object.keys(dataFormModel).forEach((k) => delete dataFormModel[k]);
  Object.assign(dataFormModel, { sort: 0, status: 0 });
  dataFormVisible.value = true;
}

function openDataEdit(row: DictDataVO): void {
  Object.keys(dataFormModel).forEach((k) => delete dataFormModel[k]);
  Object.assign(dataFormModel, { ...row });
  dataFormVisible.value = true;
}

async function handleDataSubmit(): Promise<void> {
  const valid = await dataFormRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  dataConfirmLoading.value = true;
  try {
    const body: DictDataSaveRequest = {
      id: dataFormModel.id as string | undefined,
      dictType: currentType.value,
      dictLabel: dataFormModel.dictLabel as string,
      dictValue: dataFormModel.dictValue as string,
      sort: dataFormModel.sort as number | undefined,
      status: dataFormModel.status as number | undefined,
      remark: dataFormModel.remark as string | undefined,
    };
    if (isDataEdit.value) {
      await updateDictData(body);
    } else {
      await createDictData(body);
    }
    ElMessage.success(isDataEdit.value ? '修改成功' : '新增成功');
    dataFormVisible.value = false;
    await loadData();
  } finally {
    dataConfirmLoading.value = false;
  }
}

async function handleDataDelete(row: DictDataVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除字典项「${row.dictLabel}」吗？`, '提示', { type: 'warning' });
  await deleteDictData(row.id);
  ElMessage.success('删除成功');
  await loadData();
}
</script>

<template>
  <div class="dict-page">
    <!-- 左：字典类型 -->
    <div class="page-card dict-page__pane">
      <div class="dict-page__bar">
        <ElButton v-hasPermi="'system:dict:add'" type="primary" :icon="Plus" @click="openTypeAdd">
          新增类型
        </ElButton>
      </div>
      <YSearchForm
        v-model="typeParams"
        :schemas="typeSearchSchemas"
        @search="searchTypes"
        @reset="resetTypes"
      />
      <YTable
        v-model:page-num="typeParams.pageNum"
        v-model:page-size="typeParams.pageSize"
        :loading="typeLoading"
        :data="typeRows"
        :columns="typeColumns"
        :total="typeTotal"
        row-key="id"
        @refresh="loadTypes"
      >
        <template #status="{ row }">
          <DictTag :value="(row as DictTypeVO).status" :options="sys_common_status" />
        </template>
        <ElTableColumn label="操作" width="170" align="center" fixed="right">
          <template #default="{ row }">
            <ElButton link type="success" @click="selectType(row as DictTypeVO)">数据</ElButton>
            <ElButton
              v-hasPermi="'system:dict:edit'"
              link
              type="primary"
              @click="openTypeEdit(row as DictTypeVO)"
            >
              编辑
            </ElButton>
            <ElButton
              v-hasPermi="'system:dict:remove'"
              link
              type="danger"
              @click="handleTypeDelete(row as DictTypeVO)"
            >
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </YTable>
    </div>

    <!-- 右：字典数据 -->
    <div class="page-card dict-page__pane">
      <div class="dict-page__bar dict-page__bar--split">
        <span class="dict-page__current">
          {{ currentType ? `字典数据：${currentType}` : '请选择左侧字典类型' }}
        </span>
        <ElButton v-hasPermi="'system:dict:add'" type="primary" :icon="Plus" @click="openDataAdd">
          新增数据
        </ElButton>
      </div>
      <YTable
        v-model:page-num="dataParams.pageNum"
        v-model:page-size="dataParams.pageSize"
        :loading="dataLoading"
        :data="dataRows"
        :columns="dataColumns"
        :total="dataTotal"
        row-key="id"
        @refresh="loadData"
      >
        <template #status="{ row }">
          <DictTag :value="(row as DictDataVO).status" :options="sys_common_status" />
        </template>
        <ElTableColumn label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <ElButton
              v-hasPermi="'system:dict:edit'"
              link
              type="primary"
              @click="openDataEdit(row as DictDataVO)"
            >
              编辑
            </ElButton>
            <ElButton
              v-hasPermi="'system:dict:remove'"
              link
              type="danger"
              @click="handleDataDelete(row as DictDataVO)"
            >
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </YTable>
    </div>

    <YDialog
      v-model="typeFormVisible"
      :title="isTypeEdit ? '编辑字典类型' : '新增字典类型'"
      width="480px"
      :confirm-loading="typeConfirmLoading"
      @confirm="handleTypeSubmit"
    >
      <YForm ref="typeFormRef" v-model="typeFormModel" :schemas="typeFormSchemas" label-width="90px" />
    </YDialog>

    <YDialog
      v-model="dataFormVisible"
      :title="`${isDataEdit ? '编辑' : '新增'}字典数据 - ${currentType}`"
      width="480px"
      :confirm-loading="dataConfirmLoading"
      @confirm="handleDataSubmit"
    >
      <YForm ref="dataFormRef" v-model="dataFormModel" :schemas="dataFormSchemas" label-width="90px" />
    </YDialog>
  </div>
</template>

<style scoped>
.dict-page {
  display: flex;
  gap: var(--y-content-padding);
  align-items: flex-start;
}

.dict-page__pane {
  flex: 1;
  min-width: 0;
}

.dict-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.dict-page__bar--split {
  justify-content: space-between;
  align-items: center;
}

.dict-page__current {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
</style>
