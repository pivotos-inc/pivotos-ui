<script setup lang="ts">
/**
 * 纯路由容器：「目录下挂目录」结构的中间层节点专用（S131）。
 *
 * 后端对非顶层目录不再下发 Layout（见 MenuServiceImpl#dirComponent），前端遇到
 * 未指定组件的目录就挂这个壳——只放一层 router-view，不再渲染第二套侧边栏/顶栏/标签页。
 * 若这里也用 Layout，路由树会变成 Layout → Layout → 页面，页面里会再出现一整套布局。
 */
defineOptions({ name: 'RouteView' });
</script>

<template>
  <router-view />
</template>
