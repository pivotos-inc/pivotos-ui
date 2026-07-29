<script setup lang="ts">
import { ElButton, ElFormItem } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import YForm from '../YForm/YForm.vue';
import type { YFormSchema } from '../YForm/types';

interface Props {
  /** 查询条件对象（v-model） */
  modelValue: Record<string, unknown>;
  /** 查询项 Schema */
  schemas: YFormSchema[];
  /** 收起状态下展示的项数（预留，P1 实现展开/收起） */
  collapsedSize?: number;
}

withDefaults(defineProps<Props>(), {
  collapsedSize: 3,
});

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
  /** 点击查询（业务侧回第一页重新加载） */
  search: [];
  /** 点击重置（业务侧清空条件后重新加载） */
  reset: [];
}>();

function handleUpdate(value: Record<string, unknown>): void {
  emit('update:modelValue', value);
}
</script>

<template>
  <div class="y-search-form">
    <YForm
      :model-value="modelValue"
      :schemas="schemas"
      inline
      label-width="auto"
      @update:model-value="handleUpdate"
    >
      <ElFormItem>
        <ElButton type="primary" :icon="Search" @click="emit('search')">查询</ElButton>
        <ElButton :icon="Refresh" @click="emit('reset')">重置</ElButton>
        <slot name="actions" />
      </ElFormItem>
    </YForm>
  </div>
</template>

<style scoped>
.y-search-form {
  margin-bottom: 12px;
}
</style>
