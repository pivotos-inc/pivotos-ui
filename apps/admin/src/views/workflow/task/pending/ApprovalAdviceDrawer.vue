<script setup lang="ts">
defineOptions({ name: 'ApprovalAdviceDrawer' });
import { computed, ref, watch } from 'vue';
import {
  ElAlert,
  ElButton,
  ElDrawer,
  ElOption,
  ElSelect,
  ElSkeleton,
  ElTag,
} from 'element-plus';
import type {
  ApprovalAdviceVO,
  ApprovalReferenceVO,
  KbSimpleOptionVO,
} from '@pivotos/types';
import { latestApprovalAdvice, streamApprovalAdvice } from '@/api/ai/approval';
import { listKbOptions } from '@/api/ai/chat';

/** AI 审批建议抽屉（S101 A3 前端接入）：知识库可选 + SSE 流式渲染结构化建议 */

const props = defineProps<{ modelValue: boolean; taskId: string }>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

/** 免责声明兜底文案（meta/done 帧携带为准，帧未到先用静态文案） */
const DISCLAIMER_FALLBACK = 'AI 建议仅供参考，审批责任仍归审批人';

// ---------- 知识库下拉 ----------
const kbOptions = ref<KbSimpleOptionVO[]>([]);
const kbId = ref<string>('');

async function loadKbOptions(): Promise<void> {
  try {
    kbOptions.value = await listKbOptions();
  } catch {
    kbOptions.value = [];
  }
}

// ---------- 建议状态 ----------
type Phase = 'idle' | 'loading' | 'streaming' | 'done' | 'error';
const phase = ref<Phase>('idle');
const disclaimer = ref(DISCLAIMER_FALLBACK);
/** 流式过程中的原始输出（delta 累加，done 后由结构化字段接管展示） */
const streamText = ref('');
const conclusion = ref('');
const reason = ref('');
const references = ref<ApprovalReferenceVO[]>([]);
const latestAdvice = ref<ApprovalAdviceVO | null>(null);
const errorMsg = ref('');
let controller: AbortController | null = null;

const CONCLUSION_LABEL: Record<string, string> = {
  approve: '建议通过',
  reject: '建议驳回',
  need_info: '需补充材料',
};
const CONCLUSION_TAG: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  approve: 'success',
  reject: 'danger',
  need_info: 'warning',
};

const conclusionLabel = computed(() => CONCLUSION_LABEL[conclusion.value] ?? conclusion.value);
const conclusionTag = computed(() => CONCLUSION_TAG[conclusion.value] ?? 'info');

/** 打开抽屉：复位状态 → 并行加载知识库选项与最近一条建议回显 */
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    resetState();
    void loadKbOptions();
    phase.value = 'loading';
    try {
      latestAdvice.value = await latestApprovalAdvice(props.taskId);
      if (latestAdvice.value) {
        applyAdvice(latestAdvice.value);
      }
      phase.value = 'idle';
    } catch {
      phase.value = 'idle';
    }
  },
);

function resetState(): void {
  controller?.abort();
  controller = null;
  phase.value = 'idle';
  disclaimer.value = DISCLAIMER_FALLBACK;
  streamText.value = '';
  conclusion.value = '';
  reason.value = '';
  references.value = [];
  latestAdvice.value = null;
  errorMsg.value = '';
}

/** 结构化建议上屏（回显与 done 帧共用） */
function applyAdvice(advice: { conclusion?: string; reason?: string; references?: ApprovalReferenceVO[] }): void {
  conclusion.value = advice.conclusion ?? '';
  reason.value = advice.reason ?? '';
  references.value = advice.references ?? [];
}

/** 生成/重新生成：SSE 流式渲染（meta → delta* → done） */
function generate(): void {
  controller?.abort();
  controller = new AbortController();
  phase.value = 'streaming';
  streamText.value = '';
  conclusion.value = '';
  reason.value = '';
  references.value = [];
  errorMsg.value = '';
  void streamApprovalAdvice(
    { taskId: props.taskId, kbId: kbId.value || undefined },
    {
      onMeta: (meta) => {
        if (meta.disclaimer) disclaimer.value = meta.disclaimer;
      },
      onDelta: (content) => {
        streamText.value += content;
      },
      onDone: (done) => {
        if (done.disclaimer) disclaimer.value = done.disclaimer;
        applyAdvice(done);
        phase.value = 'done';
      },
      onError: (msg) => {
        errorMsg.value = msg;
        phase.value = 'error';
      },
    },
    controller.signal,
  );
}

function close(): void {
  controller?.abort();
  controller = null;
  visible.value = false;
}
</script>

<template>
  <ElDrawer
    v-model="visible"
    title="AI 审批建议"
    size="480"
    destroy-on-close
    @close="close"
  >
    <div class="advice-body">
      <ElAlert
        :title="disclaimer"
        type="warning"
        :closable="false"
        show-icon
        class="advice-disclaimer"
      />

      <div class="advice-toolbar">
        <ElSelect
          v-model="kbId"
          clearable
          placeholder="制度知识库（默认策略）"
          style="flex: 1"
          :disabled="phase === 'streaming'"
        >
          <ElOption v-for="kb in kbOptions" :key="kb.id" :value="kb.id" :label="kb.name" />
        </ElSelect>
        <ElButton
          type="primary"
          :loading="phase === 'streaming'"
          @click="generate"
        >
          {{ conclusion || latestAdvice ? '重新生成' : '生成建议' }}
        </ElButton>
      </div>

      <ElSkeleton v-if="phase === 'loading'" :rows="4" animated />

      <template v-else-if="phase === 'streaming'">
        <div class="advice-section-title">生成中…</div>
        <div class="advice-stream">{{ streamText || '正在聚合审批上下文…' }}</div>
      </template>

      <template v-else-if="phase === 'error'">
        <ElAlert :title="errorMsg" type="error" :closable="false" show-icon />
      </template>

      <template v-else-if="conclusion">
        <div class="advice-section-title">
          结论
          <ElTag :type="conclusionTag" disable-transitions style="margin-left: 8px">
            {{ conclusionLabel }}
          </ElTag>
        </div>
        <div class="advice-reason">{{ reason || '（无理由说明）' }}</div>
        <template v-if="references.length > 0">
          <div class="advice-section-title">制度依据</div>
          <div v-for="(ref, i) in references" :key="ref.chunkId ?? i" class="advice-ref">
            <div class="advice-ref-name">[{{ i + 1 }}] {{ ref.fileName ?? '未知来源' }}</div>
            <div class="advice-ref-quote">{{ ref.quote }}</div>
          </div>
        </template>
        <div v-else class="advice-no-ref">未检索到相关制度依据</div>
        <div v-if="latestAdvice?.createTime && phase === 'idle'" class="advice-time">
          最近生成于 {{ latestAdvice.createTime }}
        </div>
      </template>

      <div v-else class="advice-empty">点击「生成建议」，AI 将聚合审批上下文与制度依据给出参考结论</div>
    </div>
  </ElDrawer>
</template>

<style scoped>
.advice-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.advice-disclaimer {
  flex-shrink: 0;
}

.advice-toolbar {
  display: flex;
  gap: 8px;
}

.advice-section-title {
  font-weight: 600;
  font-size: 14px;
  margin-top: 4px;
}

.advice-stream {
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.7;
  max-height: 50vh;
  overflow-y: auto;
}

.advice-reason {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.advice-ref {
  border-left: 3px solid var(--el-color-primary-light-5);
  padding: 6px 10px;
  margin-bottom: 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 0 4px 4px 0;
}

.advice-ref-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.advice-ref-quote {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.advice-no-ref,
.advice-empty,
.advice-time {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
  padding: 12px 0;
}

.advice-time {
  text-align: right;
  padding: 0;
}
</style>
