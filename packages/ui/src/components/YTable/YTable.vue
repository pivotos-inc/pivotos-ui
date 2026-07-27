<script setup lang="ts" generic="T = Record<string, unknown>">
import { computed } from 'vue';
import { ElPagination, ElTable, ElTableColumn } from 'element-plus';
import { hasPermi } from '@pivotos/core';
import type { YTableColumn } from './types';

interface Props {
  /** 加载态 */
  loading?: boolean;
  /** 当前页数据 */
  data: T[];
  /** 列定义 */
  columns: YTableColumn<T>[];
  /** 总条数（分页） */
  total?: number;
  /** 当前页码（v-model:pageNum） */
  pageNum?: number;
  /** 每页条数（v-model:pageSize） */
  pageSize?: number;
  /** 每页条数可选值 */
  pageSizes?: number[];
  /** 隐藏分页（树表/全量列表场景） */
  hidePagination?: boolean;
  border?: boolean;
  stripe?: boolean;
  rowKey?: string;
  height?: string | number;
  /** 树形表格默认展开全部 */
  defaultExpandAll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  total: 0,
  pageNum: 1,
  pageSize: 10,
  pageSizes: () => [10, 20, 50, 100],
  hidePagination: false,
  border: true,
  stripe: true,
  rowKey: undefined,
  height: undefined,
  defaultExpandAll: false,
});

const emit = defineEmits<{
  'update:pageNum': [value: number];
  'update:pageSize': [value: number];
  /** 页码或页大小变化后触发，业务侧在此重新加载数据 */
  refresh: [];
  'selection-change': [rows: T[]];
}>();

/** 权限列内置：无权限的列直接剔除 */
const visibleColumns = computed(() =>
  props.columns.filter((col) => !col.perm || hasPermi(col.perm)),
);

/** ElTable 的 DefaultRow 约束较窄，这里做一次显式收窄 */
const tableData = computed(() => props.data as Record<string, unknown>[]);

function handleSizeChange(size: number): void {
  emit('update:pageSize', size);
  emit('refresh');
}

function handleCurrentChange(page: number): void {
  emit('update:pageNum', page);
  emit('refresh');
}

function handleSelectionChange(rows: Record<string, unknown>[]): void {
  emit('selection-change', rows as T[]);
}
</script>

<template>
  <div class="y-table">
    <ElTable
      v-loading="loading"
      :data="tableData"
      :border="border"
      :stripe="stripe"
      :row-key="rowKey"
      :height="height"
      :default-expand-all="defaultExpandAll"
      @selection-change="handleSelectionChange"
    >
      <ElTableColumn
        v-for="col in visibleColumns"
        :key="col.prop ?? col.type ?? col.label"
        :prop="col.prop"
        :label="col.label"
        :type="col.type"
        :width="col.width"
        :min-width="col.minWidth"
        :align="col.align ?? 'left'"
        :fixed="col.fixed"
        :show-overflow-tooltip="col.showOverflowTooltip ?? true"
        :formatter="col.formatter"
      >
        <template v-if="col.slot" #default="scope">
          <slot :name="col.slot" v-bind="scope" />
        </template>
      </ElTableColumn>
      <!-- 追加列（如操作列），直接放置 ElTableColumn 即可 -->
      <slot />
      <template #empty>
        <slot name="empty">暂无数据</slot>
      </template>
    </ElTable>
    <div v-if="!hidePagination" class="y-table__pagination">
      <ElPagination
        :current-page="pageNum"
        :page-size="pageSize"
        :total="total"
        :page-sizes="pageSizes"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<style scoped>
.y-table__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
