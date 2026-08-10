<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import type { PostQuery, PostSaveRequest, PostVO } from '@pivotos/types';
import { createPost, deletePost, getPost, listPosts, updatePost } from '@/api/system/post';
import { useDict } from '@/hooks';

const { sys_common_status } = useDict('sys_common_status');

// ---------- 列表 ----------
const loading = ref(false);
const rows = ref<PostVO[]>([]);
const params = reactive<PostQuery>({ postCode: '', postName: '', status: undefined });

async function load(): Promise<void> {
  loading.value = true;
  try {
    const p: PostQuery = {};
    if (params.postCode) p.postCode = params.postCode;
    if (params.postName) p.postName = params.postName;
    if (params.status !== undefined && params.status !== '') p.status = params.status;
    rows.value = (await listPosts(p)) ?? [];
  } finally {
    loading.value = false;
  }
}

function search(): void {
  void load();
}

function reset(): void {
  params.postCode = '';
  params.postName = '';
  params.status = undefined;
  void load();
}

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'postCode', label: '岗位编码', component: 'input', placeholder: '按编码模糊查询' },
  { field: 'postName', label: '岗位名称', component: 'input', placeholder: '按名称模糊查询' },
  {
    field: 'status',
    label: '状态',
    component: 'select',
    placeholder: '全部',
    options: statusOptions.value,
  },
]);

const columns: YTableColumn<PostVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'postCode', label: '岗位编码', minWidth: 120 },
  { prop: 'postName', label: '岗位名称', minWidth: 140 },
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

const formSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'postCode',
    label: '岗位编码',
    component: 'input',
    placeholder: '请输入岗位编码',
    props: { disabled: isEdit.value },
    rules: [
      { required: true, message: '岗位编码不能为空', trigger: 'blur' },
      { max: 64, message: '岗位编码长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  {
    field: 'postName',
    label: '岗位名称',
    component: 'input',
    placeholder: '请输入岗位名称',
    rules: [
      { required: true, message: '岗位名称不能为空', trigger: 'blur' },
      { max: 64, message: '岗位名称长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  {
    field: 'sort',
    label: '排序',
    component: 'number',
    placeholder: '数字越小越靠前',
    props: { min: 0, style: { width: '100%' } },
  },
  { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
  { field: 'remark', label: '备注', component: 'textarea', props: { maxlength: 500 } },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { status: 0, sort: 0 });
  dialogVisible.value = true;
}

async function openEdit(row: PostVO): Promise<void> {
  const detail = await getPost(String(row.id));
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    id: detail.id,
    postCode: detail.postCode,
    postName: detail.postName,
    sort: detail.sort ?? 0,
    status: detail.status ?? 0,
    remark: detail.remark,
  });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: PostSaveRequest = {
      id: formModel.id as string | undefined,
      postCode: formModel.postCode as string,
      postName: formModel.postName as string,
      sort: formModel.sort as number | undefined,
      status: formModel.status as number | undefined,
      remark: formModel.remark as string | undefined,
    };
    if (isEdit.value) {
      await updatePost(body);
    } else {
      await createPost(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

// ---------- 删除 ----------
async function handleDelete(row: PostVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除岗位「${row.postName}」吗？`, '提示', { type: 'warning' });
  await deletePost(String(row.id));
  ElMessage.success('删除成功');
  await load();
}

onMounted(load);
</script>

<template>
  <div class="page-card post-page">
    <YSearchForm v-model="params" :schemas="searchSchemas" @search="search" @reset="reset" />

    <div class="post-page__bar">
      <ElButton v-hasPermi="'system:post:add'" type="primary" :icon="Plus" @click="openAdd">
        新增岗位
      </ElButton>
    </div>

    <YTable :loading="loading" :data="rows" :columns="columns" row-key="id" @refresh="load">
      <template #status="{ row }">
        <DictTag :value="(row as PostVO).status" :options="sys_common_status" />
      </template>
      <ElTableColumn label="操作" width="220" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'system:post:edit'"
            link
            type="primary"
            @click="openEdit(row as PostVO)"
          >
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:post:remove'"
            link
            type="danger"
            @click="handleDelete(row as PostVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑岗位' : '新增岗位'"
      width="520px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="90px" />
    </YDialog>
  </div>
</template>

<style scoped>
.post-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
