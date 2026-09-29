<script setup lang="ts">
defineOptions({ name: 'AiOrchestrator' });
import { computed, onMounted, ref } from 'vue';
import { ElButton, ElInput, ElMessage, ElMessageBox, ElTag } from 'element-plus';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { AiToolPlanQuery, AiToolPlanStepVO, AiToolPlanVO } from '@pivotos/types';
import { draftPlan, getPlan, listOrchestratorTools, runPlan, runPlanById } from '@/api/ai/orchestrator';
import { useTablePage } from '@/hooks';

// ---------- 常量 ----------

/** 计划状态 → 文案与颜色（对齐 ai_tool_plan.status） */
const STATUS_META: Record<string, { text: string; type: 'success' | 'danger' | 'warning' | 'info' }> = {
  draft: { text: '待执行', type: 'info' },
  success: { text: '已完成', type: 'success' },
  need_confirm: { text: '待确认写操作', type: 'warning' },
  failed: { text: '中断', type: 'danger' },
};

// ---------- 编排区 ----------
const intent = ref('');
const planning = ref(false);
const running = ref(false);
const current = ref<AiToolPlanVO>();
const availableTools = ref<string[]>([]);

/** 当前计划是否含写步骤（含则不点确认就跑会被停在写步骤前） */
const hasWriteStep = computed(() => (current.value?.steps ?? []).some((s) => s.write));

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'intent', label: '意图', component: 'input', placeholder: '按意图模糊查询' },
  {
    field: 'status',
    label: '状态',
    component: 'select',
    placeholder: '全部',
    options: [
      { label: '待执行', value: 'draft' },
      { label: '已完成', value: 'success' },
      { label: '待确认写操作', value: 'need_confirm' },
      { label: '中断', value: 'failed' },
    ],
  },
]);

const { loading, rows, total, params, load, search, reset } = useTablePage<AiToolPlanVO, AiToolPlanQuery>({
  url: '/ai/orchestrator/page',
  query: { intent: '', status: '' },
});

const columns: YTableColumn<AiToolPlanVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'intent', label: '意图', minWidth: 240, showOverflowTooltip: true },
  { prop: 'stepCount', label: '步骤', width: 70, align: 'center' },
  { prop: 'status', label: '状态', width: 120, align: 'center', slot: 'status' },
  { prop: 'costMs', label: '耗时(ms)', width: 90, align: 'right' },
  { prop: 'createTime', label: '创建时间', width: 170 },
  { prop: 'op', label: '操作', width: 150, align: 'center', slot: 'op' },
];

async function generate(): Promise<void> {
  if (!intent.value.trim()) {
    ElMessage.warning('请先描述你的意图');
    return;
  }
  planning.value = true;
  try {
    current.value = await draftPlan(intent.value.trim());
    if ((current.value.errors ?? []).length > 0) {
      ElMessage.warning('计划未通过校验，不可执行');
    } else if ((current.value.steps ?? []).length === 0) {
      ElMessage.info(current.value.unmapped || '现有工具无法完成该意图');
    } else {
      ElMessage.success(`已生成 ${current.value.steps?.length ?? 0} 步计划`);
    }
    await load();
  } finally {
    planning.value = false;
  }
}

/** 执行：含写步骤时先弹二次确认（写操作唯一护栏，前端也不许替用户点） */
async function execute(): Promise<void> {
  if (!current.value?.id) {
    ElMessage.warning('请先生成计划');
    return;
  }
  let confirmed = false;
  if (hasWriteStep.value) {
    const writeSteps = (current.value.steps ?? [])
      .filter((s) => s.write)
      .map((s) => `第${s.no}步 ${s.tool}`)
      .join('、');
    try {
      await ElMessageBox.confirm(
        `该计划包含写操作：${writeSteps}。确认后将按序执行，是否继续？`,
        '写操作二次确认',
        { type: 'warning' },
      );
      confirmed = true;
    } catch {
      ElMessage.info('已取消执行');
      return;
    }
  }
  running.value = true;
  try {
    current.value = await runPlanById(String(current.value.id), confirmed);
    notifyResult(current.value);
    await load();
  } finally {
    running.value = false;
  }
}

/** 一步到位：生成并执行（同样遵守写操作确认） */
async function draftAndRun(): Promise<void> {
  if (!intent.value.trim()) {
    ElMessage.warning('请先描述你的意图');
    return;
  }
  running.value = true;
  try {
    const vo = await runPlan(intent.value.trim(), false);
    if (vo.status === 'need_confirm') {
      try {
        await ElMessageBox.confirm(vo.resultSummary || '计划包含写操作，是否继续？', '写操作二次确认', {
          type: 'warning',
        });
        current.value = await runPlanById(String(vo.id), true);
        notifyResult(current.value);
      } catch {
        current.value = vo;
        ElMessage.info('已停在写步骤前');
      }
    } else {
      current.value = vo;
      notifyResult(vo);
    }
    await load();
  } finally {
    running.value = false;
  }
}

function notifyResult(vo: AiToolPlanVO): void {
  if (vo.status === 'success') ElMessage.success(vo.resultSummary || '执行完成');
  else if (vo.status === 'failed') ElMessage.error((vo.resultSummary || '').slice(0, 120));
  else if (vo.status === 'need_confirm') ElMessage.warning(vo.resultSummary || '等待写操作确认');
}

async function viewDetail(id: string): Promise<void> {
  current.value = await getPlan(id);
}

/** 状态列文案 */
function statusMeta(status?: string): { text: string; type: 'success' | 'danger' | 'warning' | 'info' } {
  return STATUS_META[status ?? ''] ?? { text: status || '-', type: 'info' };
}

/** 步骤输出截断展示 */
function brief(value?: string, max = 220): string {
  if (!value) return '—';
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function argsOf(step: AiToolPlanStepVO): string {
  try {
    return JSON.stringify(JSON.parse(step.args ?? '{}'));
  } catch {
    return step.args ?? '';
  }
}

onMounted(async () => {
  try {
    availableTools.value = await listOrchestratorTools();
  } catch {
    availableTools.value = [];
  }
});
</script>

<template>
  <div class="page-card">
    <div class="orchestrator-bar">
      <ElInput
        v-model="intent"
        class="intent-input"
        maxlength="500"
        placeholder="用一句话描述你要做的事，例如：把我最近发起的第一条未办完流程催办一下"
        @keyup.enter="generate"
      />
      <ElButton type="primary" :loading="planning" @click="generate">生成计划</ElButton>
      <ElButton :loading="running" @click="draftAndRun">直接执行</ElButton>
      <ElButton v-if="current?.id" type="success" :loading="running" @click="execute">
        {{ hasWriteStep ? '确认并执行' : '执行计划' }}
      </ElButton>
    </div>

    <div class="tool-hint">
      编排可用工具（{{ availableTools.length }}）：
      <ElTag v-for="t in availableTools" :key="t" size="small" type="info">{{ t }}</ElTag>
    </div>

    <!-- 计划卡片 -->
    <div v-if="current" class="plan-card">
      <div class="plan-head">
        <span class="plan-title">计划 #{{ current.id }}：{{ current.goal || current.intent }}</span>
        <ElTag :type="statusMeta(current.status).type" size="small">
          {{ statusMeta(current.status).text }}
        </ElTag>
      </div>

      <div v-if="(current.errors ?? []).length > 0" class="plan-errors">
        <div v-for="(e, i) in current.errors" :key="i">· {{ e }}</div>
      </div>
      <div v-else-if="(current.steps ?? []).length === 0" class="plan-unmapped">
        现有工具无法完成该意图：{{ current.unmapped || '（规划器未给出缺口说明）' }}
      </div>

      <ol v-else class="plan-steps">
        <li v-for="step in current.steps" :key="step.no">
          <div class="step-line">
            <b>第 {{ step.no }} 步</b>
            <code>{{ step.tool }}</code>
            <ElTag size="small" :type="step.write ? 'warning' : 'success'">
              {{ step.write ? '写操作' : '只读' }}
            </ElTag>
            <span class="step-reason">{{ step.reason }}</span>
          </div>
          <div class="step-args">入参：{{ argsOf(step) }}</div>
          <div v-if="step.output" class="step-output">输出：{{ brief(step.output) }}</div>
          <div v-else-if="step.no === current.blockedStep" class="step-blocked">停在写步骤前，等待确认</div>
        </li>
      </ol>

      <div v-if="current.resultSummary" class="plan-summary">{{ current.resultSummary }}</div>
    </div>

    <YSearchForm v-model="params" :schemas="searchSchemas" @search="search" @reset="reset" />

    <YTable v-model:params="params" :data="rows" :columns="columns" :loading="loading" :total="total" @load="load">
      <template #status="{ row }">
        <ElTag :type="statusMeta(row.status).type" size="small">{{ statusMeta(row.status).text }}</ElTag>
      </template>
      <template #op="{ row }">
        <ElButton link type="primary" @click="viewDetail(String(row.id))">查看</ElButton>
      </template>
    </YTable>
  </div>
</template>

<style scoped>
.page-card {
  padding: 16px;
}

.orchestrator-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.intent-input {
  flex: 1;
  max-width: 720px;
}

.tool-hint {
  margin: 10px 0 4px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
}

.plan-card {
  margin: 12px 0;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 8px;
}

.plan-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.plan-title {
  font-weight: 600;
}

.plan-errors {
  color: #f56c6c;
  font-size: 13px;
}

.plan-unmapped {
  color: #e6a23c;
  font-size: 13px;
}

.plan-steps {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}

.plan-steps li {
  margin-bottom: 8px;
}

.step-line {
  display: flex;
  gap: 8px;
  align-items: center;
}

.step-reason {
  color: var(--el-text-color-secondary, #909399);
}

.step-args,
.step-output,
.step-blocked {
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;
  word-break: break-all;
}

.step-blocked {
  color: #e6a23c;
}

.plan-summary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color, #dcdfe6);
  font-size: 13px;
}
</style>
