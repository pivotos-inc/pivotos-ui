<script setup lang="ts">
import { ref } from 'vue';
import {
  ElButton,
  ElDialog,
  ElMessage,
  ElMessageBox,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { WorkflowHisTaskVO, WorkflowInstanceQuery, WorkflowInstanceVO } from '@pivotos/types';
import { revokeInstance, terminateInstance } from '@/api/workflow/instance';
import { taskHistory } from '@/api/workflow/task';
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
  '0': { label: '待审批', type: 'warning' },
  '1': { label: '审批中', type: 'primary' },
  '2': { label: '已完成', type: 'success' },
  '3': { label: '已驳回', type: 'danger' },
  '4': { label: '已撤回', type: 'info' },
  '5': { label: '已终止', type: 'danger' },
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

// ---------- 审批历史弹窗 ----------
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyList = ref<WorkflowHisTaskVO[]>([]);

const SKIP_TYPE_LABEL: Record<string, string> = {
  pass: '通过', reject: '驳回', transfer: '转办', depute: '委派', revoke: '撤回', termination: '终止',
};

const SKIP_TYPE_TAG: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  pass: 'success', reject: 'danger', transfer: 'warning', depute: 'warning', revoke: 'info', termination: 'danger',
};

async function openHistory(row: WorkflowInstanceVO): Promise<void> {
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
      <ElTableColumn label="操作" width="220" align="center" fixed="right">
        <template #default="{ row }">
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
