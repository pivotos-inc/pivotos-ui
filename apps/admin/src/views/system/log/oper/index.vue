<script setup lang="ts">
import { ref } from 'vue';
import { ElButton, ElDescriptions, ElDescriptionsItem, ElTableColumn, ElTag } from 'element-plus';
import { YDialog, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { OperLogQuery, OperLogVO } from '@pivotos/types';
import { useTablePage } from '@/hooks';

/** 查询表单额外的日期范围字段（下发前拆为 beginTime/endTime） */
interface OperLogParams extends OperLogQuery {
  timeRange?: [string, string] | '';
}

const { loading, rows, total, params, load, search, reset } = useTablePage<
  OperLogVO,
  OperLogParams
>({
  url: '/system/log/oper/page',
  query: { module: '', operType: '', operName: '', status: '', timeRange: '' },
});

const STATUS_OPTIONS = [
  { label: '成功', value: 0 },
  { label: '失败', value: 1 },
];

const OPER_TYPE_OPTIONS = [
  { label: '新增', value: '新增' },
  { label: '修改', value: '修改' },
  { label: '删除', value: '删除' },
  { label: '发布', value: '发布' },
  { label: '撤回', value: '撤回' },
  { label: '其他', value: '其他' },
];

const searchSchemas: YFormSchema[] = [
  { field: 'module', label: '功能模块', component: 'input', placeholder: '按模块模糊查询' },
  {
    field: 'operType',
    label: '操作类型',
    component: 'select',
    placeholder: '全部',
    options: OPER_TYPE_OPTIONS,
  },
  { field: 'operName', label: '操作人', component: 'input', placeholder: '按操作人模糊查询' },
  {
    field: 'status',
    label: '结果',
    component: 'select',
    placeholder: '全部',
    options: STATUS_OPTIONS,
  },
  { field: 'timeRange', label: '操作时间', component: 'daterange' },
];

const columns: YTableColumn<OperLogVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'module', label: '功能模块', minWidth: 110 },
  { prop: 'operType', label: '操作类型', width: 90, align: 'center' },
  { prop: 'operName', label: '操作人', width: 110 },
  { prop: 'requestUrl', label: '请求地址', minWidth: 180, showOverflowTooltip: true },
  { prop: 'status', label: '结果', width: 80, align: 'center', slot: 'status' },
  { prop: 'duration', label: '耗时(ms)', width: 90, align: 'right' },
  { prop: 'operTime', label: '操作时间', width: 170 },
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

// ---------- 详情 ----------
const detailVisible = ref(false);
const detail = ref<OperLogVO>();

function openDetail(row: OperLogVO): void {
  detail.value = row;
  detailVisible.value = true;
}
</script>

<template>
  <div class="page-card">
    <YSearchForm v-model="params" :schemas="searchSchemas" @search="onSearch" @reset="reset" />

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
      <template #status="{ row }">
        <ElTag :type="(row as OperLogVO).status === 0 ? 'success' : 'danger'" disable-transitions>
          {{ (row as OperLogVO).status === 0 ? '成功' : '失败' }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="80" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openDetail(row as OperLogVO)">详情</ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog v-model="detailVisible" title="操作日志详情" width="640px" :show-footer="false">
      <ElDescriptions v-if="detail" :column="2" border>
        <ElDescriptionsItem label="功能模块">{{ detail.module }}</ElDescriptionsItem>
        <ElDescriptionsItem label="操作类型">{{ detail.operType }}</ElDescriptionsItem>
        <ElDescriptionsItem label="操作人">{{ detail.operName || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="操作时间">{{ detail.operTime }}</ElDescriptionsItem>
        <ElDescriptionsItem label="请求方式">{{ detail.requestMethod || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="耗时">{{ detail.duration ?? '-' }} ms</ElDescriptionsItem>
        <ElDescriptionsItem label="请求地址" :span="2">
          {{ detail.requestUrl || '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="调用方法" :span="2">{{ detail.method || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="入参摘要" :span="2">
          <pre class="oper-log__params">{{ detail.requestParams || '-' }}</pre>
        </ElDescriptionsItem>
        <ElDescriptionsItem v-if="detail.status === 1" label="异常信息" :span="2">
          {{ detail.errorMsg || '-' }}
        </ElDescriptionsItem>
      </ElDescriptions>
    </YDialog>
  </div>
</template>

<style scoped>
.oper-log__params {
  margin: 0;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
}
</style>
