<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElBreadcrumb, ElBreadcrumbItem } from 'element-plus';
import { translateMenuTitle } from '@/locales';

const route = useRoute();

/** 面包屑：取 matched 中带标题的路由，最后一级不可点击 */
const items = computed(() =>
  route.matched.filter((r) => r.meta?.title && !r.meta?.hidden),
);
</script>

<template>
  <ElBreadcrumb separator="/" class="breadcrumb">
    <ElBreadcrumbItem v-for="(item, index) in items" :key="item.path">
      <span v-if="index === items.length - 1" class="breadcrumb__current">
        {{ translateMenuTitle(item.meta?.title) }}
      </span>
      <RouterLink v-else :to="item.path" class="breadcrumb__link">
        {{ translateMenuTitle(item.meta?.title) }}
      </RouterLink>
    </ElBreadcrumbItem>
  </ElBreadcrumb>
</template>

<style scoped>
.breadcrumb {
  line-height: var(--y-header-height);
}

.breadcrumb__current {
  color: var(--el-text-color-primary);
}

.breadcrumb__link {
  color: var(--el-text-color-secondary);
  text-decoration: none;
}

.breadcrumb__link:hover {
  color: var(--el-color-primary);
}
</style>
