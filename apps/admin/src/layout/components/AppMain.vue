<script setup lang="ts">
import { computed } from 'vue';
import { useTagsViewStore } from '@/stores/tagsView';

const tagsViewStore = useTagsViewStore();

/** keep-alive 缓存已访问标签页的组件（按路由 name 匹配） */
const cachedViews = computed(() => tagsViewStore.cachedViews);
</script>

<template>
  <main class="app-main">
    <RouterView v-slot="{ Component, route }">
      <KeepAlive :include="cachedViews">
        <component :is="Component" :key="route.name ?? route.fullPath" />
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
