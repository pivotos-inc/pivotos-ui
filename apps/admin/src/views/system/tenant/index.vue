<script setup lang="ts">
defineOptions({ name: 'SystemTenant' });
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { MagicStick, Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import type { TenantPackageVO, TenantQuery, TenantSaveRequest, TenantVO } from '@pivotos/types';
import { createTenant, deleteTenant, getTenant, updateTenant } from '@/api/system/tenant';
import { listTenantPackages } from '@/api/system/tenantPackage';
import { useDict, useTablePage } from '@/hooks';
import TenantWizardDialog from './TenantWizardDialog.vue';

const { sys_common_status } = useDict('sys_common_status');

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<TenantVO, TenantQuery>({
  url: '/system/tenant/page',
  query: { tenantCode: '', tenantName: '', status: '' },
});

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

// 套餐下拉（正常状态；编辑回显时若租户绑了停用套餐，详情里的 packageId 可能不在选项内，照常显示 ID）
const packageRows = ref<TenantPackageVO[]>([]);
const packageOptions = computed<YFormOption[]>(() =>
  packageRows.value.map((p) => ({ label: p.packageName, value: p.id })),
);

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'tenantCode', label: '租户编码', component: 'input', placeholder: '按编码模糊查询' },
  { field: 'tenantName', label: '租户名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'status', label: '状态', component: 'select', placeholder: '全部', options: statusOptions.value },
]);

const columns: YTableColumn<TenantVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'tenantCode', label: '租户编码', minWidth: 110 },
  { prop: 'tenantName', label: '租户名称', minWidth: 130 },
  { prop: 'packageName', label: '套餐', minWidth: 110, slot: 'package' },
  { prop: 'accountCount', label: '账号数', width: 100, align: 'center', slot: 'account' },
  { prop: 'expireTime', label: '过期时间', width: 165, slot: 'expire' },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'status' },
  { prop: 'createTime', label: '创建时间', width: 165 },
];

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);

const formSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'tenantCode',
    label: '租户编码',
    component: 'input',
    placeholder: '请输入租户编码',
    props: { disabled: isEdit.value },
    rules: [
      { required: true, message: '租户编码不能为空', trigger: 'blur' },
      { max: 64, message: '租户编码长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  {
    field: 'tenantName',
    label: '租户名称',
    component: 'input',
    placeholder: '请输入租户名称',
    rules: [
      { required: true, message: '租户名称不能为空', trigger: 'blur' },
      { max: 64, message: '租户名称长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  {
    field: 'packageId',
    label: '租户套餐',
    component: 'select',
    placeholder: '平台代管（不限制）',
    options: packageOptions.value,
  },
  {
    field: 'accountLimit',
    label: '账号数上限',
    component: 'number',
    placeholder: '0 = 不限',
    props: { min: 0, style: { width: '100%' } },
  },
  {
    field: 'expireTime',
    label: '过期时间',
    component: 'date',
    placeholder: '留空 = 永不过期',
    props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', style: { width: '100%' } },
  },
  { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
  { field: 'remark', label: '备注', component: 'textarea', props: { maxlength: 500 } },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { status: 0, accountLimit: 0 });
  dialogVisible.value = true;
}

async function openEdit(row: TenantVO): Promise<void> {
  const detail = await getTenant(String(row.id));
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    id: detail.id,
    tenantCode: detail.tenantCode,
    tenantName: detail.tenantName,
    packageId: detail.packageId ?? undefined,
    accountLimit: detail.accountLimit ?? 0,
    expireTime: detail.expireTime ?? undefined,
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
    const body: TenantSaveRequest = {
      id: formModel.id as string | undefined,
      tenantCode: formModel.tenantCode as string,
      tenantName: formModel.tenantName as string,
      packageId: (formModel.packageId as string) || undefined,
      accountLimit: (formModel.accountLimit as number) ?? 0,
      expireTime: (formModel.expireTime as string) || undefined,
      status: formModel.status as number | undefined,
      remark: formModel.remark as string | undefined,
    };
    if (isEdit.value) {
      await updateTenant(body);
    } else {
      await createTenant(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

// ---------- 删除 ----------
async function handleDelete(row: TenantVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除租户「${row.tenantName}」吗？`, '提示', { type: 'warning' });
  await deleteTenant(String(row.id));
  ElMessage.success('删除成功');
  await load();
}

// ---------- 初始化向导 ----------
const wizardVisible = ref(false);

onMounted(async () => {
  packageRows.value = (await listTenantPackages({ status: 0 })) ?? [];
});
</script>

<template>
  <div class="page-card tenant-page">
    <YSearchForm v-model="params" :schemas="searchSchemas" @search="search" @reset="reset" />

    <div class="tenant-page__bar">
      <ElButton v-hasPermi="'system:tenant:add'" type="primary" :icon="Plus" @click="openAdd">
        新增租户
      </ElButton>
      <ElButton
        v-hasPermi="'system:tenant:init'"
        type="success"
        :icon="MagicStick"
        @click="wizardVisible = true"
      >
        初始化向导
      </ElButton>
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
      <template #package="{ row }">
        <span v-if="(row as TenantVO).packageName">{{ (row as TenantVO).packageName }}</span>
        <span v-else class="tenant-page__muted">平台代管</span>
      </template>
      <template #account="{ row }">
        {{ (row as TenantVO).accountCount ?? 0 }} /
        {{ (row as TenantVO).accountLimit ? (row as TenantVO).accountLimit : '不限' }}
      </template>
      <template #expire="{ row }">
        <span v-if="(row as TenantVO).expireTime">{{ (row as TenantVO).expireTime }}</span>
        <span v-else class="tenant-page__muted">永不过期</span>
      </template>
      <template #status="{ row }">
        <DictTag :value="(row as TenantVO).status" :options="sys_common_status" />
      </template>
      <ElTableColumn label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'system:tenant:edit'"
            link
            type="primary"
            @click="openEdit(row as TenantVO)"
          >
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:tenant:remove'"
            link
            type="danger"
            @click="handleDelete(row as TenantVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑租户' : '新增租户'"
      width="560px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="100px" />
    </YDialog>

    <TenantWizardDialog v-model="wizardVisible" :packages="packageRows" @success="load" />
  </div>
</template>

<style scoped>
.tenant-page__bar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.tenant-page__muted {
  color: var(--el-text-color-secondary);
}
</style>
