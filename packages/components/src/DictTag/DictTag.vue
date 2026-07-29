<script setup lang="ts">
import { computed } from 'vue';
import { ElTag } from 'element-plus';
import type { DictDataVO } from '@pivotos/types';

type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  /** 字典值 */
  value?: string | number;
  /** 字典数据（业务侧经 useDict 取得） */
  options: DictDataVO[];
  /** 强制指定 Tag 类型；缺省按选项下标循环取色 */
  type?: TagType;
}

const props = withDefaults(defineProps<Props>(), {
  value: undefined,
  type: undefined,
});

const TAG_TYPES: TagType[] = ['primary', 'success', 'warning', 'danger', 'info'];

const index = computed(() => props.options.findIndex((o) => o.dictValue === String(props.value)));
const current = computed(() => (index.value >= 0 ? props.options[index.value] : undefined));
const tagType = computed<TagType>(
  () => props.type ?? TAG_TYPES[(index.value >= 0 ? index.value : 0) % TAG_TYPES.length],
);
</script>

<template>
  <ElTag v-if="current" :type="tagType">{{ current.dictLabel }}</ElTag>
  <span v-else>{{ value ?? '-' }}</span>
</template>
