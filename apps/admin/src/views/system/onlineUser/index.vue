<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { YTable } from '@pivotos/ui';
import type { YTableColumn } from '@pivotos/ui';
import type { OnlineUserVO, PageResult } from '@pivotos/types';
import { clearAllUsers, kickoutUser, listOnlineUsers } from '@/api/system/onlineUser';

// ---------- 列表 ----------
const loading = ref(false);
const rows = ref<OnlineUserVO[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(10);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const res: PageResult<OnlineUserVO> = await listOnlineUsers({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    });
    rows.value = res?.list ?? [];
    total.value = res?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

/** 格式化剩余有效期 */
function formatTtl(ttl?: number): string {
  if (ttl == null || ttl === -1) return '持久';
  if (ttl <= 0) return '已过期';
  const h = Math.floor(ttl / 3600);
  const m = Math.floor((ttl % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

const columns: YTableColumn<OnlineUserVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'username', label: '用户名', minWidth: 120 },
  { prop: 'tokenValue', label: 'Token', minWidth: 140 },
  { prop: 'ipAddr', label: '登录IP', width: 150 },
  { prop: 'loginTime', label: '登录时间', width: 170 },
  { prop: 'lastActiveTime', label: '最后活跃时间', width: 170 },
  { prop: 'tokenTtl', label: '剩余有效期', width: 110, formatter: (_row, _col, val) => formatTtl(val as number) },
];

// ---------- 强退 ----------
async function handleKickout(row: OnlineUserVO): Promise<void> {
  await ElMessageBox.confirm(
    `确定强制下线用户「${row.username}」吗？该用户将被立即登出。`,
    '强退确认',
    { type: 'warning' },
  );
  await kickoutUser(row.rawToken);
  ElMessage.success(`已强制下线用户「${row.username}」`);
  await load();
}

// ---------- 清空全部 ----------
async function handleClearAll(): Promise<void> {
  await ElMessageBox.confirm(
    '确定清空所有在线用户吗？除当前用户外，所有已登录用户将被强制下线。',
    '清空确认',
    { type: 'warning', confirmButtonText: '确定清空', cancelButtonText: '取消' },
  );
  const msg: string = await clearAllUsers();
  ElMessage.success(msg);
  await load();
}

onMounted(load);
</script>

<template>
  <div class="page-card online-user-page">
    <div class="online-user-page__bar">
      <ElButton
        v-hasPermi="'system:online-user:kickout'"
        type="danger"
        :icon="Refresh"
        @click="handleClearAll"
      >
        清空所有在线用户
      </ElButton>
      <ElButton
        v-hasPermi="'system:online-user:list'"
        :icon="Refresh"
        @click="load"
      >
        刷新
      </ElButton>
    </div>

    <YTable
      :loading="loading"
      :data="rows"
      :columns="columns"
      :total="total"
      v-model:page-num="pageNum"
      v-model:page-size="pageSize"
      row-key="rawToken"
      @refresh="load"
    >
      <ElTableColumn label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'system:online-user:kickout'"
            link
            type="danger"
            @click="handleKickout(row as OnlineUserVO)"
          >
            强退
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>
  </div>
</template>

<style scoped>
.online-user-page__bar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
