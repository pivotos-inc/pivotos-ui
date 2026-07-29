<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElScrollbar } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { usePermissionStore } from '@/stores/permission';
import SidebarItem from './SidebarItem.vue';

const route = useRoute();
const appStore = useAppStore();
const permissionStore = usePermissionStore();

const activeMenu = computed(() => route.path);
</script>

<template>
  <div class="sidebar">
    <div class="sidebar__logo" @click="$router.push('/')">
      <span class="sidebar__logo-text">{{ appStore.sidebarCollapsed ? 'P' : 'PivotOS' }}</span>
    </div>
    <ElScrollbar class="sidebar__scroll">
      <ElMenu
        :default-active="activeMenu"
        :collapse="appStore.sidebarCollapsed"
        :collapse-transition="false"
        unique-opened
        router
        class="sidebar__menu"
      >
        <SidebarItem
          v-for="item in permissionStore.sidebarRoutes"
          :key="item.path"
          :route="item"
          base-path=""
        />
      </ElMenu>
    </ElScrollbar>
  </div>
</template>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--y-card-bg);
  border-right: 1px solid var(--el-border-color-light);
}

.sidebar__logo {
  height: var(--y-header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-light);
}

.sidebar__logo-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-color-primary);
  white-space: nowrap;
}

.sidebar__scroll {
  flex: 1;
}

.sidebar__menu {
  border-right: none;
}
</style>
