<script setup lang="ts">
import { computed } from 'vue';
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

/** Element Plus 组件文案跟随界面语言 */
const epLocale = computed(() => (appStore.locale === 'en' ? en : zhCn));
</script>

<template>
  <ElConfigProvider :locale="epLocale">
    <RouterView />
  </ElConfigProvider>
</template>
