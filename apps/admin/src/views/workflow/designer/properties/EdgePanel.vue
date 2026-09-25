<script setup lang="ts">
/**
 * 顺序流（边）属性面板（S104 一期）：边名称 + skipType（通过/驳回）+ 条件结构化编辑。
 * 条件按 14 号清单第六节决策走结构化表单生成 DSL：比较符 + 变量 + 值 → `le@@days|3`（踩坑 26 口径固化）。
 */
import { ref, watch } from 'vue';
import type Modeler from 'bpmn-js/lib/Modeler';
import { ElAlert, ElForm, ElFormItem, ElInput, ElOption, ElSelect } from 'element-plus';
import { readCondition, readName, readWarmAttr, writeCondition, writeName, writeWarmAttr, type PanelElement } from '../modelerProps';

const props = defineProps<{ modeler: Modeler | null; element: PanelElement; version: number }>();
const emit = defineEmits<{ changed: [] }>();

const OPS = [
  { value: 'eq', label: '等于（eq）' },
  { value: 'ne', label: '不等于（ne）' },
  { value: 'gt', label: '大于（gt）' },
  { value: 'ge', label: '大于等于（ge）' },
  { value: 'lt', label: '小于（lt）' },
  { value: 'le', label: '小于等于（le）' },
];

const edgeName = ref('');
const skipType = ref<'PASS' | 'REJECT'>('PASS');
const condOp = ref('');
const condVar = ref('');
const condValue = ref('');
/** 非标准格式的存量条件原文（展示不吞掉，用户重建后覆盖） */
const rawCondition = ref('');

watch(
  () => [props.element, props.version],
  () => {
    edgeName.value = readName(props.element);
    const st = readWarmAttr(props.element, 'skipType');
    skipType.value = st === 'REJECT' ? 'REJECT' : 'PASS';
    const raw = readCondition(props.element);
    const m = /^([a-z]+)@@([^|]+)\|(.*)$/.exec(raw);
    if (m) {
      condOp.value = m[1] ?? '';
      condVar.value = m[2] ?? '';
      condValue.value = m[3] ?? '';
      rawCondition.value = '';
    } else {
      condOp.value = '';
      condVar.value = '';
      condValue.value = '';
      rawCondition.value = raw;
    }
  },
  { immediate: true },
);

function onNameChange(): void {
  if (!props.modeler) return;
  writeName(props.modeler, props.element, edgeName.value.trim());
  emit('changed');
}

function onSkipTypeChange(): void {
  if (!props.modeler) return;
  // PASS 是映射缺省值，不落 warm:skipType 属性
  writeWarmAttr(props.modeler, props.element, 'skipType', skipType.value === 'PASS' ? '' : skipType.value);
  emit('changed');
}

/** 条件三段齐全才写 DSL；全空则清除条件；部分填写暂不写（防半成品 DSL） */
function onConditionChange(): void {
  if (!props.modeler) return;
  const op = condOp.value;
  const v = condVar.value.trim();
  const val = condValue.value.trim();
  if (op && v && val) {
    writeCondition(props.modeler, props.element, `${op}@@${v}|${val}`);
    rawCondition.value = '';
    emit('changed');
  } else if (!op && !v && !val) {
    writeCondition(props.modeler, props.element, '');
    emit('changed');
  }
}
</script>

<template>
  <ElForm label-width="80px" size="small">
    <ElFormItem label="边编码">
      <span class="edge-code">{{ element.id }}</span>
    </ElFormItem>
    <ElFormItem label="边名称">
      <ElInput v-model="edgeName" placeholder="如：同意 / 驳回" clearable @change="onNameChange" />
    </ElFormItem>
    <ElFormItem label="跳转类型">
      <ElSelect v-model="skipType" style="width: 100%" @change="onSkipTypeChange">
        <ElOption label="通过（PASS）" value="PASS" />
        <ElOption label="驳回（REJECT）" value="REJECT" />
      </ElSelect>
    </ElFormItem>
    <ElFormItem label="条件">
      <div class="cond-editor">
        <ElSelect v-model="condOp" placeholder="比较符" clearable style="width: 130px" @change="onConditionChange">
          <ElOption v-for="o in OPS" :key="o.value" :label="o.label" :value="o.value" />
        </ElSelect>
        <ElInput v-model="condVar" placeholder="变量（如 days）" style="flex: 1" @change="onConditionChange" />
        <ElInput v-model="condValue" placeholder="值（如 3）" style="flex: 1" @change="onConditionChange" />
      </div>
    </ElFormItem>
    <ElAlert
      v-if="rawCondition"
      type="warning"
      :closable="false"
      show-icon
      title="存量条件非标准三段格式"
      :description="`当前条件：${rawCondition}。用上方表单重建后将覆盖。`"
    />
  </ElForm>
</template>

<style scoped>
.edge-code {
  color: var(--el-text-color-secondary);
  font-family: monospace;
  font-size: 12px;
}

.cond-editor {
  display: flex;
  gap: 6px;
  width: 100%;
}
</style>
