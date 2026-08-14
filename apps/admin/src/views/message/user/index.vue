<script setup lang="ts">
defineOptions({ name: 'MessageUser' });
import { onMounted, ref } from 'vue';
import { ElButton, ElMessage, ElTableColumn, ElTag } from 'element-plus';
import { Check, Finished } from '@element-plus/icons-vue';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import type { UserMessageQuery, UserMessageVO } from '@pivotos/types';
import { markAllRead, markRead, unreadCount } from '@/api/message/user';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<UserMessageVO, UserMessageQuery>({
  url: '/message/user/page',
  query: { readStatus: '', msgType: '' },
});

const READ_STATUS_OPTIONS: YFormOption[] = [
  { label: '未读', value: 0 },
  { label: '已读', value: 1 },
];

const MSG_TYPE_OPTIONS: YFormOption[] = [
  { label: '通知', value: 1 },
  { label: '公告', value: 2 },
  { label: '待办', value: 3 },
];

const MSG_TYPE_LABEL: Record<number, string> = { 1: '通知', 2: '公告', 3: '待办' };
const MSG_TYPE_TAG: Record<number, 'primary' | 'warning' | 'success'> = {
  1: 'primary',
  2: 'warning',
  3: 'success',
};

const searchSchemas: YFormSchema[] = [
  { field: 'readStatus', label: '已读状态', component: 'select', placeholder: '全部', options: READ_STATUS_OPTIONS },
  { field: 'msgType', label: '消息类型', component: 'select', placeholder: '全部', options: MSG_TYPE_OPTIONS },
];

const columns: YTableColumn<UserMessageVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'title', label: '标题', minWidth: 180, slot: 'title' },
  { prop: 'msgType', label: '类型', width: 90, align: 'center', slot: 'msgType' },
  { prop: 'readStatus', label: '状态', width: 80, align: 'center', slot: 'readStatus' },
  { prop: 'createTime', label: '送达时间', width: 170 },
  { prop: 'readTime', label: '阅读时间', width: 170 },
];

const unread = ref(0);

async function refreshUnread(): Promise<void> {
  unread.value = await unreadCount();
}

async function handleRead(row: UserMessageVO): Promise<void> {
  await markRead(row.userMessageId);
  ElMessage.success('已标记为已读');
  await Promise.all([load(), refreshUnread()]);
}

async function handleReadAll(): Promise<void> {
  const affected = await markAllRead();
  ElMessage.success(affected > 0 ? `已将 ${affected} 条消息标记为已读` : '没有未读消息');
  await Promise.all([load(), refreshUnread()]);
}

onMounted(refreshUnread);
</script>

<template>
  <div class="page-card">
    <div class="user-page__bar">
      <span class="user-page__unread">
        当前未读 <b>{{ unread }}</b> 条
      </span>
      <ElButton type="primary" :icon="Finished" :disabled="unread === 0" @click="handleReadAll">
        全部已读
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
      row-key="userMessageId"
      @refresh="load"
    >
      <template #title="{ row }">
        <span :class="{ 'user-page__title--unread': (row as UserMessageVO).readStatus === 0 }">
          {{ (row as UserMessageVO).title }}
        </span>
      </template>
      <template #msgType="{ row }">
        <ElTag :type="MSG_TYPE_TAG[(row as UserMessageVO).msgType ?? 1]">
          {{ MSG_TYPE_LABEL[(row as UserMessageVO).msgType ?? 1] }}
        </ElTag>
      </template>
      <template #readStatus="{ row }">
        <ElTag :type="(row as UserMessageVO).readStatus === 0 ? 'danger' : 'info'" effect="plain">
          {{ (row as UserMessageVO).readStatus === 0 ? '未读' : '已读' }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="(row as UserMessageVO).readStatus === 0"
            link
            type="primary"
            :icon="Check"
            @click="handleRead(row as UserMessageVO)"
          >
            标记已读
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>
  </div>
</template>

<style scoped>
.user-page__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.user-page__unread {
  color: var(--el-text-color-secondary);
}

.user-page__unread b {
  color: var(--el-color-danger);
}

.user-page__title--unread {
  font-weight: 600;
}
</style>
