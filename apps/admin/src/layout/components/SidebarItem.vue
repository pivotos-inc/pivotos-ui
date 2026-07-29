<script setup lang="ts">
import { computed } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import { ElIcon, ElMenuItem, ElSubMenu } from 'element-plus';
import { menuIcon } from '../icons';
import { translateMenuTitle } from '@/locales';

interface Props {
  route: RouteRecordRaw;
  basePath: string;
}

const props = defineProps<Props>();

/** 解析全路径：子路由相对路径拼父级 */
const resolvedPath = computed(() =>
  props.route.path.startsWith('/')
    ? props.route.path
    : `${props.basePath.replace(/\/$/, '')}/${props.route.path}`,
);

/** 可见子节点（hidden 不进菜单） */
const visibleChildren = computed(
  () => props.route.children?.filter((c) => !c.meta?.hidden) ?? [],
);

const title = computed(() => translateMenuTitle(props.route.meta?.title));
const icon = computed(() => menuIcon(props.route.meta?.icon));
</script>

<template>
  <ElSubMenu v-if="visibleChildren.length" :index="resolvedPath">
    <template #title>
      <ElIcon><component :is="icon" /></ElIcon>
      <span>{{ title }}</span>
    </template>
    <SidebarItem
      v-for="child in visibleChildren"
      :key="child.path"
      :route="child"
      :base-path="resolvedPath"
    />
  </ElSubMenu>
  <ElMenuItem v-else :index="resolvedPath">
    <ElIcon><component :is="icon" /></ElIcon>
    <template #title>{{ title }}</template>
  </ElMenuItem>
</template>
