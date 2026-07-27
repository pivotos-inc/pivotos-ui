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
      <Transition name="fade-transform" mode="out-in">
        <KeepAlive :include="cachedViews">
          <component :is="Component" :key="route.fullPath" />
        </KeepAlive>
      </Transition>
    </RouterView>
  </main>
</template>

<style scoped>
.app-main {
  flex: 1;
  padding: var(--y-content-padding);
  overflow: auto;
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.2s ease;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(8px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
