<script setup lang="ts">
/**
 * 节点属性面板（S104 一期）：节点编码/类型展示 + 名称编辑 + userTask 审批人选择（permissionFlag @@ 多值）。
 * 节点类型互转编辑出圈一期（涉及 replace 重建，见开工简报不做清单）。
 */
import { computed, ref, watch } from 'vue';
import type Modeler from 'bpmn-js/lib/Modeler';
import { ElForm, ElFormItem, ElInput, ElTag } from 'element-plus';
import { UserSelect } from '@pivotos/components';
import type { UserSelectOption } from '@pivotos/components';
import { pageUsers } from '@/api/system/user';
import { readName, readWarmAttr, writeName, writeWarmAttr, type PanelElement } from '../modelerProps';

const props = defineProps<{ modeler: Modeler | null; element: PanelElement; version: number }>();
const emit = defineEmits<{ changed: [] }>();

const NODE_TYPE_NAMES: Record<string, string> = {
  'bpmn:StartEvent': '开始节点',
  'bpmn:UserTask': '审批节点',
  'bpmn:EndEvent': '结束节点',
  'bpmn:ExclusiveGateway': '互斥网关',
  'bpmn:ParallelGateway': '并行网关',
  'bpmn:InclusiveGateway': '包容网关',
};

const typeName = computed(() => NODE_TYPE_NAMES[props.element.type] ?? props.element.type);
const isUserTask = computed(() => props.element.type === 'bpmn:UserTask');

const nodeName = ref('');
const approverIds = ref<string[]>([]);

watch(
  () => [props.element, props.version],
  () => {
    nodeName.value = readName(props.element);
    approverIds.value = readWarmAttr(props.element, 'permissionFlag').split('@@').filter(Boolean);
  },
  { immediate: true },
);

function onNameChange(): void {
  if (!props.modeler) return;
  writeName(props.modeler, props.element, nodeName.value.trim());
  emit('changed');
}

function onApproversChange(value: string | string[] | undefined): void {
  const ids = Array.isArray(value) ? value : value ? [value] : [];
  approverIds.value = ids;
  if (!props.modeler) return;
  writeWarmAttr(props.modeler, props.element, 'permissionFlag', ids.join('@@'));
  emit('changed');
}

/** 审批人远程搜索（与发起弹窗抄送人同款口径：昵称（用户名）） */
async function fetchUserOptions(keyword: string): Promise<UserSelectOption[]> {
  const res = await pageUsers({ nickname: keyword || undefined, pageNum: 1, pageSize: 20 });
  return (res.list ?? []).map((u) => ({
    value: String(u.id),
    label: u.nickname ? `${u.nickname}（${u.username}）` : u.username,
  }));
}
</script>

<template>
  <ElForm label-width="80px" size="small">
    <ElFormItem label="节点编码">
      <span class="node-code">{{ element.id }}</span>
    </ElFormItem>
    <ElFormItem label="节点类型">
      <ElTag size="small" disable-transitions>{{ typeName }}</ElTag>
    </ElFormItem>
    <ElFormItem label="节点名称">
      <ElInput v-model="nodeName" placeholder="节点名称" clearable @change="onNameChange" />
    </ElFormItem>
    <ElFormItem v-if="isUserTask" label="审批人">
      <UserSelect
        :model-value="approverIds"
        multiple
        :fetch-options="fetchUserOptions"
        placeholder="搜索并选择审批人（可多选）"
        @update:model-value="onApproversChange"
      />
    </ElFormItem>
  </ElForm>
</template>

<style scoped>
.node-code {
  color: var(--el-text-color-secondary);
  font-family: monospace;
  font-size: 12px;
}
</style>
