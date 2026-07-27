<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import type { DeptQuery, DeptSaveRequest, DeptVO } from '@pivotos/types';
import { createDept, deleteDept, getDept, treeDepts, updateDept } from '@/api/system/dept';
import { useDict } from '@/hooks';

const { sys_common_status } = useDict('sys_common_status');

// ---------- 树形列表（不分页） ----------
const loading = ref(false);
const tree = ref<DeptVO[]>([]);
const query = reactive<DeptQuery>({ deptName: '', status: '' });

async function load(): Promise<void> {
  loading.value = true;
  try {
    tree.value = await treeDepts(query);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function reset(): void {
  query.deptName = '';
  query.status = '';
  void load();
}

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'deptName', label: '部门名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'status', label: '状态', component: 'select', placeholder: '全部', options: statusOptions.value },
]);

const columns: YTableColumn<DeptVO>[] = [
  { prop: 'deptName', label: '部门名称', minWidth: 220 },
  { prop: 'sort', label: '排序', width: 80, align: 'center' },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'status' },
  { prop: 'createTime', label: '创建时间', width: 170 },
];

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);

/** 上级部门选项：根部门 + 拍平的部门树 */
const parentOptions = computed<YFormOption[]>(() => {
  const result: YFormOption[] = [{ label: '根部门', value: '0' }];
  const walk = (nodes: DeptVO[], depth: number): void => {
    nodes.forEach((n) => {
      if (n.id !== formModel.id) {
        result.push({ label: `${'　'.repeat(depth)}${n.deptName}`, value: n.id });
      }
      if (n.children) walk(n.children, depth + 1);
    });
  };
  walk(tree.value, 0);
  return result;
});

const formSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'parentId',
    label: '上级部门',
    component: 'select',
    options: parentOptions.value,
    rules: [{ required: true, message: '上级部门必选', trigger: 'change' }],
  },
  {
    field: 'deptName',
    label: '部门名称',
    component: 'input',
    placeholder: '请输入部门名称',
    rules: [{ required: true, message: '部门名称不能为空', trigger: 'blur' }],
  },
  { field: 'sort', label: '显示顺序', component: 'number', props: { min: 0 } },
  { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
]);

function openAdd(parent?: DeptVO): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { parentId: parent?.id ?? '0', sort: 0, status: 0 });
  dialogVisible.value = true;
}

async function openEdit(row: DeptVO): Promise<void> {
  const detail = await getDept(row.id);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    id: detail.id,
    parentId: detail.parentId,
    deptName: detail.deptName,
    sort: detail.sort ?? 0,
    status: detail.status ?? 0,
  });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: DeptSaveRequest = {
      id: formModel.id as string | undefined,
      parentId: formModel.parentId as string,
      deptName: formModel.deptName as string,
      sort: formModel.sort as number | undefined,
      status: formModel.status as number | undefined,
    };
    if (isEdit.value) {
      await updateDept(body);
    } else {
      await createDept(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

async function handleDelete(row: DeptVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除部门「${row.deptName}」吗？`, '提示', { type: 'warning' });
  await deleteDept(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="dept-page__bar">
      <ElButton v-hasPermi="'system:dept:add'" type="primary" :icon="Plus" @click="openAdd()">
        新增部门
      </ElButton>
    </div>

    <YSearchForm v-model="query" :schemas="searchSchemas" @search="load" @reset="reset" />

    <YTable
      :loading="loading"
      :data="tree"
      :columns="columns"
      hide-pagination
      default-expand-all
      row-key="id"
      @refresh="load"
    >
      <template #status="{ row }">
        <DictTag :value="(row as DeptVO).status" :options="sys_common_status" />
      </template>
      <ElTableColumn label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'system:dept:add'"
            link
            type="primary"
            @click="openAdd(row as DeptVO)"
          >
            新增
          </ElButton>
          <ElButton v-hasPermi="'system:dept:edit'" link type="primary" @click="openEdit(row as DeptVO)">
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:dept:remove'"
            link
            type="danger"
            @click="handleDelete(row as DeptVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑部门' : '新增部门'"
      width="480px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="90px" />
    </YDialog>
  </div>
</template>

<style scoped>
.dept-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
