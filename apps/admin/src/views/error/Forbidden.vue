<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ElButton, ElResult } from 'element-plus';

const router = useRouter();
</script>

<template>
  <ElResult icon="error" title="403" sub-title="没有访问该页面的权限">
    <template #extra>
      <ElButton type="primary" @click="router.replace('/')">返回首页</ElButton>
    </template>
  </ElResult>
</template>
