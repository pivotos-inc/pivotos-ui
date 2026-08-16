<script setup lang="ts">
defineOptions({ name: 'SystemJob' });
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ElButton,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { CronPicker } from '@pivotos/components';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import type { JobHandlerVO, JobQuery, JobSaveRequest, JobVO } from '@pivotos/types';
import { useTablePage } from '@/hooks';
import {
  changeJobStatus,
  createJob,
  deleteJob,
  getJob,
  getJobHandlers,
  getNextTriggerTime,
  triggerJobById,
  updateJob,
} from '@/api/system/job';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<
  JobVO,
  JobQuery
>({
  url: '/system/job/page',
  query: { jobName: '', triggerStatus: '' },
});

const STATUS_OPTIONS: YFormOption[] = [
  { label: '运行中', value: 1 },
  { label: '暂停', value: 0 },
];

const searchSchemas: YFormSchema[] = [
  { field: 'jobName', label: '任务名', component: 'input', placeholder: '按任务名模糊查询' },
  {
    field: 'triggerStatus',
    label: '状态',
    component: 'select',
    placeholder: '全部',
    options: STATUS_OPTIONS,
  },
];

function scheduleLabel(row: JobVO): string {
  if (row.scheduleType === 'CRON') return row.scheduleConf ?? '-';
  if (row.scheduleType === 'FIX_RATE') return `每 ${row.scheduleConf ?? 0} 秒`;
  return '不调度';
}

function formatTimestamp(ts?: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const columns: YTableColumn<JobVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'jobName', label: '任务名', minWidth: 140 },
  { prop: 'jobHandler', label: 'Handler', width: 180 },
  { prop: 'scheduleConf', label: '调度', minWidth: 160, slot: 'schedule' },
  { prop: 'triggerStatus', label: '状态', width: 100, align: 'center', slot: 'status' },
  { prop: 'triggerNextTime', label: '下次执行', width: 170, slot: 'nextTime' },
  { prop: 'updateTime', label: '更新时间', width: 170 },
];

// ---------- Handler 下拉 ----------
const handlerOptions = ref<YFormOption[]>([]);

onMounted(async () => {
  try {
    const handlers: JobHandlerVO[] = await getJobHandlers();
    handlerOptions.value = handlers.map((h) => ({ label: h.displayName, value: h.handler }));
  } catch {
    handlerOptions.value = [];
  }
});

// ---------- 选项常量 ----------
const SCHEDULE_TYPE_OPTIONS: YFormOption[] = [
  { label: 'Cron 表达式', value: 'CRON' },
  { label: '固定速率', value: 'FIX_RATE' },
  { label: '不调度', value: 'NONE' },
];

const MISFIRE_OPTIONS: YFormOption[] = [
  { label: '立即执行一次', value: 'FIRE_ONCE_NOW' },
  { label: '忽略', value: 'DO_NOTHING' },
];

const ROUTE_OPTIONS: YFormOption[] = [
  { label: '第一个', value: 'FIRST' },
  { label: '最后一个', value: 'LAST' },
  { label: '轮询', value: 'ROUND' },
  { label: '随机', value: 'RANDOM' },
  { label: '一致性 HASH', value: 'CONSISTENT_HASH' },
  { label: '最少使用', value: 'LEAST_FREQUENTLY_USED' },
  { label: '最久未使用', value: 'LEAST_RECENTLY_USED' },
  { label: '故障转移', value: 'FAILOVER' },
  { label: '忙碌转移', value: 'BUSYOVER' },
  { label: '分片广播', value: 'SHARDING_BROADCAST' },
];

const BLOCK_OPTIONS: YFormOption[] = [
  { label: '单机串行', value: 'SERIAL_EXECUTION' },
  { label: '丢弃后续', value: 'DISCARD_LATER' },
  { label: '覆盖之前', value: 'COVER_EARLY' },
];

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);
const nextTimes = ref<string[]>([]);

const formSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'jobName',
    label: '任务名',
    component: 'input',
    placeholder: '请输入任务名称',
    rules: [{ required: true, message: '任务名称不能为空', trigger: 'blur' }],
  },
  {
    field: 'jobHandler',
    label: 'Handler',
    component: 'select',
    placeholder: '选择或输入 Handler 名',
    options: handlerOptions.value,
    emptyOption: false,
    props: { filterable: true, allowCreate: true },
    rules: [{ required: true, message: 'Handler 不能为空', trigger: 'change' }],
  },
  {
    field: 'scheduleType',
    label: '调度类型',
    component: 'radio',
    options: SCHEDULE_TYPE_OPTIONS,
    rules: [{ required: true, message: '调度类型不能为空', trigger: 'change' }],
  },
  { field: 'scheduleConf', label: '调度配置', component: 'slot' },
  { field: 'executorParam', label: '任务参数', component: 'input', placeholder: '可选' },
  {
    field: 'misfireStrategy',
    label: '过期策略',
    component: 'select',
    options: MISFIRE_OPTIONS,
    emptyOption: false,
  },
  {
    field: 'executorRouteStrategy',
    label: '路由策略',
    component: 'select',
    options: ROUTE_OPTIONS,
    emptyOption: false,
  },
  {
    field: 'executorBlockStrategy',
    label: '阻塞策略',
    component: 'select',
    options: BLOCK_OPTIONS,
    emptyOption: false,
  },
  {
    field: 'executorTimeout',
    label: '超时秒数',
    component: 'number',
    props: { min: 0, controlsPosition: 'right' },
    placeholder: '0=不限',
  },
  {
    field: 'executorFailRetryCount',
    label: '失败重试',
    component: 'number',
    props: { min: 0, controlsPosition: 'right' },
    placeholder: '0=不重试',
  },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    scheduleType: 'CRON',
    scheduleConf: '0 * * * * ?',
    misfireStrategy: 'FIRE_ONCE_NOW',
    executorRouteStrategy: 'ROUND',
    executorBlockStrategy: 'SERIAL_EXECUTION',
    executorTimeout: 0,
    executorFailRetryCount: 0,
  });
  nextTimes.value = [];
  dialogVisible.value = true;
}

async function openEdit(row: JobVO): Promise<void> {
  const detail = await getJob(row.id);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { ...detail });
  nextTimes.value = [];
  dialogVisible.value = true;
  void loadNextTimes();
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: JobSaveRequest = {
      id: formModel.id as string | undefined,
      jobHandler: formModel.jobHandler as string,
      jobName: formModel.jobName as string,
      scheduleType: formModel.scheduleType as string,
      scheduleConf: formModel.scheduleConf as string | undefined,
      executorParam: formModel.executorParam as string | undefined,
      misfireStrategy: formModel.misfireStrategy as string | undefined,
      executorRouteStrategy: formModel.executorRouteStrategy as string | undefined,
      executorBlockStrategy: formModel.executorBlockStrategy as string | undefined,
      executorTimeout: formModel.executorTimeout as number | undefined,
      executorFailRetryCount: formModel.executorFailRetryCount as number | undefined,
    };
    if (isEdit.value) {
      await updateJob(body);
    } else {
      await createJob(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

// ---------- 调度预览 ----------
async function loadNextTimes(): Promise<void> {
  const st = formModel.scheduleType as string;
  const sc = formModel.scheduleConf as string;
  if (!st || st === 'NONE' || !sc) {
    nextTimes.value = [];
    return;
  }
  try {
    nextTimes.value = await getNextTriggerTime(st, sc);
  } catch {
    nextTimes.value = [];
  }
}

// ---------- 启停 / 触发 / 删除 ----------
async function handleToggleStatus(row: JobVO): Promise<void> {
  const newStatus = row.triggerStatus === 1 ? 0 : 1;
  await ElMessageBox.confirm(
    `确定${newStatus === 1 ? '启动' : '暂停'}「${row.jobName}」吗？`,
    '提示',
    { type: 'warning' },
  );
  await changeJobStatus(row.id, newStatus);
  ElMessage.success(newStatus === 1 ? '已启动' : '已暂停');
  await load();
}

async function handleTrigger(row: JobVO): Promise<void> {
  await ElMessageBox.confirm(`确定手动触发「${row.jobName}」吗？`, '提示', {
    type: 'warning',
  });
  await triggerJobById(row.id);
  ElMessage.success('触发成功');
  await load();
}

async function handleDelete(row: JobVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除「${row.jobName}」吗？`, '提示', { type: 'warning' });
  await deleteJob(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="job-page__bar">
      <ElButton v-hasPermi="'system:job:add'" type="primary" :icon="Plus" @click="openAdd">
        新增任务
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
      <template #schedule="{ row }">
        {{ scheduleLabel(row as JobVO) }}
      </template>
      <template #status="{ row }">
        <ElTag
          :type="(row as JobVO).triggerStatus === 1 ? 'success' : 'info'"
          disable-transitions
        >
          {{ (row as JobVO).triggerStatus === 1 ? '运行中' : '暂停' }}
        </ElTag>
      </template>
      <template #nextTime="{ row }">
        {{ formatTimestamp((row as JobVO).triggerNextTime) }}
      </template>
      <ElTableColumn label="操作" width="230" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'system:job:edit'"
            link
            type="primary"
            @click="openEdit(row as JobVO)"
          >
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:job:changeStatus'"
            link
            :type="(row as JobVO).triggerStatus === 1 ? 'warning' : 'success'"
            @click="handleToggleStatus(row as JobVO)"
          >
            {{ (row as JobVO).triggerStatus === 1 ? '暂停' : '启动' }}
          </ElButton>
          <ElButton
            v-hasPermi="'system:job:trigger'"
            link
            type="primary"
            @click="handleTrigger(row as JobVO)"
          >
            触发
          </ElButton>
          <ElButton
            v-hasPermi="'system:job:remove'"
            link
            type="danger"
            @click="handleDelete(row as JobVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑任务' : '新增任务'"
      width="720px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="100px">
        <template #scheduleConf="{ model }">
          <CronPicker
            v-if="model.scheduleType === 'CRON'"
            :model-value="(model.scheduleConf as string) || ''"
            @update:model-value="(v: string) => { model.scheduleConf = v; void loadNextTimes(); }"
          />
          <ElInputNumber
            v-else-if="model.scheduleType === 'FIX_RATE'"
            :model-value="Number(model.scheduleConf) || 1"
            :min="1"
            controls-position="right"
            style="width: 200px"
            @update:model-value="(v: number | undefined) => { model.scheduleConf = String(v ?? 1); void loadNextTimes(); }"
          />
          <span v-else style="color: #909399; font-size: 13px">不调度</span>
        </template>
      </YForm>

      <!-- 调度预览 -->
      <div v-if="nextTimes.length > 0" class="job-next-times">
        <span class="job-next-times__label">最近执行时间：</span>
        <span v-for="(t, i) in nextTimes" :key="i" class="job-next-times__item">{{ t }}</span>
      </div>
    </YDialog>
  </div>
</template>

<style scoped>
.job-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.job-next-times {
  margin-top: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
}

.job-next-times__label {
  color: #909399;
}

.job-next-times__item {
  margin-right: 12px;
  color: #606266;
}
</style>
