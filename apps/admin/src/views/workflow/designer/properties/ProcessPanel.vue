<script setup lang="ts">
/**
 * 流程（process 根）属性面板（S105 搭车）：无选中图元时展示，编辑流程编码/名称。
 * 背景：L1 取证要求「新设计器造真实流程定义」，而此前画布根不可编辑，
 * 新流程只能沿用示例 XML 的 process id（会写成 leave_tier_s103 新版本）。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type Modeler from 'bpmn-js/lib/Modeler';
import { ElForm, ElFormItem, ElInput } from 'element-plus';
import { readName, writeName, type PanelElement } from '../modelerProps';

const props = defineProps<{ modeler: Modeler | null; version: number }>();
const emit = defineEmits<{ changed: [] }>();

const flowCode = ref('');
const flowName = ref('');

interface CanvasLike {
  getRootElement(): PanelElement;
}
interface ModelingLike {
  updateProperties(element: unknown, props: Record<string, unknown>): void;
}

function rootElement(): PanelElement | null {
  if (!props.modeler) return null;
  return (props.modeler.get('canvas') as CanvasLike).getRootElement();
}

function refresh(): void {
  const root = rootElement();
  if (!root) return;
  flowCode.value = root.id;
  flowName.value = readName(root);
}

onMounted(refresh);

/** 画布重建（载入示例/回读）后根元素更换，监听 import 完成刷新 */
let offImport: (() => void) | null = null;
onMounted(() => {
  if (!props.modeler) return;
  const handler = (): void => refresh();
  props.modeler.on('import.parse.complete' as never, handler as never);
  props.modeler.on('commandStack.changed' as never, handler as never);
  offImport = () => {
    props.modeler?.off('import.parse.complete' as never, handler as never);
    props.modeler?.off('commandStack.changed' as never, handler as never);
  };
});
onBeforeUnmount(() => offImport?.());

function onFlowCodeChange(): void {
  const root = rootElement();
  if (!props.modeler || !root) return;
  const id = flowCode.value.trim();
  if (!id || id === root.id) return;
  (props.modeler.get('modeling') as ModelingLike).updateProperties(root, { id });
  emit('changed');
}

function onFlowNameChange(): void {
  const root = rootElement();
  if (!props.modeler || !root) return;
  writeName(props.modeler, root, flowName.value.trim());
  emit('changed');
}
</script>

<template>
  <ElForm label-width="80px" size="small">
    <ElFormItem label="流程编码">
      <ElInput v-model="flowCode" placeholder="如 bpmn_s105_vote（保存后按此反查/发布）" @change="onFlowCodeChange" />
    </ElFormItem>
    <ElFormItem label="流程名称">
      <ElInput v-model="flowName" placeholder="流程名称" @change="onFlowNameChange" />
    </ElFormItem>
    <div class="process-tip">点击画布中的节点或连线编辑节点属性</div>
  </ElForm>
</template>

<style scoped>
.process-tip {
  padding: 12px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
