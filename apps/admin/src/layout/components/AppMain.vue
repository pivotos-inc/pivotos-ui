<script setup lang="ts">
import { computed } from 'vue';
import { useTagsViewStore } from '@/stores/tagsView';

const tagsViewStore = useTagsViewStore();

/** keep-alive 缓存已访问标签页的组件（按路由 name 匹配） */
const cachedViews = computed(() => tagsViewStore.cachedViews);

/**
 * 组件 key：路由名/全路径 + 刷新计数。
 * 右键"刷新页面"会 bumpRefreshKey，key 变化强制重挂载（对激活中的标签页生效）。
 */
function viewKey(route: { name?: unknown; fullPath: string }): string {
  const base = String(route.name ?? route.fullPath);
  return `${base}#${tagsViewStore.refreshKeys[route.fullPath] ?? 0}`;
}
</script>

<template>
  <main class="app-main">
    <RouterView v-slot="{ Component, route }">
      <KeepAlive :include="cachedViews">
        <component :is="Component" :key="viewKey(route)" />
      </KeepAlive>
    </RouterView>
  </main>
</template>

<style scoped>
.app-main {
  flex: 1;
  padding: var(--y-content-padding);
  overflow: auto;
}
</style>
