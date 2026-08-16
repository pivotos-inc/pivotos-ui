<script setup lang="ts">
defineOptions({ name: 'WorkflowInstance' });
import { reactive, ref } from 'vue';
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import { UserSelect } from '@pivotos/components';
import type { UserSelectOption } from '@pivotos/components';
import type { FlowDefinitionVO, WorkflowHisTaskVO, WorkflowInstanceQuery, WorkflowInstanceVO } from '@pivotos/types';
import { revokeInstance, terminateInstance, urgeInstance, startInstance } from '@/api/workflow/instance';
import { pageDefinitions } from '@/api/workflow/definition';
import { taskHistory } from '@/api/workflow/task';
import { pageUsers } from '@/api/system/user';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<WorkflowInstanceVO, WorkflowInstanceQuery>({
  url: '/workflow/instance/page',
  query: { flowName: '' },
});

const searchSchemas: YFormSchema[] = [
  { field: 'flowName', label: '流程名称', component: 'input', placeholder: '按名称模糊查询' },
];

const FLOW_STATUS_TAG: Record<string, { label: string; type: 'info' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  '0': { label: '待提交', type: 'info' },
  '1': { label: '审批中', type: 'primary' },
  '2': { label: '已通过', type: 'success' },
  '3': { label: '自动完成', type: 'success' },
  '4': { label: '已终止', type: 'danger' },
  '5': { label: '已作废', type: 'info' },
  '6': { label: '已撤销', type: 'info' },
  '7': { label: '已取回', type: 'info' },
  '8': { label: '已完成', type: 'success' },
  '9': { label: '已退回', type: 'danger' },
  '10': { label: '已失效', type: 'info' },
  '11': { label: '已拿回', type: 'info' },
  '12': { label: '已重启', type: 'warning' },
  '13': { label: '暂存', type: 'warning' },
};

const columns: YTableColumn<WorkflowInstanceVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'flowName', label: '流程名称', minWidth: 160 },
  { prop: 'businessId', label: '业务ID', minWidth: 120 },
  { prop: 'nodeName', label: '当前节点', width: 120 },
  { prop: 'flowStatus', label: '状态', width: 100, align: 'center', slot: 'flowStatus' },
  { prop: 'createTime', label: '发起时间', width: 170 },
];

async function handleRevoke(row: WorkflowInstanceVO): Promise<void> {
  await ElMessageBox.confirm(`确定撤回流程「${row.flowName}」吗？`, '提示', { type: 'warning' });
  await revokeInstance(row.id);
  ElMessage.success('撤回成功');
  await load();
}

async function handleTerminate(row: WorkflowInstanceVO): Promise<void> {
  await ElMessageBox.confirm(`确定终止流程「${row.flowName}」吗？此操作不可逆。`, '提示', { type: 'warning' });
  await terminateInstance(row.id);
  ElMessage.success('终止成功');
  await load();
}

// ---------- 催办（S77 F2） ----------
const urgedIds = ref<Set<string>>(new Set());

async function handleUrge(row: WorkflowInstanceVO): Promise<void> {
  await urgeInstance(row.id);
  urgedIds.value.add(row.id);
  ElMessage.success('催办已发送，审批人将收到站内信');
}

// ---------- 发起流程弹窗（S78 F3：补齐发起入口，含发起时抄送） ----------
const startVisible = ref(false);
const startLoading = ref(false);
const defsLoading = ref(false);
const startableDefs = ref<FlowDefinitionVO[]>([]);
const startForm = reactive<{ flowCode: string; businessName: string; ccUserIds: string[] }>({
  flowCode: '',
  businessName: '',
  ccUserIds: [],
});

async function openStart(): Promise<void> {
  startForm.flowCode = '';
  startForm.businessName = '';
  startForm.ccUserIds = [];
  startVisible.value = true;
  defsLoading.value = true;
  try {
    // 仅已发布 + 激活的定义可发起（客户端过滤 activityStatus）
    const res = await pageDefinitions({ isPublish: 1, pageNum: 1, pageSize: 100 });
    startableDefs.value = (res.list ?? []).filter((d) => d.activityStatus === 1);
  } finally {
    defsLoading.value = false;
  }
}

/** 用户远程搜索（注入 UserSelect，抄送人选择） */
async function fetchUserOptions(keyword: string): Promise<UserSelectOption[]> {
  const res = await pageUsers({ nickname: keyword || undefined, pageNum: 1, pageSize: 20 });
  return (res.list ?? []).map((u) => ({
    value: String(u.id),
    label: u.nickname ? `${u.nickname}（${u.username}）` : u.username,
  }));
}

async function submitStart(): Promise<void> {
  if (!startForm.flowCode) {
    ElMessage.warning('请选择要发起的流程');
    return;
  }
  startLoading.value = true;
  try {
    await startInstance({
      flowCode: startForm.flowCode,
      businessName: startForm.businessName || undefined,
      ccUserIds: startForm.ccUserIds.length > 0 ? startForm.ccUserIds : undefined,
    });
    ElMessage.success(startForm.ccUserIds.length > 0 ? '流程发起成功，抄送人已收到通知' : '流程发起成功');
    startVisible.value = false;
    await load();
  } finally {
    startLoading.value = false;
  }
}

// ---------- 审批历史弹窗 ----------
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyList = ref<WorkflowHisTaskVO[]>([]);
/** 当前查看历史的实例（对话框头部展示当前节点/状态，S77 F3） */
const historyRow = ref<WorkflowInstanceVO | null>(null);

const SKIP_TYPE_LABEL: Record<string, string> = {
  PASS: '通过', REJECT: '驳回', NONE: '无动作',
};

const SKIP_TYPE_TAG: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  PASS: 'success', REJECT: 'danger', NONE: 'info',
};

async function openHistory(row: WorkflowInstanceVO): Promise<void> {
  historyRow.value = row;
  historyLoading.value = true;
  historyVisible.value = true;
  try {
    historyList.value = await taskHistory(row.id);
  } finally {
    historyLoading.value = false;
  }
}

/** 判断是否可撤回/终止（flowStatus=0 或 1 表示流程仍在进行中） */
function canOperate(row: WorkflowInstanceVO): boolean {
  const s = row.flowStatus;
  return s === '0' || s === '1';
}
</script>

<template>
  <div class="page-card">
    <div class="started-page__bar">
      <ElButton v-hasPermi="'workflow:instance:start'" type="primary" :icon="Plus" @click="openStart">
        发起流程
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
      <template #flowStatus="{ row }">
        <ElTag
          :type="FLOW_STATUS_TAG[(row as WorkflowInstanceVO).flowStatus ?? '']?.type ?? 'info'"
          disable-transitions
        >
          {{ FLOW_STATUS_TAG[(row as WorkflowInstanceVO).flowStatus ?? '']?.label ?? (row as WorkflowInstanceVO).flowStatus }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="280" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="canOperate(row as WorkflowInstanceVO)"
            v-hasPermi="'workflow:instance:list'"
            link
            type="primary"
            :disabled="urgedIds.has((row as WorkflowInstanceVO).id)"
            @click="handleUrge(row as WorkflowInstanceVO)"
          >
            {{ urgedIds.has((row as WorkflowInstanceVO).id) ? '已催办' : '催办' }}
          </ElButton>
          <ElButton
            v-if="canOperate(row as WorkflowInstanceVO)"
            v-hasPermi="'workflow:instance:revoke'"
            link
            type="warning"
            @click="handleRevoke(row as WorkflowInstanceVO)"
          >
            撤回
          </ElButton>
          <ElButton
            v-if="canOperate(row as WorkflowInstanceVO)"
            v-hasPermi="'workflow:instance:terminate'"
            link
            type="danger"
            @click="handleTerminate(row as WorkflowInstanceVO)"
          >
            终止
          </ElButton>
          <ElButton link type="primary" @click="openHistory(row as WorkflowInstanceVO)">
            历史
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <!-- 发起流程弹窗（S78 F3） -->
    <ElDialog v-model="startVisible" title="发起流程" width="520" destroy-on-close>
      <ElForm label-width="90">
        <ElFormItem label="选择流程">
          <ElSelect v-model="startForm.flowCode" :loading="defsLoading" placeholder="请选择已发布的流程" style="width: 100%">
            <ElOption v-for="d in startableDefs" :key="d.id" :label="d.flowName" :value="d.flowCode" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="业务名称">
          <ElInput v-model="startForm.businessName" placeholder="如：张三的请假单（可选）" />
        </ElFormItem>
        <ElFormItem label="抄送给">
          <UserSelect v-model="startForm.ccUserIds" multiple :fetch-options="fetchUserOptions" placeholder="搜索并选择抄送人（可多选，可选）" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="startVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="startLoading" @click="submitStart">发起</ElButton>
      </template>
    </ElDialog>

    <!-- 审批历史弹窗 -->
    <ElDialog v-model="historyVisible" title="审批历史" width="600" destroy-on-close>
      <div v-loading="historyLoading">
        <div v-if="historyRow" style="margin-bottom: 12px; color: #606266; font-size: 13px">
          流程「{{ historyRow.flowName }}」 当前节点：{{ historyRow.nodeName ?? '-' }}
          <ElTag
            :type="FLOW_STATUS_TAG[historyRow.flowStatus ?? '']?.type ?? 'info'"
            size="small"
            disable-transitions
            style="margin-left: 8px"
          >
            {{ FLOW_STATUS_TAG[historyRow.flowStatus ?? '']?.label ?? historyRow.flowStatus }}
          </ElTag>
        </div>
        <ElTimeline v-if="historyList.length > 0">
          <ElTimelineItem
            v-for="item in historyList"
            :key="item.id"
            :timestamp="item.createTime"
            placement="top"
          >
            <div>
              <strong>{{ item.nodeName }}</strong>
              <ElTag
                :type="SKIP_TYPE_TAG[item.skipType ?? ''] ?? 'info'"
                size="small"
                disable-transitions
                style="margin-left: 8px"
              >
                {{ SKIP_TYPE_LABEL[item.skipType ?? ''] ?? item.skipType }}
              </ElTag>
            </div>
            <div style="color: #909399; font-size: 13px; margin-top: 4px">
              审批人: {{ item.approver ?? '-' }}
              <span v-if="item.message" style="margin-left: 12px">意见: {{ item.message }}</span>
            </div>
          </ElTimelineItem>
        </ElTimeline>
        <div v-else style="text-align: center; color: #909399; padding: 24px">暂无审批记录</div>
      </div>
    </ElDialog>
  </div>
</template>

<style scoped>
.started-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
