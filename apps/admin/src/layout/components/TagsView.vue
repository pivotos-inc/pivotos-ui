<script setup lang="ts">
import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElScrollbar,
  ElTag,
} from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { useTagsViewStore, type TagView } from '@/stores/tagsView';
import { translateMenuTitle } from '@/locales';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const tagsViewStore = useTagsViewStore();

watch(
  () => route.fullPath,
  () => tagsViewStore.addView(route),
  { immediate: true },
);

function isActive(view: TagView): boolean {
  return view.fullPath === route.fullPath;
}

function open(view: TagView): void {
  if (!isActive(view)) void router.push(view.fullPath);
}

/** 关闭标签：若关闭的是当前页，跳到最后一个剩余标签 */
function close(view: TagView): void {
  const remaining = tagsViewStore.delView(view.fullPath);
  if (isActive(view)) {
    const last = remaining[remaining.length - 1];
    void router.push(last ? last.fullPath : '/');
  }
}

function closeOthers(): void {
  tagsViewStore.delOthers(route.fullPath);
  void router.push(route.fullPath);
}

function closeAll(): void {
  const remaining = tagsViewStore.delAll();
  const last = remaining[remaining.length - 1];
  void router.push(last ? last.fullPath : '/');
}
</script>

<template>
  <div class="tags-view">
    <ElScrollbar class="tags-view__scroll">
      <div class="tags-view__list">
        <ElTag
          v-for="view in tagsViewStore.visitedViews"
          :key="view.fullPath"
          :effect="isActive(view) ? 'dark' : 'plain'"
          :closable="!view.affix"
          class="tags-view__tag"
          @click="open(view)"
          @close="close(view)"
        >
          {{ translateMenuTitle(view.title) }}
        </ElTag>
      </div>
    </ElScrollbar>

    <ElDropdown trigger="click" class="tags-view__actions">
      <ElIcon class="tags-view__actions-icon"><ArrowDown /></ElIcon>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem @click="closeOthers">{{ t('layout.closeOthers') }}</ElDropdownItem>
          <ElDropdownItem @click="closeAll">{{ t('layout.closeAll') }}</ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>
  </div>
</template>

<style scoped>
.tags-view {
  height: 40px;
  display: flex;
  align-items: center;
  background: var(--y-card-bg);
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 0 var(--y-content-padding);
}

.tags-view__scroll {
  flex: 1;
}

.tags-view__list {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.tags-view__tag {
  cursor: pointer;
}

.tags-view__actions {
  margin-left: 8px;
}

.tags-view__actions-icon {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}
</style>
