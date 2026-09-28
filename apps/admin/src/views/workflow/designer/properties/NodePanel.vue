<script setup lang="ts">
/**
 * 节点属性面板：节点编码/类型展示 + 名称编辑 + userTask 审批人选择（permissionFlag @@ 多值）
 * + 办理模式（S105 二期，nodeRatio：或签/会签/票签通过率/票签固定人数）。
 * 顺签不提供：warm-flow 1.8.7 isSequenceSign 为枚举死代码（零调用方），写入 @@sequence 运行时 500
 * （S105 开工简报 T3 出圈依据，v2.14.0+ 候选）。
 * 存量表达式策略（spel@@/default@@）只读展示不吞掉，选定面板可表达的模式后才覆盖。
 * 节点类型互转编辑出圈（涉及 replace 重建）。
 */
import { computed, ref, watch } from 'vue';
import type Modeler from 'bpmn-js/lib/Modeler';
import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElTag } from 'element-plus';
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

/** 办理模式（引擎契约：nodeRatio 字符串，S94 K1 + S105 源码复核） */
type SignMode = 'or' | 'countersign' | 'voteRatio' | 'votePassCount' | 'voteRejectCount' | 'other';
const SIGN_MODES: Array<{ value: SignMode; label: string }> = [
  { value: 'or', label: '或签（任一通过即推进，默认）' },
  { value: 'countersign', label: '会签（全员通过才推进）' },
  { value: 'voteRatio', label: '票签·通过率（1~99）' },
  { value: 'votePassCount', label: '票签·固定通过人数' },
  { value: 'voteRejectCount', label: '票签·固定驳回人数' },
];

const typeName = computed(() => NODE_TYPE_NAMES[props.element.type] ?? props.element.type);
const isUserTask = computed(() => props.element.type === 'bpmn:UserTask');

const nodeName = ref('');
const approverIds = ref<string[]>([]);

/** 办理模式状态：mode + 票签数值 + 面板不可表达的存量值（只读展示） */
const signMode = ref<SignMode>('or');
const voteRatio = ref(50);
const voteCount = ref(2);
const rawNodeRatio = ref('');

/** nodeRatio 解析：兼容存量 0.000；不可表达值进 raw 只读 */
function parseNodeRatio(raw: string): void {
  const v = raw.trim();
  if (!v) {
    signMode.value = 'or';
    rawNodeRatio.value = '';
    return;
  }
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (n === 0) {
      signMode.value = 'or';
    } else if (n === 100) {
      signMode.value = 'countersign';
    } else if (n > 0 && n < 100) {
      signMode.value = 'voteRatio';
      voteRatio.value = n;
    } else {
      signMode.value = 'other';
      rawNodeRatio.value = v;
      return;
    }
    rawNodeRatio.value = '';
    return;
  }
  const pc = /^passCount=(\d+)$/.exec(v);
  if (pc) {
    signMode.value = 'votePassCount';
    voteCount.value = Number(pc[1]);
    rawNodeRatio.value = '';
    return;
  }
  const rc = /^rejectCount=(\d+)$/.exec(v);
  if (rc) {
    signMode.value = 'voteRejectCount';
    voteCount.value = Number(rc[1]);
    rawNodeRatio.value = '';
    return;
  }
  signMode.value = 'other';
  rawNodeRatio.value = v;
}

watch(
  () => [props.element, props.version],
  () => {
    nodeName.value = readName(props.element);
    approverIds.value = readWarmAttr(props.element, 'permissionFlag').split('@@').filter(Boolean);
    parseNodeRatio(readWarmAttr(props.element, 'nodeRatio'));
  },
  { immediate: true },
);

/** 多审批人才有办理模式语义（S94 K2：permissionFlag 管人、nodeRatio 管模式） */
const singleApproverTip = computed(() => isUserTask.value && approverIds.value.length <= 1);

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

/** 办理模式 → nodeRatio 落盘值；或签为缺省不落属性 */
function buildNodeRatio(): string {
  switch (signMode.value) {
    case 'countersign':
      return '100';
    case 'voteRatio':
      return String(Math.min(99, Math.max(1, Math.round(voteRatio.value))));
    case 'votePassCount':
      return `passCount=${Math.max(1, Math.round(voteCount.value))}`;
    case 'voteRejectCount':
      return `rejectCount=${Math.max(1, Math.round(voteCount.value))}`;
    default:
      return '';
  }
}

function onSignModeChange(): void {
  if (!props.modeler || signMode.value === 'other') return;
  writeWarmAttr(props.modeler, props.element, 'nodeRatio', buildNodeRatio());
  rawNodeRatio.value = '';
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
    <template v-if="isUserTask">
      <ElFormItem label="审批人">
        <UserSelect
          :model-value="approverIds"
          multiple
          :fetch-options="fetchUserOptions"
          placeholder="搜索并选择审批人（可多选）"
          @update:model-value="onApproversChange"
        />
      </ElFormItem>
      <ElFormItem label="办理模式">
        <ElSelect v-model="signMode" style="width: 100%" @change="onSignModeChange">
          <ElOption v-for="m in SIGN_MODES" :key="m.value" :label="m.label" :value="m.value" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="signMode === 'voteRatio'" label="通过率(%)">
        <ElInputNumber v-model="voteRatio" :min="1" :max="99" style="width: 100%" @change="onSignModeChange" />
      </ElFormItem>
      <ElFormItem v-if="signMode === 'votePassCount' || signMode === 'voteRejectCount'" label="人数">
        <ElInputNumber v-model="voteCount" :min="1" :max="99" style="width: 100%" @change="onSignModeChange" />
      </ElFormItem>
      <ElAlert
        v-if="signMode === 'other'"
        type="warning"
        :closable="false"
        show-icon
        title="存量办理模式为表达式策略，面板只读展示"
        :description="`当前 nodeRatio：${rawNodeRatio}。选择上方任一模式后将覆盖。`"
      />
      <ElAlert
        v-if="singleApproverTip"
        type="info"
        :closable="false"
        show-icon
        title="办理模式仅在多审批人节点生效（当前审批人 ≤1 人）"
      />
    </template>
  </ElForm>
</template>

<style scoped>
.node-code {
  color: var(--el-text-color-secondary);
  font-family: monospace;
  font-size: 12px;
}
</style>
