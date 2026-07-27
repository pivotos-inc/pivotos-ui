<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElIcon, ElInput } from 'element-plus';
import { YDialog } from '@pivotos/ui';
import type { IconPickerOption } from './types';

interface Props {
  /** 选中图标名（v-model），未选为 undefined/空串 */
  modelValue?: string;
  /** 图标候选集（业务侧注入，本包不持有图标注册表） */
  icons: IconPickerOption[];
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: '点击选择图标',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined];
}>();

const visible = ref(false);
const keyword = ref('');

const current = computed(() => props.icons.find((o) => o.name === props.modelValue));

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return props.icons;
  return props.icons.filter((o) => o.name.toLowerCase().includes(kw));
});

function open(): void {
  keyword.value = '';
  visible.value = true;
}

function pick(name: string): void {
  emit('update:modelValue', name);
  visible.value = false;
}

function clear(): void {
  emit('update:modelValue', undefined);
}
</script>

<template>
  <div class="icon-picker">
    <ElInput :model-value="modelValue ?? ''" :placeholder="placeholder" readonly>
      <template #prefix>
        <ElIcon v-if="current"><component :is="current.component" /></ElIcon>
      </template>
      <template #suffix>
        <span v-if="modelValue" class="icon-picker__clear" @click.stop="clear">✕</span>
      </template>
    </ElInput>
    <span class="icon-picker__mask" @click="open" />

    <YDialog v-model="visible" title="选择图标" width="640px" :show-footer="false">
      <ElInput v-model="keyword" placeholder="按图标名搜索" clearable class="icon-picker__search" />
      <div class="icon-picker__grid">
        <div
          v-for="o in filtered"
          :key="o.name"
          class="icon-picker__cell"
          :class="{ 'icon-picker__cell--active': o.name === modelValue }"
          :title="o.name"
          @click="pick(o.name)"
        >
          <ElIcon :size="22"><component :is="o.component" /></ElIcon>
          <span class="icon-picker__name">{{ o.name }}</span>
        </div>
        <div v-if="filtered.length === 0" class="icon-picker__empty">无匹配图标</div>
      </div>
    </YDialog>
  </div>
</template>

<style scoped>
.icon-picker {
  position: relative;
  width: 100%;
}

.icon-picker__mask {
  position: absolute;
  inset: 0;
  cursor: pointer;
}

.icon-picker__clear {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.icon-picker__clear:hover {
  color: var(--el-color-danger);
}

.icon-picker__search {
  margin-bottom: 12px;
}

.icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.icon-picker__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.icon-picker__cell:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.icon-picker__cell--active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.icon-picker__name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-picker__empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 24px 0;
}
</style>
