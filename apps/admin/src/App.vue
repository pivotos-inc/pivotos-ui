<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <span class="app-shell__logo">PivotOS</span>
      <span class="app-shell__title">{{ t('app.title') }}</span>
    </header>
    <main class="app-shell__main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-shell__header {
  height: var(--y-header-height);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 var(--y-content-padding);
  background: var(--y-card-bg);
  border-bottom: 1px solid var(--el-border-color-light);
}

.app-shell__logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.app-shell__title {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.app-shell__main {
  flex: 1;
  padding: var(--y-content-padding);
}
</style>
