<script setup lang="ts">
import { ref } from 'vue';
import {
  ElButton,
  ElDialog,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { WorkflowHisTaskVO, WorkflowTaskQuery } from '@pivotos/types';
import { taskHistory } from '@/api/workflow/task';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<WorkflowHisTaskVO, WorkflowTaskQuery>({
  url: '/workflow/task/completed/page',
  query: { flowName: '' },
});

const searchSchemas: YFormSchema[] = [
  { field: 'flowName', label: '流程名称', component: 'input', placeholder: '按名称模糊查询' },
];

const SKIP_TYPE_LABEL: Record<string, string> = {
  pass: '通过', reject: '驳回', transfer: '转办', depute: '委派', revoke: '撤回', termination: '终止',
};

const SKIP_TYPE_TAG: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  pass: 'success', reject: 'danger', transfer: 'warning', depute: 'warning', revoke: 'info', termination: 'danger',
};

const columns: YTableColumn<WorkflowHisTaskVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'nodeName', label: '审批节点', minWidth: 120 },
  { prop: 'skipType', label: '操作类型', width: 100, align: 'center', slot: 'skipType' },
  { prop: 'message', label: '审批意见', minWidth: 160, showOverflowTooltip: true },
  { prop: 'targetNodeName', label: '流转至', width: 120 },
  { prop: 'createTime', label: '处理时间', width: 170 },
];

// ---------- 审批历史弹窗 ----------
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyList = ref<WorkflowHisTaskVO[]>([]);

async function openHistory(row: WorkflowHisTaskVO): Promise<void> {
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
      <template #skipType="{ row }">
        <ElTag
          :type="SKIP_TYPE_TAG[(row as WorkflowHisTaskVO).skipType ?? ''] ?? 'info'"
          disable-transitions
        >
          {{ SKIP_TYPE_LABEL[(row as WorkflowHisTaskVO).skipType ?? ''] ?? (row as WorkflowHisTaskVO).skipType }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openHistory(row as WorkflowHisTaskVO)">
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
