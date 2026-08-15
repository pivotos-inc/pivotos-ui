<script setup lang="ts">
defineOptions({ name: 'WorkflowCc' });
import { ref } from 'vue';
import {
  ElButton,
  ElDialog,
  ElMessage,
  ElTableColumn,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { WorkflowCcQuery, WorkflowCcVO, WorkflowHisTaskVO } from '@pivotos/types';
import { readCc } from '@/api/workflow/cc';
import { taskHistory } from '@/api/workflow/task';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<WorkflowCcVO, WorkflowCcQuery>({
  url: '/workflow/cc/page',
  query: { flowName: '', readFlag: '' },
});

const READ_OPTIONS = [
  { label: '未读', value: 0 },
  { label: '已读', value: 1 },
];

const searchSchemas: YFormSchema[] = [
  { field: 'flowName', label: '流程名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'readFlag', label: '阅读状态', component: 'select', placeholder: '全部', options: READ_OPTIONS },
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

const columns: YTableColumn<WorkflowCcVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'flowName', label: '流程名称', minWidth: 160 },
  { prop: 'creatorName', label: '发起人', width: 120 },
  { prop: 'flowStatus', label: '流程状态', width: 100, align: 'center', slot: 'flowStatus' },
  { prop: 'nodeName', label: '当前节点', width: 120 },
  { prop: 'readFlag', label: '阅读状态', width: 90, align: 'center', slot: 'readFlag' },
  { prop: 'createTime', label: '抄送时间', width: 170 },
];

async function handleRead(row: WorkflowCcVO): Promise<void> {
  await readCc(row.id);
  ElMessage.success('已标记为已读');
  await load();
}

// ---------- 审批历史弹窗（复用 task/history 口径） ----------
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyList = ref<WorkflowHisTaskVO[]>([]);
const historyRow = ref<WorkflowCcVO | null>(null);

const SKIP_TYPE_LABEL: Record<string, string> = {
  PASS: '通过', REJECT: '驳回', NONE: '无动作',
};

const SKIP_TYPE_TAG: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  PASS: 'success', REJECT: 'danger', NONE: 'info',
};

async function openHistory(row: WorkflowCcVO): Promise<void> {
  historyRow.value = row;
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
        <ElTag
          :type="FLOW_STATUS_TAG[(row as WorkflowCcVO).flowStatus ?? '']?.type ?? 'info'"
          disable-transitions
        >
          {{ FLOW_STATUS_TAG[(row as WorkflowCcVO).flowStatus ?? '']?.label ?? (row as WorkflowCcVO).flowStatus ?? '-' }}
        </ElTag>
      </template>
      <template #readFlag="{ row }">
        <ElTag :type="(row as WorkflowCcVO).readFlag === 1 ? 'info' : 'danger'" disable-transitions>
          {{ (row as WorkflowCcVO).readFlag === 1 ? '已读' : '未读' }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="(row as WorkflowCcVO).readFlag !== 1"
            v-hasPermi="'workflow:cc:list'"
            link
            type="primary"
            @click="handleRead(row as WorkflowCcVO)"
          >
            标记已读
          </ElButton>
          <ElButton link type="primary" @click="openHistory(row as WorkflowCcVO)">
            进度
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <!-- 审批历史弹窗 -->
    <ElDialog v-model="historyVisible" title="审批进度" width="600" destroy-on-close>
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
