<script setup lang="ts">
defineOptions({ name: 'ToolJobLog' });
import { computed, onMounted, ref } from 'vue';
import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElMessage,
  ElMessageBox,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import { YDialog, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { JobLogQuery, JobLogVO } from '@pivotos/types';
import { useTablePage } from '@/hooks';
import { triggerJob } from '@/api/system/jobLog';
import { getJobHandlers } from '@/api/system/job';

/** 查询表单额外的日期范围字段（下发前拆为 beginTime/endTime） */
interface JobLogParams extends JobLogQuery {
  timeRange?: [string, string] | '';
}

const { loading, rows, total, params, load, search, reset } = useTablePage<
  JobLogVO,
  JobLogParams
>({
  url: '/system/joblog/page',
  query: { jobHandler: '', status: '', timeRange: '' },
});

/** 已注册的 Handler 列表（onMounted 时从后端动态获取） */
const handlerOptions = ref<{ label: string; value: string }[]>([]);
const handlerMap = computed(() => {
  const map: Record<string, string> = {};
  handlerOptions.value.forEach((h) => { map[h.value] = h.label; });
  return map;
});

onMounted(async () => {
  try {
    const handlers = await getJobHandlers();
    handlerOptions.value = handlers.map((h) => ({ label: h.displayName, value: h.handler }));
  } catch {
    handlerOptions.value = [];
  }
});

const STATUS_OPTIONS = [
  { label: '成功', value: 0 },
  { label: '失败', value: 1 },
];

const searchSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'jobHandler',
    label: '任务',
    component: 'select',
    placeholder: '全部',
    options: handlerOptions.value,
  },
  { field: 'status', label: '结果', component: 'select', placeholder: '全部', options: STATUS_OPTIONS },
  { field: 'timeRange', label: '执行时间', component: 'daterange' },
]);

const columns: YTableColumn<JobLogVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'jobHandler', label: '任务', minWidth: 140, slot: 'jobHandler' },
  { prop: 'status', label: '结果', width: 80, align: 'center', slot: 'status' },
  { prop: 'duration', label: '耗时(ms)', width: 100, align: 'right' },
  { prop: 'executeTime', label: '执行时间', width: 170 },
];

/** daterange → beginTime/endTime（含当天全天） */
function applyTimeRange(): void {
  const range = params.timeRange;
  if (Array.isArray(range) && range.length === 2) {
    params.beginTime = `${range[0]}T00:00:00`;
    params.endTime = `${range[1]}T23:59:59`;
  } else {
    delete params.beginTime;
    delete params.endTime;
  }
}

function onSearch(): void {
  applyTimeRange();
  void search();
}

// ---------- 手动触发 ----------
const triggering = ref('');

async function handleTrigger(handler: string, label: string): Promise<void> {
  await ElMessageBox.confirm(`确定手动执行「${label}」吗？任务将同步执行，可能耗时较长。`, '手动触发', {
    confirmButtonText: '执行',
    type: 'warning',
  });
  triggering.value = handler;
  try {
    const msg = await triggerJob(handler);
    ElMessage.success(msg || '执行成功');
    await load();
  } finally {
    triggering.value = '';
  }
}

// ---------- 详情 ----------
const detailVisible = ref(false);
const detail = ref<JobLogVO>();

function openDetail(row: JobLogVO): void {
  detail.value = row;
  detailVisible.value = true;
}
</script>

<template>
  <div class="page-card">
    <YSearchForm v-model="params" :schemas="searchSchemas" @search="onSearch" @reset="reset" />

    <div class="job-trigger-bar">
      <span class="job-trigger-bar__tip">手动触发：</span>
      <ElButton
        v-for="h in handlerOptions"
        :key="h.value"
        size="small"
        type="primary"
        plain
        :loading="triggering === h.value"
        @click="handleTrigger(h.value, h.label)"
      >
        {{ h.label }}
      </ElButton>
    </div>

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
      <template #jobHandler="{ row }">
        {{ handlerMap[(row as JobLogVO).jobHandler] ?? (row as JobLogVO).jobHandler }}
      </template>
      <template #status="{ row }">
        <ElTag :type="(row as JobLogVO).status === 0 ? 'success' : 'danger'" disable-transitions>
          {{ (row as JobLogVO).status === 0 ? '成功' : '失败' }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="80" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openDetail(row as JobLogVO)">详情</ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog v-model="detailVisible" title="执行记录详情" width="560px" :show-footer="false">
      <ElDescriptions v-if="detail" :column="1" border>
        <ElDescriptionsItem label="任务 Handler">{{ detail.jobHandler }}</ElDescriptionsItem>
        <ElDescriptionsItem label="结果">
          <ElTag :type="detail.status === 0 ? 'success' : 'danger'" disable-transitions>
            {{ detail.status === 0 ? '成功' : '失败' }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="耗时">{{ detail.duration ?? '-' }} ms</ElDescriptionsItem>
        <ElDescriptionsItem label="执行时间">{{ detail.executeTime || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem v-if="detail.status === 1" label="异常信息">
          {{ detail.errorMsg || '-' }}
        </ElDescriptionsItem>
      </ElDescriptions>
    </YDialog>
  </div>
</template>

<style scoped>
.page-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 12px;
}

.job-trigger-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.job-trigger-bar__tip {
  color: #909399;
  font-size: 13px;
}
</style>
