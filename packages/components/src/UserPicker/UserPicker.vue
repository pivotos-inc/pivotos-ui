<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ElButton, ElInput, ElPagination, ElTable, ElTableColumn, ElTag } from 'element-plus';
import type { TableInstance } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { YDialog } from '@pivotos/ui';
import type { UserPickerPage, UserPickerQuery, UserPickerUser } from './types';

interface Props {
  /** 选中用户 ID 数组（v-model） */
  modelValue?: string[];
  /** 用户分页数据源（业务侧注入，如包装 /system/user/page） */
  fetchPage: (query: UserPickerQuery) => Promise<UserPickerPage>;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: '点击选择用户',
});

const emit = defineEmits<{
  'update:modelValue': [value: string[] | undefined];
  /** 选中变化时带出完整用户对象（业务侧可取昵称等） */
  change: [users: UserPickerUser[]];
}>();

// ---------- 已选（含标签展示所需的用户信息，组件内自持） ----------
const selectedUsers = ref<UserPickerUser[]>([]);
const selectedIds = computed(() => selectedUsers.value.map((u) => u.id));

/** 外部重置（如表单清空）时同步清空内部已选 */
watch(
  () => props.modelValue,
  (ids) => {
    if (!ids || ids.length === 0) {
      selectedUsers.value = [];
      return;
    }
    // 外部已有 id 且内部无记录时，仅剔除不在 id 列表中的项（标签兜底显示 id）
    const kept = selectedUsers.value.filter((u) => ids.includes(u.id));
    const known = kept.map((u) => u.id);
    const unknown = ids.filter((id) => !known.includes(id)).map((id) => ({ id, username: id }));
    selectedUsers.value = [...kept, ...unknown];
  },
);

// ---------- 弹窗与分页 ----------
const visible = ref(false);
const loading = ref(false);
const keyword = ref('');
const rows = ref<UserPickerUser[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(10);
const tableRef = ref<TableInstance>();

async function load(): Promise<void> {
  loading.value = true;
  try {
    const page = await props.fetchPage({ pageNum: pageNum.value, pageSize: pageSize.value, keyword: keyword.value });
    rows.value = page.list;
    total.value = page.total;
    // 回显已选（跨页保留由 reserve-selection 负责，这里补当前页勾选）
    await nextTick();
    rows.value.forEach((row) => {
      if (selectedIds.value.includes(row.id)) {
        tableRef.value?.toggleRowSelection(row, true);
      }
    });
  } finally {
    loading.value = false;
  }
}

function open(): void {
  keyword.value = '';
  pageNum.value = 1;
  visible.value = true;
  void load();
}

function search(): void {
  pageNum.value = 1;
  void load();
}

function handlePageChange(page: number): void {
  pageNum.value = page;
  void load();
}

function removeUser(id: string): void {
  const next = selectedUsers.value.filter((u) => u.id !== id);
  applySelection(next);
}

function handleConfirm(): void {
  // 以表格选择为准合并：当前页未选的剔除、新选的并入
  const tableSelection = (tableRef.value?.getSelectionRows() ?? []) as UserPickerUser[];
  applySelection(tableSelection);
  visible.value = false;
}

function applySelection(users: UserPickerUser[]): void {
  selectedUsers.value = users;
  const ids = users.map((u) => u.id);
  emit('update:modelValue', ids.length > 0 ? ids : undefined);
  emit('change', users);
}
</script>

<template>
  <div class="user-picker">
    <div class="user-picker__trigger" @click="open">
      <template v-if="selectedUsers.length > 0">
        <ElTag
          v-for="u in selectedUsers"
          :key="u.id"
          closable
          class="user-picker__tag"
          @close.stop="removeUser(u.id)"
          @click.stop
        >
          {{ u.nickname || u.username }}
        </ElTag>
      </template>
      <span v-else class="user-picker__placeholder">{{ placeholder }}</span>
      <ElButton class="user-picker__btn" size="small" @click.stop="open">选择</ElButton>
    </div>

    <YDialog v-model="visible" title="选择用户" width="640px" @confirm="handleConfirm">
      <div class="user-picker__bar">
        <ElInput
          v-model="keyword"
          placeholder="按用户名搜索，回车确认"
          clearable
          :prefix-icon="Search"
          style="width: 280px"
          @keyup.enter="search"
          @clear="search"
        />
        <ElButton type="primary" @click="search">查询</ElButton>
      </div>

      <ElTable
        ref="tableRef"
        v-loading="loading"
        :data="rows"
        row-key="id"
        height="320"
        @row-click="(row: UserPickerUser) => tableRef?.toggleRowSelection(row)"
      >
        <ElTableColumn type="selection" width="48" reserve-selection />
        <ElTableColumn prop="username" label="用户名" min-width="140" />
        <ElTableColumn prop="nickname" label="昵称" min-width="140" />
      </ElTable>

      <div class="user-picker__pager">
        <ElPagination
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="pageNum"
          @current-change="handlePageChange"
        />
      </div>
    </YDialog>
  </div>
</template>

<style scoped>
.user-picker {
  width: 100%;
}

.user-picker__trigger {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 32px;
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;
}

.user-picker__trigger:hover {
  border-color: var(--el-color-primary);
}

.user-picker__placeholder {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  flex: 1;
}

.user-picker__tag {
  max-width: 160px;
}

.user-picker__btn {
  margin-left: auto;
}

.user-picker__bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.user-picker__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
