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
  ElTableColumn,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { WorkflowHisTaskVO, WorkflowTaskQuery, WorkflowTaskVO } from '@pivotos/types';
import { passTask, rejectTask, transferTask, deputeTask, taskHistory } from '@/api/workflow/task';
import { useTablePage } from '@/hooks';

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
  const map: Record<string, string> = { pass: '审批通过', reject: '驳回', transfer: '转办', depute: '委派' };
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
  PASS: '通过', REJECT: '驳回', NONE: '无动作',
};

const SKIP_TYPE_TAG: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  PASS: 'success', REJECT: 'danger', NONE: 'info',
};

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
      <ElTableColumn label="操作" width="320" align="center" fixed="right">
        <template #default="{ row }">
          <template v-if="(row as WorkflowTaskVO).flowStatus === '1'">
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
