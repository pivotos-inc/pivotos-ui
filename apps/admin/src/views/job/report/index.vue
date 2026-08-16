<script setup lang="ts">
defineOptions({ name: 'JobReport' });
import { ElEmpty } from 'element-plus';
</script>

<template>
  <div class="job-report-placeholder">
    <ElEmpty description="统计报表功能开发中" />
  </div>
</template>

<style scoped>
.job-report-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}
</style>
