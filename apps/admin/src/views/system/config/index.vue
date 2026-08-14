<script setup lang="ts">
defineOptions({ name: 'ToolConfig' });
import { computed, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import type { ConfigQuery, ConfigSaveRequest, ConfigVO } from '@pivotos/types';
import { createConfig, deleteConfig, getConfig, updateConfig } from '@/api/system/config';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<ConfigVO, ConfigQuery>({
  url: '/system/config/page',
  query: { configName: '', configKey: '', configType: '' },
});

const CONFIG_TYPE_OPTIONS: YFormOption[] = [
  { label: '系统内置', value: 'Y' },
  { label: '自定义', value: 'N' },
];

const searchSchemas: YFormSchema[] = [
  { field: 'configName', label: '参数名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'configKey', label: '参数键名', component: 'input', placeholder: '按键名模糊查询' },
  {
    field: 'configType',
    label: '内置标记',
    component: 'select',
    placeholder: '全部',
    options: CONFIG_TYPE_OPTIONS,
  },
];

const columns: YTableColumn<ConfigVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'configName', label: '参数名称', minWidth: 140 },
  { prop: 'configKey', label: '参数键名', minWidth: 180 },
  { prop: 'configValue', label: '参数键值', minWidth: 140 },
  { prop: 'configType', label: '内置', width: 90, align: 'center', slot: 'configType' },
  { prop: 'remark', label: '备注', minWidth: 160 },
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
    field: 'configName',
    label: '参数名称',
    component: 'input',
    placeholder: '请输入参数名称',
    rules: [{ required: true, message: '参数名称不能为空', trigger: 'blur' }],
  },
  {
    field: 'configKey',
    label: '参数键名',
    component: 'input',
    placeholder: '如 sys.user.initPassword',
    props: { disabled: isEdit.value },
    rules: [{ required: true, message: '参数键名不能为空', trigger: 'blur' }],
  },
  {
    field: 'configValue',
    label: '参数键值',
    component: 'input',
    placeholder: '请输入参数键值',
    rules: [{ required: true, message: '参数键值不能为空', trigger: 'blur' }],
  },
  {
    field: 'configType',
    label: '内置标记',
    component: 'radio',
    options: CONFIG_TYPE_OPTIONS,
  },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { configType: 'N' });
  dialogVisible.value = true;
}

async function openEdit(row: ConfigVO): Promise<void> {
  const detail = await getConfig(row.id);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { ...detail });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: ConfigSaveRequest = {
      id: formModel.id as string | undefined,
      configName: formModel.configName as string,
      configKey: formModel.configKey as string,
      configValue: formModel.configValue as string,
      configType: formModel.configType as string | undefined,
      remark: formModel.remark as string | undefined,
    };
    if (isEdit.value) {
      await updateConfig(body);
    } else {
      await createConfig(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

async function handleDelete(row: ConfigVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除参数「${row.configName}」吗？`, '提示', { type: 'warning' });
  await deleteConfig(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="config-page__bar">
      <ElButton v-hasPermi="'system:config:add'" type="primary" :icon="Plus" @click="openAdd">
        新增参数
      </ElButton>
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
      <template #configType="{ row }">
        <ElButton
          size="small"
          :type="(row as ConfigVO).configType === 'Y' ? 'success' : 'info'"
          plain
          disabled
        >
          {{ (row as ConfigVO).configType === 'Y' ? '内置' : '自定义' }}
        </ElButton>
      </template>
      <ElTableColumn label="操作" width="140" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'system:config:edit'"
            link
            type="primary"
            @click="openEdit(row as ConfigVO)"
          >
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:config:remove'"
            link
            type="danger"
            @click="handleDelete(row as ConfigVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑参数' : '新增参数'"
      width="480px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="90px" />
    </YDialog>
  </div>
</template>

<style scoped>
.config-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
