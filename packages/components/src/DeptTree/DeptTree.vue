<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElInput, ElTree } from 'element-plus';
import type { DeptTreeNode } from './types';

interface Props {
  /** 树数据（业务侧经 listToTree 转换后传入） */
  data: DeptTreeNode[];
  loading?: boolean;
  /** 默认展开全部，默认 true */
  defaultExpandAll?: boolean;
  /** 节点过滤占位提示 */
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  defaultExpandAll: true,
  placeholder: '输入部门名称过滤',
});

const emit = defineEmits<{
  /** 点击节点 */
  'node-click': [node: DeptTreeNode];
}>();

const treeRef = ref<InstanceType<typeof ElTree>>();
const keyword = ref('');

watch(keyword, (val) => {
  treeRef.value?.filter(val);
});

function filterNode(value: string, node: Record<string, unknown>): boolean {
  if (!value) return true;
  return String((node as DeptTreeNode).name ?? '').includes(value);
}

function handleNodeClick(node: DeptTreeNode): void {
  emit('node-click', node);
}
</script>

<template>
  <div class="dept-tree">
    <ElInput v-model="keyword" :placeholder="props.placeholder" clearable class="dept-tree__filter" />
    <ElTree
      ref="treeRef"
      v-loading="loading"
      :data="data"
      :props="{ label: 'name', children: 'children' }"
      node-key="id"
      highlight-current
      :default-expand-all="defaultExpandAll"
      :filter-node-method="filterNode"
      @node-click="handleNodeClick"
    />
  </div>
</template>

<style scoped>
.dept-tree__filter {
  margin-bottom: 8px;
}
</style>
