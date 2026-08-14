<script setup lang="ts">
defineOptions({ name: 'Home' });
import { onMounted, ref } from 'vue';
import { ElCard, ElEmpty, ElIcon, ElSkeleton, ElTag } from 'element-plus';
import { Bell } from '@element-plus/icons-vue';
import { YDialog } from '@pivotos/ui';
import type { NoticeVO } from '@pivotos/types';
import { getPublishedNotice, listPublishedNotices } from '@/api/system/notice';

// ---------- 公告卡片 ----------
const noticeLoading = ref(true);
const notices = ref<NoticeVO[]>([]);

onMounted(async () => {
  try {
    notices.value = await listPublishedNotices(5);
  } finally {
    noticeLoading.value = false;
  }
});

// ---------- 公告详情 ----------
const detailVisible = ref(false);
const detail = ref<NoticeVO>();

async function openDetail(row: NoticeVO): Promise<void> {
  detail.value = await getPublishedNotice(row.id);
  detailVisible.value = true;
}
</script>

<template>
  <div class="home-page">
    <ElCard shadow="never">
      <template #header>
        <div class="home-page__card-header">
          <ElIcon><Bell /></ElIcon>
          <span>通知公告</span>
        </div>
      </template>

      <ElSkeleton v-if="noticeLoading" :rows="4" animated />
      <ElEmpty v-else-if="notices.length === 0" description="暂无公告" :image-size="72" />
      <ul v-else class="home-page__notice-list">
        <li
          v-for="item in notices"
          :key="item.id"
          class="home-page__notice-item"
          @click="openDetail(item)"
        >
          <ElTag
            :type="item.noticeType === 1 ? 'primary' : 'warning'"
            size="small"
            disable-transitions
          >
            {{ item.noticeType === 1 ? '通知' : '公告' }}
          </ElTag>
          <span class="home-page__notice-title">{{ item.title }}</span>
          <span class="home-page__notice-time">{{ item.publishTime }}</span>
        </li>
      </ul>
    </ElCard>

    <YDialog v-model="detailVisible" :title="detail?.title ?? '公告详情'" width="640px" :show-footer="false">
      <div class="home-page__notice-meta">
        <ElTag
          :type="detail?.noticeType === 1 ? 'primary' : 'warning'"
          size="small"
          disable-transitions
        >
          {{ detail?.noticeType === 1 ? '通知' : '公告' }}
        </ElTag>
        <span>{{ detail?.publishTime }}</span>
      </div>
      <!-- 公告内容为管理端富文本编辑器产出的受控 HTML（仅管理员可写入） -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="home-page__notice-content" v-html="detail?.content || '<p>（无内容）</p>'" />
    </YDialog>
  </div>
</template>

<style scoped>
.home-page__card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.home-page__notice-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-page__notice-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
}

.home-page__notice-item:last-child {
  border-bottom: none;
}

.home-page__notice-item:hover .home-page__notice-title {
  color: var(--el-color-primary);
}

.home-page__notice-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-page__notice-time {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.home-page__notice-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.home-page__notice-content {
  line-height: 1.7;
  word-break: break-word;
}

.home-page__notice-content :deep(img) {
  max-width: 100%;
}
</style>
