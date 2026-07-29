<script setup lang="ts">
import { useAppStore } from '@/stores/app';
import AppMain from './components/AppMain.vue';
import Navbar from './components/Navbar.vue';
import Sidebar from './components/Sidebar.vue';
import TagsView from './components/TagsView.vue';

const appStore = useAppStore();
</script>

<template>
  <div class="layout">
    <aside
      class="layout__sidebar"
      :style="{
        width: appStore.sidebarCollapsed
          ? 'var(--y-sidebar-collapse-width)'
          : 'var(--y-sidebar-width)',
      }"
    >
      <Sidebar />
    </aside>
    <div class="layout__body">
      <Navbar />
      <TagsView />
      <AppMain />
    </div>
  </div>
</template>

<style scoped>
.layout {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.layout__sidebar {
  flex-shrink: 0;
  transition: width 0.2s ease;
  overflow: hidden;
}

.layout__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
</style>
