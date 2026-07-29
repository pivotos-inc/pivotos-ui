<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ElButton, ElResult } from 'element-plus';

const router = useRouter();
</script>

<template>
  <ElResult icon="warning" title="404" sub-title="页面不存在或无权访问">
    <template #extra>
      <ElButton type="primary" @click="router.replace('/')">返回首页</ElButton>
    </template>
  </ElResult>
</template>
