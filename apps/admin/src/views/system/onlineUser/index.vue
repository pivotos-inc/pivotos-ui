<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { YTable } from '@pivotos/ui';
import type { YTableColumn } from '@pivotos/ui';
import type { OnlineUserVO } from '@pivotos/types';
import { kickoutUser, listOnlineUsers } from '@/api/system/onlineUser';

// ---------- 列表 ----------
const loading = ref(false);
const rows = ref<OnlineUserVO[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = (await listOnlineUsers()) ?? [];
  } finally {
    loading.value = false;
  }
}

const columns: YTableColumn<OnlineUserVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'username', label: '用户名', minWidth: 120 },
  { prop: 'tokenValue', label: 'Token', minWidth: 140 },
  { prop: 'ipAddr', label: '登录IP', width: 150 },
  { prop: 'loginTime', label: '登录时间', width: 170 },
  { prop: 'lastActiveTime', label: '最后活跃时间', width: 170 },
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

onMounted(load);
</script>

<template>
  <div class="page-card online-user-page">
    <div class="online-user-page__bar">
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
  margin-bottom: 12px;
}
</style>
