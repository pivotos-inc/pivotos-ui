<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElTableColumn } from 'element-plus';
import { Moon, Plus, Sunny } from '@element-plus/icons-vue';
import { useDarkMode, YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import type { DictDataVO } from '@pivotos/types';
import { useI18n } from 'vue-i18n';

interface DemoUser {
  id: string;
  name: string;
  dept: string;
  status: string;
  createTime: string;
}

const { t } = useI18n();
const { mode, toggle } = useDarkMode();

// ---------- 模拟数据（S12 接入真实接口后替换为 useTablePage） ----------
const ALL_USERS: DemoUser[] = Array.from({ length: 46 }, (_, i) => ({
  id: String(1000 + i),
  name: `用户${i + 1}`,
  dept: ['研发部', '产品部', '运营部', '财务部'][i % 4],
  status: i % 5 === 0 ? '1' : '0',
  createTime: `2026-07-${String((i % 27) + 1).padStart(2, '0')}`,
}));

/** 状态字典（S12 起由 useDict('sys_normal_disable') 提供） */
const STATUS_DICT: DictDataVO[] = [
  { dictType: 'sys_normal_disable', dictLabel: '正常', dictValue: '0' },
  { dictType: 'sys_normal_disable', dictLabel: '停用', dictValue: '1' },
];

// ---------- 查询与分页 ----------
const query = reactive<Record<string, unknown>>({ name: '', status: undefined });
const pageNum = ref(1);
const pageSize = ref(10);
const loading = ref(false);

const filtered = computed(() =>
  ALL_USERS.filter(
    (u) =>
      (!query.name || u.name.includes(String(query.name))) &&
      (!query.status || u.status === query.status),
  ),
);
const rows = computed(() =>
  filtered.value.slice((pageNum.value - 1) * pageSize.value, pageNum.value * pageSize.value),
);

function simulateLoad(): void {
  loading.value = true;
  window.setTimeout(() => (loading.value = false), 200);
}

function handleSearch(): void {
  pageNum.value = 1;
  simulateLoad();
}

function handleReset(): void {
  query.name = '';
  query.status = undefined;
  pageNum.value = 1;
  simulateLoad();
}

// ---------- 表格 ----------
const columns: YTableColumn<DemoUser>[] = [
  { type: 'index', label: '#', width: 60, align: 'center' },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'dept', label: '部门', minWidth: 120 },
  { prop: 'status', label: '状态', width: 100, align: 'center', slot: 'status' },
  { prop: 'createTime', label: '创建时间', width: 140 },
  // 权限列内置演示：当前用户无 system:user:secret 权限，该列自动隐藏
  { prop: 'id', label: '内部编号（权限列）', perm: 'system:user:secret' },
];

const searchSchemas: YFormSchema[] = [
  { field: 'name', label: '姓名', component: 'input', placeholder: '按姓名模糊查询' },
  {
    field: 'status',
    label: '状态',
    component: 'select',
    placeholder: '全部',
    options: STATUS_DICT.map((d) => ({ label: d.dictLabel, value: d.dictValue })),
  },
];

// ---------- 新增弹窗 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({ name: '', dept: undefined, status: '0' });

const formSchemas: YFormSchema[] = [
  {
    field: 'name',
    label: '姓名',
    component: 'input',
    placeholder: '请输入姓名',
    rules: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
  },
  {
    field: 'dept',
    label: '部门',
    component: 'select',
    placeholder: '请选择部门',
    options: ['研发部', '产品部', '运营部', '财务部'].map((d) => ({ label: d, value: d })),
    rules: [{ required: true, message: '部门必选', trigger: 'change' }],
  },
  {
    field: 'status',
    label: '状态',
    component: 'radio',
    options: STATUS_DICT.map((d) => ({ label: d.dictLabel, value: d.dictValue })),
  },
];

function openDialog(): void {
  formModel.name = '';
  formModel.dept = undefined;
  formModel.status = '0';
  dialogVisible.value = true;
}

async function handleConfirm(): Promise<void> {
  const valid =
    (await formRef.value
      ?.validate()
      ?.then(() => true)
      .catch(() => false)) ?? false;
  if (!valid) return;
  confirmLoading.value = true;
  window.setTimeout(() => {
    confirmLoading.value = false;
    dialogVisible.value = false;
    ElMessage.success('（演示）新增成功，S12 接入真实接口');
  }, 300);
}
</script>

<template>
  <div class="page-card ytable-demo">
    <div class="ytable-demo__bar">
      <h2 class="ytable-demo__title">{{ t('demo.tableTitle') }}</h2>
      <div>
        <ElButton :icon="mode === 'dark' ? Sunny : Moon" circle @click="toggle" />
        <ElButton type="primary" :icon="Plus" @click="openDialog">新增用户</ElButton>
      </div>
    </div>

    <YSearchForm v-model="query" :schemas="searchSchemas" @search="handleSearch" @reset="handleReset" />

    <YTable
      v-model:page-num="pageNum"
      v-model:page-size="pageSize"
      :loading="loading"
      :data="rows"
      :columns="columns"
      :total="filtered.length"
      @refresh="simulateLoad"
    >
      <template #status="{ row }">
        <DictTag :value="(row as DemoUser).status" :options="STATUS_DICT" />
      </template>
      <ElTableColumn label="操作" width="140" align="center" fixed="right">
        <template #default>
          <ElButton link type="primary" @click="ElMessage.info('（演示）编辑')">编辑</ElButton>
          <ElButton link type="danger" @click="ElMessage.warning('（演示）删除')">删除</ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      title="新增用户"
      width="480px"
      :confirm-loading="confirmLoading"
      @confirm="handleConfirm"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="80px" />
    </YDialog>
  </div>
</template>

<style scoped>
.ytable-demo__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.ytable-demo__title {
  margin: 0;
  font-size: 16px;
}
</style>
