<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import type { TemplateQuery, TemplateSaveRequest, TemplateVO } from '@pivotos/types';
import { createTemplate, deleteTemplate, getTemplate, updateTemplate } from '@/api/message/template';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<TemplateVO, TemplateQuery>({
  url: '/message/template/page',
  query: { templateName: '', templateCode: '', status: '' },
});

const MSG_TYPE_OPTIONS: YFormOption[] = [
  { label: '通知', value: 1 },
  { label: '公告', value: 2 },
  { label: '待办', value: 3 },
];

const CHANNEL_OPTIONS: YFormOption[] = [
  { label: '站内信', value: 'inbox' },
  { label: '短信', value: 'sms' },
  { label: '邮件', value: 'email' },
];

const STATUS_OPTIONS: YFormOption[] = [
  { label: '正常', value: 0 },
  { label: '停用', value: 1 },
];

const MSG_TYPE_LABEL: Record<number, string> = { 1: '通知', 2: '公告', 3: '待办' };
const CHANNEL_LABEL: Record<string, string> = { inbox: '站内信', sms: '短信', email: '邮件' };

const searchSchemas: YFormSchema[] = [
  { field: 'templateName', label: '模板名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'templateCode', label: '模板编码', component: 'input', placeholder: '按编码模糊查询' },
  { field: 'status', label: '状态', component: 'select', placeholder: '全部', options: STATUS_OPTIONS },
];

const columns: YTableColumn<TemplateVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'templateName', label: '模板名称', minWidth: 140 },
  { prop: 'templateCode', label: '模板编码', minWidth: 150 },
  { prop: 'msgType', label: '消息类型', width: 90, align: 'center', slot: 'msgType' },
  { prop: 'channel', label: '默认渠道', width: 90, align: 'center', slot: 'channel' },
  { prop: 'status', label: '状态', width: 80, align: 'center', slot: 'status' },
  { prop: 'updateTime', label: '更新时间', width: 170 },
];

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);

const formSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'templateName',
    label: '模板名称',
    component: 'input',
    placeholder: '请输入模板名称',
    rules: [{ required: true, message: '模板名称不能为空', trigger: 'blur' }],
  },
  {
    field: 'templateCode',
    label: '模板编码',
    component: 'input',
    placeholder: '如 flow.approval.pass',
    props: { disabled: isEdit.value },
    rules: [{ required: true, message: '模板编码不能为空', trigger: 'blur' }],
  },
  {
    field: 'titleTpl',
    label: '标题模板',
    component: 'input',
    placeholder: '支持 {var} 占位符',
    rules: [{ required: true, message: '标题模板不能为空', trigger: 'blur' }],
  },
  {
    field: 'contentTpl',
    label: '内容模板',
    component: 'textarea',
    placeholder: '支持 {var} 占位符',
    rules: [{ required: true, message: '内容模板不能为空', trigger: 'blur' }],
  },
  { field: 'msgType', label: '消息类型', component: 'radio', options: MSG_TYPE_OPTIONS },
  { field: 'channel', label: '默认渠道', component: 'radio', options: CHANNEL_OPTIONS },
  { field: 'status', label: '状态', component: 'radio', options: STATUS_OPTIONS },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { msgType: 1, channel: 'inbox', status: 0 });
  dialogVisible.value = true;
}

async function openEdit(row: TemplateVO): Promise<void> {
  const detail = await getTemplate(row.id);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { ...detail });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: TemplateSaveRequest = {
      id: formModel.id as string | undefined,
      templateCode: formModel.templateCode as string,
      templateName: formModel.templateName as string,
      titleTpl: formModel.titleTpl as string,
      contentTpl: formModel.contentTpl as string,
      msgType: formModel.msgType as number | undefined,
      channel: formModel.channel as string | undefined,
      status: formModel.status as number | undefined,
      remark: formModel.remark as string | undefined,
    };
    if (isEdit.value) {
      await updateTemplate(body);
    } else {
      await createTemplate(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

async function handleDelete(row: TemplateVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除模板「${row.templateName}」吗？`, '提示', { type: 'warning' });
  await deleteTemplate(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="template-page__bar">
      <ElButton v-hasPermi="'message:template:add'" type="primary" :icon="Plus" @click="openAdd">
        新增模板
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
      <template #msgType="{ row }">
        {{ MSG_TYPE_LABEL[(row as TemplateVO).msgType ?? 1] }}
      </template>
      <template #channel="{ row }">
        {{ CHANNEL_LABEL[(row as TemplateVO).channel ?? 'inbox'] }}
      </template>
      <template #status="{ row }">
        <ElButton size="small" :type="(row as TemplateVO).status === 0 ? 'success' : 'info'" plain disabled>
          {{ (row as TemplateVO).status === 0 ? '正常' : '停用' }}
        </ElButton>
      </template>
      <ElTableColumn label="操作" width="140" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'message:template:edit'"
            link
            type="primary"
            @click="openEdit(row as TemplateVO)"
          >
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'message:template:remove'"
            link
            type="danger"
            @click="handleDelete(row as TemplateVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑模板' : '新增模板'"
      width="560px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="90px" />
    </YDialog>
  </div>
</template>

<style scoped>
.template-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
