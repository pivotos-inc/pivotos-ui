<script setup lang="ts">
defineOptions({ name: 'MessageManage' });
import { computed, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElTableColumn } from 'element-plus';
import { Promotion } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { UserPicker } from '@pivotos/components';
import type { UserPickerPage, UserPickerQuery } from '@pivotos/components';
import type { MessageManageQuery, MessageManageVO, MessageSendRequest, TemplateVO } from '@pivotos/types';
import { sendMessage } from '@/api/message/manage';
import { listTemplates } from '@/api/message/template';
import { pageUsers } from '@/api/system/user';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<MessageManageVO, MessageManageQuery>({
  url: '/message/manage/page',
  query: { title: '', msgType: '', bizType: '' },
});

const MSG_TYPE_OPTIONS: YFormOption[] = [
  { label: '通知', value: 1 },
  { label: '公告', value: 2 },
  { label: '待办', value: 3 },
];

const MSG_TYPE_LABEL: Record<number, string> = { 1: '通知', 2: '公告', 3: '待办' };

const searchSchemas: YFormSchema[] = [
  { field: 'title', label: '标题', component: 'input', placeholder: '按标题模糊查询' },
  { field: 'msgType', label: '消息类型', component: 'select', placeholder: '全部', options: MSG_TYPE_OPTIONS },
  { field: 'bizType', label: '业务类型', component: 'input', placeholder: '如 flow.approval' },
];

const columns: YTableColumn<MessageManageVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'title', label: '标题', minWidth: 160 },
  { prop: 'msgType', label: '类型', width: 80, align: 'center', slot: 'msgType' },
  { prop: 'receiverCount', label: '接收人数', width: 90, align: 'center' },
  { prop: 'bizType', label: '业务类型', width: 120 },
  { prop: 'bizId', label: '业务ID', width: 120 },
  { prop: 'createTime', label: '发送时间', width: 170 },
];

// ---------- 发送 ----------
const sendVisible = ref(false);
const sendLoading = ref(false);
const sendFormRef = ref<InstanceType<typeof YForm>>();
const sendModel = reactive<Record<string, unknown>>({});
const templateOptions = ref<YFormOption[]>([]);

const sendSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'templateCode',
    label: '使用模板',
    component: 'select',
    placeholder: '不使用模板则手动填写标题内容',
    options: templateOptions.value,
  },
  {
    field: 'title',
    label: '标题',
    component: 'input',
    placeholder: '不使用模板时必填',
  },
  {
    field: 'content',
    label: '内容',
    component: 'textarea',
    placeholder: '不使用模板时必填',
  },
  { field: 'msgType', label: '消息类型', component: 'radio', options: MSG_TYPE_OPTIONS },
  {
    field: 'channel',
    label: '渠道',
    component: 'radio',
    options: [
      { label: '站内信', value: 'inbox' },
      { label: '短信', value: 'sms' },
      { label: '邮件', value: 'email' },
    ],
  },
  {
    field: 'receiverIds',
    label: '接收人',
    component: 'slot',
    rules: [{ required: true, type: 'array', min: 1, message: '请选择接收人', trigger: 'change' }],
  },
  { field: 'bizType', label: '业务类型', component: 'input', placeholder: '可选' },
  { field: 'bizId', label: '业务ID', component: 'input', placeholder: '可选' },
]);

async function openSend(): Promise<void> {
  Object.keys(sendModel).forEach((k) => delete sendModel[k]);
  Object.assign(sendModel, { msgType: 1, channel: 'inbox' });
  const page = await listTemplates();
  templateOptions.value = page.list.map((t: TemplateVO) => ({
    label: `${t.templateName}（${t.templateCode}）`,
    value: t.templateCode,
  }));
  sendVisible.value = true;
}

/** 接收人弹窗数据源：复用系统用户分页（方案 A，需 system:user:list 权限） */
async function fetchReceiverPage(q: UserPickerQuery): Promise<UserPickerPage> {
  const page = await pageUsers({ pageNum: q.pageNum, pageSize: q.pageSize, username: q.keyword || undefined });
  return {
    list: page.list.map((u) => ({ id: u.id, username: u.username, nickname: u.nickname })),
    total: page.total,
  };
}

async function handleSend(): Promise<void> {
  const valid = await sendFormRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  const receiverIds = (sendModel.receiverIds as string[] | undefined) ?? [];
  if (receiverIds.length === 0) {
    ElMessage.warning('请选择接收人');
    return;
  }
  if (!sendModel.templateCode && (!sendModel.title || !sendModel.content)) {
    ElMessage.warning('不使用模板时标题与内容必填');
    return;
  }
  sendLoading.value = true;
  try {
    const body: MessageSendRequest = {
      templateCode: (sendModel.templateCode as string) || undefined,
      title: sendModel.title as string | undefined,
      content: sendModel.content as string | undefined,
      msgType: sendModel.msgType as number | undefined,
      channel: sendModel.channel as string | undefined,
      bizType: (sendModel.bizType as string) || undefined,
      bizId: (sendModel.bizId as string) || undefined,
      receiverIds,
    };
    await sendMessage(body);
    ElMessage.success('发送成功');
    sendVisible.value = false;
    await load();
  } finally {
    sendLoading.value = false;
  }
}
</script>

<template>
  <div class="page-card">
    <div class="manage-page__bar">
      <ElButton v-hasPermi="'message:message:send'" type="primary" :icon="Promotion" @click="openSend">
        发送消息
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
        {{ MSG_TYPE_LABEL[(row as MessageManageVO).msgType ?? 1] }}
      </template>
      <ElTableColumn label="内容" min-width="220">
        <template #default="{ row }">
          <span class="manage-page__content">{{ (row as MessageManageVO).content }}</span>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="sendVisible"
      title="发送消息"
      width="560px"
      :confirm-loading="sendLoading"
      @confirm="handleSend"
    >
      <YForm ref="sendFormRef" v-model="sendModel" :schemas="sendSchemas" label-width="90px">
        <template #receiverIds="{ model }">
          <UserPicker
            :model-value="(model.receiverIds as string[] | undefined)"
            :fetch-page="fetchReceiverPage"
            placeholder="点击选择接收人"
            @update:model-value="(v: string[] | undefined) => (model.receiverIds = v)"
          />
        </template>
      </YForm>
    </YDialog>
  </div>
</template>

<style scoped>
.manage-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.manage-page__content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--el-text-color-secondary);
}
</style>
