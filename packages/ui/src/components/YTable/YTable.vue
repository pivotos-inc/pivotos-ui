<script setup lang="ts" generic="T = Record<string, unknown>">
import { computed, h, ref, useSlots, watch } from 'vue';
import {
  ElAutoResizer,
  ElCheckbox,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTableV2,
} from 'element-plus';
import type { Column as TableV2Column } from 'element-plus';
import { hasPermi } from '@pivotos/core';
import type { YTableColumn } from './types';

/**
 * 单元格插槽出口。
 *
 * 用法纪律：不声明 defineSlots —— 普通模式下业务页还会以 `<slot :name="col.slot" v-bind="scope" />`
 * 的形态把 ElTable 的作用域透出去（scope 里的 column 是 ElTableColumn 实例），一旦把槽类型钉死成
 * 这里的结构，存量页面的 v-bind 就会整体类型报错。故走 useSlots() 松散取槽，合同写在注释里。
 */

interface Props {
  /** 加载态 */
  loading?: boolean;
  /** 当前页数据 */
  data: T[];
  /** 列定义 */
  columns: YTableColumn<T>[];
  /** 总条数（分页）。后端为防 JS 大数精度丢失将 total 序列化为 String，这里同时接受 number/string */
  total?: number | string;
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
  /** 行类名（字符串或 getter，用于错误行标红等场景；透传给 ElTable / ElTableV2） */
  rowClassName?: string | ((row: Record<string, unknown>, index: number) => string);
  /** 最大高度（普通模式透传 ElTable；虚拟模式下无效，改用 virtualHeight） */
  maxHeight?: string | number;
  /**
   * 开启虚拟滚动（ElTableV2 窗口渲染）。
   *
   * 用法纪律：
   * - 默认 false —— 保持既有 ElTable 行为，30+ 存量页面零影响；
   * - 开启后行高固定（itemSize），不支持树形数据 / 展开列 / 追加默认插槽列（append column）；
   * - selection / index / slot / formatter / 权限列 / total / 分页 / loading 契约保持一致。
   */
  virtual?: boolean;
  /** 虚拟滚动区高度（默认 400；数字按 px 处理） */
  virtualHeight?: number | string;
  /** 虚拟滚动行高（必须与实际行高接近，否则滚动条会有漂移） */
  itemSize?: number;
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
  rowClassName: undefined,
  maxHeight: undefined,
  virtual: false,
  virtualHeight: 400,
  itemSize: 44,
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

/** total 可能为后端下发的 String，ElPagination 需要 Number，统一收窄避免 prop 类型告警 */
const totalCount = computed(() => Number(props.total) || 0);

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

// ==================== 虚拟滚动（ElTableV2） ====================
/** 动态插槽出口：虚拟模式下用 cellRenderer 调同名插槽，保证 col.slot 契约与普通模式一致 */
const slots = useSlots();

/** 行 key：优先 rowKey 字段，缺失时退回行下标（索引列同样需要一个稳定 key） */
function rowKeyOf(row: Record<string, unknown>, index: number): string | number {
  const raw = props.rowKey ? row[props.rowKey] : undefined;
  if (raw === undefined || raw === null || raw === '') return index;
  return raw as string | number;
}

/** 是否存在 selection 列（虚拟模式下由本组件自制复选框列，保证 columns 契约不变） */
const hasSelection = computed(() => visibleColumns.value.some((col) => col.type === 'selection'));

/** 已选行 key 集合。ElTableV2 无内建多选列，这里自建多选状态并复用 selection-change 契约 */
const selectedKeys = ref<Set<string | number>>(new Set());

/** 数据整体换页后剔除已消失的行（不额外 emit，避免父组件 refresh 再来一次形成回环） */
watch(
  () => props.data,
  (rows) => {
    if (!hasSelection.value || selectedKeys.value.size === 0) return;
    const alive = new Set(rows.map((row, index) => rowKeyOf(row as Record<string, unknown>, index)));
    const next = new Set([...selectedKeys.value].filter((key) => alive.has(key)));
    if (next.size !== selectedKeys.value.size) {
      selectedKeys.value = next;
      // 这里必须补发一次：父组件拿到的是旧选中集合，不通知会导致「已选行已消失但计数不变」
      emitSelection();
    }
  },
);

function selectedRows(): T[] {
  return props.data.filter((row, index) =>
    selectedKeys.value.has(rowKeyOf(row as Record<string, unknown>, index)),
  );
}

function emitSelection(): void {
  emit('selection-change', selectedRows());
}

function isRowSelected(row: Record<string, unknown>, index: number): boolean {
  return selectedKeys.value.has(rowKeyOf(row, index));
}

function toggleRow(row: Record<string, unknown>, index: number, checked: boolean): void {
  const key = rowKeyOf(row, index);
  const next = new Set(selectedKeys.value);
  if (checked) next.add(key);
  else next.delete(key);
  selectedKeys.value = next;
  emitSelection();
}

const selectedAll = computed(
  () => props.data.length > 0 && selectedKeys.value.size >= props.data.length,
);
const selectedSome = computed(() => selectedKeys.value.size > 0 && !selectedAll.value);

function toggleAll(checked: boolean): void {
  selectedKeys.value = checked
    ? new Set(props.data.map((row, index) => rowKeyOf(row as Record<string, unknown>, index)))
    : new Set();
  emitSelection();
}

/** ElTableV2 需要数字宽度；未显式给宽度时按 160 兜底 */
function columnWidth(col: YTableColumn<T>): number {
  const raw = col.width ?? col.minWidth ?? 160;
  const num = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
  return Number.isFinite(num) && num > 0 ? num : 160;
}

/** 文本 cells：formatter 优先，空值统一 '--'（与 ElTable 的默认观感对齐） */
function cellText(
  col: YTableColumn<T>,
  rowData: Record<string, unknown>,
  rowIndex: number,
): string {
  const raw = col.prop ? rowData[col.prop] : undefined;
  if (col.formatter) {
    const formatted = col.formatter(rowData as T, { property: col.prop }, raw, rowIndex);
    return String(formatted ?? '');
  }
  if (raw === undefined || raw === null || raw === '') return '';
  return String(raw);
}

const virtualColumns = computed<TableV2Column[]>(() =>
  visibleColumns.value.map((col, columnIndex) => {
    const base: TableV2Column = {
      key: col.prop ?? col.type ?? `col-${columnIndex}`,
      dataKey: col.prop ?? '',
      title: col.label ?? '',
      width: columnWidth(col),
      align: col.align ?? 'left',
      // ElTableV2 的 fixed 只接受 true | 'left' | 'right'，布尔 false 须转成 undefined
      fixed: col.fixed === false ? undefined : (col.fixed ?? undefined) as TableV2Column['fixed'],
    };

    if (col.type === 'selection') {
      return {
        ...base,
        key: '__selection__',
        width: columnWidth(col),
        // 表头全选（含半选态），与 ElTable 的 header 复选框语义一致
        headerCellRenderer: () =>
          h(ElCheckbox, {
            modelValue: selectedAll.value,
            indeterminate: selectedSome.value,
            disabled: props.data.length === 0,
            // ElCheckbox 的 change 负载是 CheckboxValueType（boolean | string | number），
            // 这里用 unknown 接再收敛成 boolean，避免函数参数逆变导致的类型冲突
            onChange: (value: unknown) => toggleAll(value === true),
          }),
        cellRenderer: ({ rowData, rowIndex }) =>
          h(ElCheckbox, {
            modelValue: isRowSelected(rowData as Record<string, unknown>, rowIndex),
            onChange: (value: unknown) =>
              toggleRow(rowData as Record<string, unknown>, rowIndex, value === true),
          }),
      };
    }

    if (col.type === 'index') {
      return {
        ...base,
        key: '__index__',
        align: 'center',
        cellRenderer: ({ rowIndex }) => h('span', null, String(rowIndex + 1)),
      };
    }

    return {
      ...base,
      cellRenderer: ({ rowData, rowIndex }) => {
        const row = rowData as Record<string, unknown>;
        const renderer = col.slot ? slots[col.slot] : undefined;
        if (renderer) {
          return renderer({
            row,
            column: { property: col.prop },
            columnIndex,
            rowIndex,
            index: rowIndex,
            $index: rowIndex,
          }) as never;
        }
        const text = cellText(col, row, rowIndex);
        const overflow = col.showOverflowTooltip ?? true;
        return h(
          'span',
          { class: overflow ? 'y-table-v2__ellipsis' : undefined, title: overflow ? text : undefined },
          text,
        );
      },
    };
  }),
);

/** 虚拟区容器高度（数字按 px） */
const virtualStyle = computed(() => ({
  height: typeof props.virtualHeight === 'number' ? `${props.virtualHeight}px` : props.virtualHeight,
}));

/** 行类名：两种模式的入口形态不同（ElTable 给 { row, rowIndex }，ElTableV2 给 { rowData, rowIndex }），由此统一 */
function rowClassOf(row: Record<string, unknown>, index: number): string {
  if (typeof props.rowClassName === 'function') return props.rowClassName(row, index) ?? '';
  return props.rowClassName ?? '';
}

/** ElTable 的 row-class-name 负载是 { row, rowIndex } */
const elTableRowClass = (data: { row: Record<string, unknown>; rowIndex: number }): string =>
  rowClassOf(data.row ?? {}, data.rowIndex ?? 0);

/** ElTableV2 的 row-class 负载是 { rowData, rowIndex } */
const virtualRowClass = (params: { rowData: unknown; rowIndex: number }): string =>
  rowClassOf((params.rowData ?? {}) as Record<string, unknown>, params.rowIndex ?? 0);
</script>

<template>
  <div class="y-table">
    <!-- 虚拟滚动通道：opt-in，默认关闭，columns/total/分页/loading 契约与普通模式完全一致 -->
    <div v-if="virtual" v-loading="loading" class="y-table__virtual" :style="virtualStyle">
      <ElAutoResizer>
        <template #default="{ width, height }">
          <ElTableV2
            :columns="virtualColumns"
            :data="tableData"
            :width="width"
            :height="height"
            :row-height="itemSize"
            :estimated-row-height="itemSize"
            :row-key="rowKey ?? 'id'"
            :row-class="virtualRowClass"
          />
        </template>
      </ElAutoResizer>
      <div v-if="tableData.length === 0" class="y-table__virtual-empty">
        <slot name="empty">暂无数据</slot>
      </div>
    </div>

    <!-- 普通表格通道：既有行为一字未改 -->
    <ElTable
      v-else
      v-loading="loading"
      :data="tableData"
      :border="border"
      :stripe="stripe"
      :row-key="rowKey"
      :height="height"
      :max-height="maxHeight"
      :row-class-name="elTableRowClass"
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
        :total="totalCount"
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

/* 虚拟滚动容器：ElAutoResizer 需要一个有确定高度的父容器才能算出 height */
.y-table__virtual {
  position: relative;
  width: 100%;
}

.y-table__virtual :deep(.el-table-v2) {
  border: 1px solid var(--el-table-border-color, var(--el-border-color-lighter));
}

.y-table__virtual-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  pointer-events: none;
}

/* 单元格省略：ElTableV2 无 show-overflow-tooltip，降级为 CSS 省略 + 原生 title */
.y-table__virtual :deep(.y-table-v2__ellipsis) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
