<script setup lang="ts">
defineOptions({ name: 'SystemLogLogin' });
import { ElTag } from 'element-plus';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { LoginLogQuery, LoginLogVO } from '@pivotos/types';
import { useTablePage } from '@/hooks';

/** 查询表单额外的日期范围字段（下发前拆为 beginTime/endTime） */
interface LoginLogParams extends LoginLogQuery {
  timeRange?: [string, string] | '';
}

const { loading, rows, total, params, load, search, reset } = useTablePage<
  LoginLogVO,
  LoginLogParams
>({
  url: '/system/log/login/page',
  query: { username: '', ip: '', status: '', timeRange: '' },
});

const STATUS_OPTIONS = [
  { label: '成功', value: 0 },
  { label: '失败', value: 1 },
];

const searchSchemas: YFormSchema[] = [
  { field: 'username', label: '登录账号', component: 'input', placeholder: '按账号模糊查询' },
  { field: 'ip', label: '登录IP', component: 'input', placeholder: '按IP模糊查询' },
  {
    field: 'status',
    label: '结果',
    component: 'select',
    placeholder: '全部',
    options: STATUS_OPTIONS,
  },
  { field: 'timeRange', label: '登录时间', component: 'daterange' },
];

const columns: YTableColumn<LoginLogVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'username', label: '登录账号', minWidth: 120 },
  { prop: 'ip', label: '登录IP', minWidth: 130 },
  { prop: 'userAgent', label: '浏览器 UA', minWidth: 220, showOverflowTooltip: true },
  { prop: 'status', label: '结果', width: 90, align: 'center', slot: 'status' },
  { prop: 'msg', label: '提示消息', minWidth: 150 },
  { prop: 'loginTime', label: '登录时间', width: 170 },
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
        <ElTag :type="(row as LoginLogVO).status === 0 ? 'success' : 'danger'" disable-transitions>
          {{ (row as LoginLogVO).status === 0 ? '成功' : '失败' }}
        </ElTag>
      </template>
    </YTable>
  </div>
</template>
