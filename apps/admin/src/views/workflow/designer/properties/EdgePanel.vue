<script setup lang="ts">
/**
 * 顺序流（边）属性面板：边名称 + skipType（通过/驳回）+ 条件结构化编辑。
 * 条件按 14 号清单第六节决策走结构化表单生成 DSL：比较符 + 变量 + 值 → `le@@days|3`（踩坑 26 口径固化）。
 * S105 完整版：变量字典联想（画布已用变量 + 预置常用变量）+ 三段校验强化（变量名正则/必填提示，半成品不落 DSL）。
 */
import { computed, ref, watch } from 'vue';
import type Modeler from 'bpmn-js/lib/Modeler';
import { ElAlert, ElAutocomplete, ElForm, ElFormItem, ElInput, ElOption, ElSelect } from 'element-plus';
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

/** 变量名合法性格式（warm-flow 条件变量进入表达式求值，限标识符） */
const VAR_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** 预置常用变量（平台无变量注册处，字典 = 画布已用变量 ∪ 预置） */
const PRESET_VARS = ['days', 'amount'];

const edgeName = ref('');
const skipType = ref<'PASS' | 'REJECT'>('PASS');
const condOp = ref('');
const condVar = ref('');
const condValue = ref('');
/** 三段任一非空但未通过校验时的提示（半成品不落 DSL，防脏数据） */
const condError = ref('');
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
    condError.value = '';
  },
  { immediate: true },
);

/** 画布上所有边已解析出的条件变量（字典联想候选源之一） */
const canvasVars = computed(() => {
  if (!props.modeler) return [] as string[];
  // 依赖 version 触发重算（面板值变化后候选同步）
  void props.version;
  const registry = props.modeler.get('elementRegistry') as {
    filter(predicate: (el: PanelElement) => boolean): PanelElement[];
  };
  const vars = new Set<string>();
  for (const el of registry.filter((e) => e.type === 'bpmn:SequenceFlow')) {
    const m = /^([a-z]+)@@([^|]+)\|(.*)$/.exec(readCondition(el));
    if (m?.[2] && VAR_PATTERN.test(m[2])) vars.add(m[2]);
  }
  return [...vars];
});

/** ElAutocomplete 联想回调：画布已用 ∪ 预置，按输入前缀/子串过滤 */
function queryVarSuggestions(query: string, cb: (list: Array<{ value: string }>) => void): void {
  const all = [...new Set([...canvasVars.value, ...PRESET_VARS])];
  const q = query.trim().toLowerCase();
  cb(all.filter((v) => !q || v.toLowerCase().includes(q)).map((value) => ({ value })));
}

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

/**
 * 条件三段校验与落 DSL（S105 强化）：
 * 全空 → 清除条件；任一非空 → 三段齐全 + 变量名合法才写 DSL，否则给提示不落盘（防半成品）。
 */
function onConditionChange(): void {
  if (!props.modeler) return;
  const op = condOp.value;
  const v = condVar.value.trim();
  const val = condValue.value.trim();
  if (!op && !v && !val) {
    condError.value = '';
    writeCondition(props.modeler, props.element, '');
    emit('changed');
    return;
  }
  if (!op) {
    condError.value = '请选择比较符';
    return;
  }
  if (!v) {
    condError.value = '请填写条件变量（如 days）';
    return;
  }
  if (!VAR_PATTERN.test(v)) {
    condError.value = '变量名须为标识符（字母/下划线开头，仅含字母数字下划线）';
    return;
  }
  if (!val) {
    condError.value = '请填写比较值（如 3）';
    return;
  }
  condError.value = '';
  writeCondition(props.modeler, props.element, `${op}@@${v}|${val}`);
  rawCondition.value = '';
  emit('changed');
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
        <ElAutocomplete
          v-model="condVar"
          :fetch-suggestions="queryVarSuggestions"
          placeholder="变量（如 days）"
          style="flex: 1"
          @change="onConditionChange"
          @select="onConditionChange"
        />
        <ElInput v-model="condValue" placeholder="值（如 3）" style="flex: 1" @change="onConditionChange" />
      </div>
    </ElFormItem>
    <ElAlert v-if="condError" type="error" :closable="false" show-icon :title="condError" />
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
