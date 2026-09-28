<script setup lang="ts">
defineOptions({ name: 'WorkflowTaskPending' });
import { computed, reactive, ref } from 'vue';
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTableColumn,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import { UserSelect } from '@pivotos/components';
import type { UserSelectOption } from '@pivotos/components';
import type { WorkflowHisTaskVO, WorkflowTaskQuery, WorkflowTaskVO, WorkflowUserOption } from '@pivotos/types';
import { passTask, rejectTask, resubmitTask, transferTask, deputeTask, addSignatureTask, reductionSignatureTask, taskApprovers, taskHistory } from '@/api/workflow/task';
import { pageUsers } from '@/api/system/user';
import { useTablePage } from '@/hooks';
import ApprovalAdviceDrawer from './ApprovalAdviceDrawer.vue';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<WorkflowTaskVO, WorkflowTaskQuery>({
  url: '/workflow/task/pending/page',
  query: { flowName: '' },
});

const searchSchemas: YFormSchema[] = [
  { field: 'flowName', label: '流程名称', component: 'input', placeholder: '按名称模糊查询' },
];

const columns: YTableColumn<WorkflowTaskVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'flowName', label: '流程名称', minWidth: 160 },
  { prop: 'businessId', label: '业务ID', minWidth: 120 },
  { prop: 'nodeName', label: '当前节点', width: 120 },
  { prop: 'flowStatus', label: '状态', width: 100, align: 'center', slot: 'flowStatus' },
  { prop: 'createTime', label: '接收时间', width: 170 },
];

// ---------- 审批弹窗 ----------
const approveVisible = ref(false);
const approveLoading = ref(false);
const approveForm = reactive<{ taskId: string; action: string; message: string; targetUserId: string }>({
  taskId: '',
  action: '',
  message: '',
  targetUserId: '',
});

const approveTitle = computed(() => {
  // resubmit（W1/S113）：退回任务重新提交，复用同一弹窗收意见
  const map: Record<string, string> = { pass: '审批通过', reject: '驳回', transfer: '转办', depute: '委派', resubmit: '重新提交' };
  return map[approveForm.action] ?? '审批操作';
});

const showTargetUser = computed(() => ['transfer', 'depute'].includes(approveForm.action));

function openApprove(row: WorkflowTaskVO, action: string): void {
  approveForm.taskId = row.id;
  approveForm.action = action;
  approveForm.message = '';
  approveForm.targetUserId = '';
  approveVisible.value = true;
}

async function submitApprove(): Promise<void> {
  if (showTargetUser.value && !approveForm.targetUserId) {
    ElMessage.warning('请输入目标用户ID');
    return;
  }
  approveLoading.value = true;
  try {
    const cmd = { taskId: approveForm.taskId, message: approveForm.message, targetUserId: approveForm.targetUserId || undefined };
    switch (approveForm.action) {
      case 'pass': await passTask(cmd); break;
      case 'reject': await rejectTask(cmd); break;
      case 'resubmit': await resubmitTask(cmd); break;
      case 'transfer': await transferTask(cmd); break;
      case 'depute': await deputeTask(cmd); break;
    }
    ElMessage.success(`${approveTitle.value}操作成功`);
    approveVisible.value = false;
    await load();
  } finally {
    approveLoading.value = false;
  }
}

// ---------- 加签弹窗（S78 F2） ----------
const signVisible = ref(false);
const signLoading = ref(false);
const signForm = reactive<{ taskId: string; userIds: string[]; message: string }>({
  taskId: '',
  userIds: [],
  message: '',
});

/** 用户远程搜索（注入 UserSelect，按昵称模糊） */
async function fetchUserOptions(keyword: string): Promise<UserSelectOption[]> {
  const res = await pageUsers({ nickname: keyword || undefined, pageNum: 1, pageSize: 20 });
  return (res.list ?? []).map((u) => ({
    value: String(u.id),
    label: u.nickname ? `${u.nickname}（${u.username}）` : u.username,
  }));
}

function openSignature(row: WorkflowTaskVO): void {
  signForm.taskId = row.id;
  signForm.userIds = [];
  signForm.message = '';
  signVisible.value = true;
}

async function submitSignature(): Promise<void> {
  if (signForm.userIds.length === 0) {
    ElMessage.warning('请选择加签目标用户');
    return;
  }
  signLoading.value = true;
  try {
    await addSignatureTask({ taskId: signForm.taskId, userIds: signForm.userIds, message: signForm.message || undefined });
    ElMessage.success('加签成功，被加签人已收到待办通知');
    signVisible.value = false;
    await load();
  } finally {
    signLoading.value = false;
  }
}

// ---------- 减签弹窗（S82：候选 = 当前待办审批人，引擎护栏不足两人不可减签） ----------
const redVisible = ref(false);
const redLoading = ref(false);
const redForm = reactive<{ taskId: string; userIds: string[]; message: string }>({
  taskId: '',
  userIds: [],
  message: '',
});
const approverOptions = ref<WorkflowUserOption[]>([]);

async function openReduction(row: WorkflowTaskVO): Promise<void> {
  redForm.taskId = row.id;
  redForm.userIds = [];
  redForm.message = '';
  redVisible.value = true;
  approverOptions.value = await taskApprovers(row.id);
}

async function submitReduction(): Promise<void> {
  if (redForm.userIds.length === 0) {
    ElMessage.warning('请选择减签目标用户');
    return;
  }
  redLoading.value = true;
  try {
    await reductionSignatureTask({ taskId: redForm.taskId, userIds: redForm.userIds, message: redForm.message || undefined });
    ElMessage.success('减签成功');
    redVisible.value = false;
    await load();
  } finally {
    redLoading.value = false;
  }
}

// ---------- AI 审批建议抽屉（S101 A3 前端接入） ----------
const adviceVisible = ref(false);
const adviceTaskId = ref('');

function openAdvice(row: WorkflowTaskVO): void {
  adviceTaskId.value = row.id;
  adviceVisible.value = true;
}

// ---------- 审批历史弹窗 ----------
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyList = ref<WorkflowHisTaskVO[]>([]);

const FLOW_STATUS_LABEL: Record<string, string> = {
  '0': '待提交', '1': '待审批', '2': '已通过', '3': '自动完成', '4': '已终止',
  '5': '已作废', '6': '已撤销', '7': '已取回', '8': '已完成', '9': '已退回',
  '10': '已失效', '11': '已拿回', '12': '已重启', '13': '暂存',
};

const FLOW_STATUS_TAG: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  '0': 'info', '1': 'warning', '2': 'success', '3': 'success', '4': 'danger',
  '5': 'info', '6': 'info', '7': 'info', '8': 'success', '9': 'danger',
  '10': 'info', '11': 'info', '12': 'warning', '13': 'warning',
};

const SKIP_TYPE_LABEL: Record<string, string> = {
  PASS: '通过', REJECT: '驳回', NONE: '无动作', TRANSFER: '转办', DEPUTE: '委派',
  ADD_SIGNATURE: '加签', REDUCTION_SIGNATURE: '减签', COUNTERSIGN: '会签', VOTE: '票签',
  REVOKE: '撤回', TERMINATION: '终止',
};

const SKIP_TYPE_TAG: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  PASS: 'success', REJECT: 'danger', NONE: 'info', TRANSFER: 'warning', DEPUTE: 'warning',
  ADD_SIGNATURE: 'warning', REDUCTION_SIGNATURE: 'warning', COUNTERSIGN: 'primary', VOTE: 'primary',
  REVOKE: 'info', TERMINATION: 'danger',
};

/** 转办/委派/加签/减签/会签/票签留痕的 skipType 为 NONE，展示以 cooperateType 优先（2=转办、3=委派、4=会签、5=票签、6=加签、7=减签；S93 补转办/委派，S94 补会签/票签） */
function effSkipType(item: WorkflowHisTaskVO): string {
  if (item.cooperateType === 2) return 'TRANSFER';
  if (item.cooperateType === 3) return 'DEPUTE';
  if (item.cooperateType === 4) return 'COUNTERSIGN';
  if (item.cooperateType === 5) return 'VOTE';
  if (item.cooperateType === 6) return 'ADD_SIGNATURE';
  if (item.cooperateType === 7) return 'REDUCTION_SIGNATURE';
  return item.skipType ?? '';
}

async function openHistory(row: WorkflowTaskVO): Promise<void> {
  historyLoading.value = true;
  historyVisible.value = true;
  try {
    historyList.value = await taskHistory(row.instanceId);
  } finally {
    historyLoading.value = false;
  }
}
</script>

<template>
  <div class="page-card">
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
        <ElTag :type="FLOW_STATUS_TAG[(row as WorkflowTaskVO).flowStatus ?? ''] ?? 'info'" disable-transitions>
          {{ FLOW_STATUS_LABEL[(row as WorkflowTaskVO).flowStatus ?? ''] ?? (row as WorkflowTaskVO).flowStatus ?? '待审批' }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="460" align="center" fixed="right">
        <template #default="{ row }">
          <template v-if="(row as WorkflowTaskVO).flowStatus === '1'">
            <ElButton link type="primary" @click="openAdvice(row as WorkflowTaskVO)">
              AI 建议
            </ElButton>
            <ElButton v-hasPermi="'workflow:task:approve'" link type="success" @click="openApprove(row as WorkflowTaskVO, 'pass')">
              通过
            </ElButton>
            <ElButton v-hasPermi="'workflow:task:approve'" link type="danger" @click="openApprove(row as WorkflowTaskVO, 'reject')">
              驳回
            </ElButton>
            <ElButton v-hasPermi="'workflow:task:transfer'" link type="warning" @click="openApprove(row as WorkflowTaskVO, 'transfer')">
              转办
            </ElButton>
            <ElButton v-hasPermi="'workflow:task:depute'" link type="info" @click="openApprove(row as WorkflowTaskVO, 'depute')">
              委派
            </ElButton>
            <ElButton v-hasPermi="'workflow:task:add-signature'" link type="primary" @click="openSignature(row as WorkflowTaskVO)">
              加签
            </ElButton>
            <ElButton v-hasPermi="'workflow:task:add-signature'" link type="warning" @click="openReduction(row as WorkflowTaskVO)">
              减签
            </ElButton>
          </template>
          <!-- W1（S113）：退回态任务由发起人重新提交，不提供通过/驳回/加签/减签等审批动作 -->
          <template v-if="(row as WorkflowTaskVO).flowStatus === '9'">
            <ElButton
              v-hasPermi="'workflow:task:approve'"
              link
              type="warning"
              @click="openApprove(row as WorkflowTaskVO, 'resubmit')"
            >
              重新提交
            </ElButton>
          </template>
          <ElButton link type="primary" @click="openHistory(row as WorkflowTaskVO)">
            历史
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <!-- 审批操作弹窗 -->
    <ElDialog v-model="approveVisible" :title="approveTitle" width="480" destroy-on-close>
      <ElForm label-width="90">
        <ElFormItem v-if="showTargetUser" label="目标用户ID">
          <ElInput v-model="approveForm.targetUserId" placeholder="请输入目标用户ID" />
        </ElFormItem>
        <ElFormItem label="审批意见">
          <ElInput v-model="approveForm.message" type="textarea" :rows="3" placeholder="请输入意见（可选）" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="approveVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="approveLoading" @click="submitApprove">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 加签弹窗（S78 F2） -->
    <ElDialog v-model="signVisible" title="加签" width="480" destroy-on-close>
      <ElForm label-width="90">
        <ElFormItem label="加签用户">
          <UserSelect v-model="signForm.userIds" multiple :fetch-options="fetchUserOptions" placeholder="搜索并选择加签用户（可多选）" />
        </ElFormItem>
        <ElFormItem label="加签说明">
          <ElInput v-model="signForm.message" type="textarea" :rows="3" placeholder="请输入说明（可选）" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="signVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="signLoading" @click="submitSignature">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 减签弹窗（S82） -->
    <ElDialog v-model="redVisible" title="减签" width="480" destroy-on-close>
      <ElForm label-width="90">
        <ElFormItem label="减签用户">
          <ElSelect v-model="redForm.userIds" multiple placeholder="请选择要移除的审批人" style="width: 100%">
            <ElOption
              v-for="u in approverOptions"
              :key="u.id"
              :value="u.id"
              :label="u.nickname ? `${u.nickname}（${u.username ?? u.id}）` : (u.username ?? u.id)"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="减签说明">
          <ElInput v-model="redForm.message" type="textarea" :rows="3" placeholder="请输入说明（可选）" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="redVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="redLoading" @click="submitReduction">确定</ElButton>
      </template>
    </ElDialog>

    <!-- AI 审批建议抽屉（S101 A3） -->
    <ApprovalAdviceDrawer v-model="adviceVisible" :task-id="adviceTaskId" />

    <!-- 审批历史弹窗 -->
    <ElDialog v-model="historyVisible" title="审批历史" width="600" destroy-on-close>
      <div v-loading="historyLoading">
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
                :type="SKIP_TYPE_TAG[effSkipType(item as WorkflowHisTaskVO)] ?? 'info'"
                size="small"
                disable-transitions
                style="margin-left: 8px"
              >
                {{ SKIP_TYPE_LABEL[effSkipType(item as WorkflowHisTaskVO)] ?? (item as WorkflowHisTaskVO).skipType }}
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
