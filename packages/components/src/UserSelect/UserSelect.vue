<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElOption, ElSelect } from 'element-plus';
import type { UserSelectOption } from './types';

interface Props {
  /** 选中值（v-model），多选为数组 */
  modelValue?: string | string[];
  /** 远程搜索数据源（业务侧注入，如 keyword => userApi.search(keyword)） */
  fetchOptions: (keyword: string) => Promise<UserSelectOption[]>;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** 可清空，默认 true */
  clearable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  multiple: false,
  disabled: false,
  placeholder: '输入姓名搜索用户',
  clearable: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | undefined];
  /** 选中变化时带出完整选项（业务侧取昵称/头像等） */
  change: [options: UserSelectOption[]];
}>();

const loading = ref(false);
const options = ref<UserSelectOption[]>([]);

async function search(keyword: string): Promise<void> {
  loading.value = true;
  try {
    options.value = await props.fetchOptions(keyword);
  } finally {
    loading.value = false;
  }
}

function handleUpdate(value: string | string[] | undefined): void {
  emit('update:modelValue', value);
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  emit(
    'change',
    options.value.filter((o) => values.includes(o.value)),
  );
}

onMounted(() => void search(''));
</script>

<template>
  <ElSelect
    :model-value="modelValue"
    :multiple="multiple"
    :disabled="disabled"
    :placeholder="placeholder"
    :clearable="clearable"
    :loading="loading"
    filterable
    remote
    :remote-method="search"
    style="width: 100%"
    @update:model-value="handleUpdate"
  >
    <ElOption v-for="o in options" :key="o.value" :label="o.label" :value="o.value" :disabled="o.disabled" />
  </ElSelect>
</template>
