<script setup lang="ts">
defineOptions({ name: 'AiCodingReview' });
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElEmpty,
  ElMessage,
  ElMessageBox,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import type {
  CodingLocateCandidateVO,
  CodingLocatePreciseVO,
  CodingSessionVO,
} from '@pivotos/types';
import { applyCodingSession, getCodingSession } from '@/api/ai/coding';

const route = useRoute();
const router = useRouter();

const session = ref<CodingSessionVO>();
const loading = ref(false);
const applying = ref(false);

const STATUS_MAP: Record<number, { label: string; type: 'info' | 'warning' | 'success' | 'danger' }> = {
  0: { label: '解析中', type: 'info' },
  1: { label: '待评审', type: 'warning' },
  2: { label: '已应用', type: 'success' },
  3: { label: '失败', type: 'danger' },
};

type DiffRowType = 'meta' | 'hunk' | 'add' | 'del' | 'ctx';
interface DiffRow {
  type: DiffRowType;
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

/** unified diff 逐行着色：行号按 hunk 头计数推进，行内容按首字符定性 */
const diffRows = computed<DiffRow[]>(() => {
  const raw = session.value?.diff;
  if (!raw) return [];
  let oldNo = 0;
  let newNo = 0;
  return raw.split('\n').map((line) => {
    if (line.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      oldNo = m ? Number(m[1]) : oldNo;
      newNo = m ? Number(m[2]) : newNo;
      return { type: 'hunk' as DiffRowType, text: line, oldNo: null, newNo: null };
    }
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
      return { type: 'meta' as DiffRowType, text: line, oldNo: null, newNo: null };
    }
    if (line.startsWith('+')) {
      return { type: 'add' as DiffRowType, text: line.slice(1), oldNo: null, newNo: newNo++ };
    }
    if (line.startsWith('-')) {
      return { type: 'del' as DiffRowType, text: line.slice(1), oldNo: oldNo++, newNo: null };
    }
    // 上下文行保留前导空格（可能有空行用例），统一去一个首字符
    const text = line.startsWith(' ') || line.startsWith('\\') ? line.slice(1) : line;
    return { type: 'ctx' as DiffRowType, text, oldNo: oldNo++, newNo: newNo++ };
  });
});

const stat = computed(() => ({
  add: diffRows.value.filter((r) => r.type === 'add').length,
  del: diffRows.value.filter((r) => r.type === 'del').length,
}));

const locate = computed(() => session.value?.locate);
const chosen = computed<CodingLocatePreciseVO | undefined>(() => locate.value?.chosen ?? undefined);
const ranked = computed<CodingLocatePreciseVO[]>(() => locate.value?.precise ?? []);
const candidates = computed<CodingLocateCandidateVO[]>(() => locate.value?.candidates ?? []);
const blocks = computed(() => session.value?.edit?.blocks ?? []);
const targetPath = computed(() => chosen.value?.path ?? session.value?.edit?.path ?? '-');

/** 仲裁分项（保留原始权重口径，便于复盘为什么选中它） */
const scoreParts = computed(() => {
  const c = chosen.value;
  if (!c) return [];
  return [
    { label: '自评置信度 0.50', value: c.confidence ?? 0 },
    { label: '符号命中 0.30', value: c.symbolHit ?? 0 },
    { label: '分层因子 0.20', value: c.layerFactor ?? 0 },
    { label: '仲裁综合分', value: c.score ?? 0 },
  ];
});

async function load() {
  const id = String(route.query.id ?? '');
  if (!id) {
    ElMessage.error('缺少会话 ID');
    return;
  }
  loading.value = true;
  try {
    session.value = await getCodingSession(id);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

/** 通过：接既有 apply 端点（taskType=5 走 ModifyApplyService，强制白名单 + 编译/typecheck 门禁，不过即回滚） */
async function handleApprove() {
  if (!session.value?.id) return;
  await ElMessageBox.confirm(
    `确定将本次改动写入 ${targetPath.value} 吗？写入后会立即执行编译/类型检查门禁，不通过会自动回滚。`,
    '确认应用',
    { confirmButtonText: '确定写入', cancelButtonText: '取消', type: 'warning' },
  );
  applying.value = true;
  try {
    await applyCodingSession(session.value.id);
    ElMessage.success('已写入工程并通过门禁');
    await load();
  } finally {
    applying.value = false;
  }
}

/** 打回：不落盘，返回列表（会话保留待评审态，便于重跑或人工再评审） */
async function handleReject() {
  await ElMessageBox.confirm('打回后本次改动不会写入工程，会话保留为待评审状态。', '确认打回', {
    confirmButtonText: '确定打回',
    cancelButtonText: '取消',
    type: 'warning',
  });
  router.push('/ai/coding');
}

function pct(value?: number) {
  return `${Math.round((value ?? 0) * 100)}%`;
}
</script>

<template>
  <div v-loading="loading" class="page-card">
    <template v-if="session">
      <div class="review-head">
        <div class="review-head__title">AI Coding 评审</div>
        <ElTag :type="STATUS_MAP[session.status ?? 0].type" disable-transitions>
          {{ STATUS_MAP[session.status ?? 0].label }}
        </ElTag>
        <div class="review-head__actions">
          <ElButton
            v-if="session.status === 1"
            v-hasPermi="'ai:coding:apply'"
            type="warning"
            :loading="applying"
            @click="handleApprove"
          >
            通过并写入工程
          </ElButton>
          <ElButton v-if="session.status === 1" @click="handleReject">打回</ElButton>
          <ElButton @click="router.push('/ai/coding')">返回列表</ElButton>
        </div>
      </div>

      <ElDescriptions :column="4" border size="small" class="review-meta">
        <ElDescriptionsItem label="改动意图">{{ session.description || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="目标仓库">{{ locate?.repo || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="改动文件">{{ targetPath }}</ElDescriptionsItem>
        <ElDescriptionsItem label="任务类型">
          {{ session.taskType === 5 ? '修改型（A4）' : session.taskType }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="选中方法">{{ chosen?.method || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="行区间">
          {{ chosen?.startLine && chosen?.endLine ? `${chosen.startLine} - ${chosen.endLine}` : '-' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="分层">{{ chosen?.layer || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="索引/耗时">
          {{ locate?.indexSize ?? '-' }} 文件 / {{ locate?.costMs ?? '-' }} ms
        </ElDescriptionsItem>
      </ElDescriptions>

      <!-- 定位结论：选中项 + 仲裁分项 + 候选 -->
      <div class="review-section">
        <div class="review-section__title">
          定位结论
          <ElTag v-if="locate?.fallback" type="danger" size="small" disable-transitions>降级选中</ElTag>
        </div>
        <div v-if="chosen" class="review-score">
          <div v-for="p in scoreParts" :key="p.label" class="review-score__item">
            <span class="review-score__label">{{ p.label }}</span>
            <span class="review-score__value">{{ pct(p.value) }}</span>
          </div>
        </div>
        <div v-if="chosen?.reason" class="review-reason">选中理由：{{ chosen.reason }}</div>
        <ElTable v-if="ranked.length" :data="ranked" size="small" border class="review-table">
          <ElTableColumn prop="path" label="候选路径" min-width="280" show-overflow-tooltip />
          <ElTableColumn prop="method" label="方法" width="140" />
          <ElTableColumn prop="layer" label="分层" width="120" />
          <ElTableColumn label="行区间" width="110">
            <template #default="{ row }">
              {{ (row as CodingLocatePreciseVO).startLine ?? '-' }} - {{ (row as CodingLocatePreciseVO).endLine ?? '-' }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="仲裁分" width="90" align="center">
            <template #default="{ row }">{{ pct((row as CodingLocatePreciseVO).score) }}</template>
          </ElTableColumn>
          <ElTableColumn label="适用" width="74" align="center">
            <template #default="{ row }">
              <ElTag :type="(row as CodingLocatePreciseVO).applicable ? 'success' : 'info'" size="small" disable-transitions>
                {{ (row as CodingLocatePreciseVO).applicable ? '是' : '否' }}
              </ElTag>
            </template>
          </ElTableColumn>
        </ElTable>
        <div v-if="candidates.length" class="review-candidates">
          粗筛候选 {{ candidates.length }} 个：
          <span v-for="c in candidates" :key="c.path + (c.source ?? '')" class="review-candidates__item">
            {{ c.path?.split('/').pop() }}（{{ c.source }} {{ pct(c.confidence) }}）
          </span>
        </div>
      </div>

      <!-- 变更说明 -->
      <div class="review-section">
        <div class="review-section__title">变更说明</div>
        <div class="review-reason">{{ session.description || '-' }}</div>
        <div v-for="(b, i) in blocks" :key="i" class="review-reason">
          {{ i + 1 }}. {{ b.reason || '（模型未给出理由）' }}
        </div>
      </div>

      <!-- 结构化 edit 指令 -->
      <div class="review-section">
        <div class="review-section__title">结构化 edit 指令（{{ blocks.length }} 块）</div>
        <div v-for="(b, i) in blocks" :key="i" class="review-block">
          <div class="review-block__head">
            <ElTag size="small" disable-transitions>{{ b.append ? '追加' : b.replace ? '替换' : '删除' }}</ElTag>
            <span v-if="!b.append && (b.occurrence ?? 0) > 0">第 {{ b.occurrence }} 处命中</span>
          </div>
          <div class="review-block__pair">
            <div class="review-block__code is-old"><pre>{{ b.search }}</pre></div>
            <div class="review-block__code is-new"><pre>{{ b.replace }}</pre></div>
          </div>
        </div>
      </div>

      <!-- diff 视图 -->
      <div class="review-section">
        <div class="review-section__title">
          Diff
          <span class="review-section__stat">+{{ stat.add }} / -{{ stat.del }}</span>
        </div>
        <div v-if="diffRows.length" class="review-diff">
          <div v-for="(row, i) in diffRows" :key="i" class="review-diff__row" :class="`is-${row.type}`">
            <span class="review-diff__no">{{ row.oldNo ?? '' }}</span>
            <span class="review-diff__no">{{ row.newNo ?? '' }}</span>
            <span class="review-diff__sign">
              {{ row.type === 'add' ? '+' : row.type === 'del' ? '-' : '' }}
            </span>
            <span class="review-diff__text">{{ row.text }}</span>
          </div>
        </div>
        <ElEmpty v-else description="无 diff 内容" />
      </div>

      <!-- 门禁结果 -->
      <div class="review-section">
        <div class="review-section__title">门禁结果</div>
        <div class="review-gate">
          <ElTag :type="session.gate?.applyCheck ? 'success' : 'danger'" disable-transitions>
            git apply --check：{{ session.gate?.applyCheck ? '通过' : '未通过' }}
          </ElTag>
          <ElTag v-if="session.gate?.recountUsed" type="warning" disable-transitions>--recount 兜底</ElTag>
          <ElTag v-if="session.status === 2" type="success" disable-transitions>已落盘并通过编译门禁</ElTag>
        </div>
        <div v-if="session.gate?.message" class="review-reason">{{ session.gate.message }}</div>
        <div class="review-reason review-reason--tip">
          编译 / typecheck 门禁在点「通过并写入工程」时执行（后端 mvn compile / pnpm typecheck），不通过即刻回滚。
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 12px;
}

.review-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.review-head__title {
  font-size: 16px;
  font-weight: 600;
}

.review-head__actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.review-meta {
  margin-top: 16px;
}

.review-section {
  margin-top: 20px;
  border-top: 1px solid #ebeef5;
  padding-top: 14px;
}

.review-section__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.review-section__stat {
  font-weight: 400;
  font-size: 13px;
  color: #67c23a;
}

.review-score {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.review-score__item {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 13px;
  display: flex;
  gap: 8px;
}

.review-score__label {
  color: #909399;
}

.review-reason {
  color: #606266;
  font-size: 13px;
  line-height: 1.8;
}

.review-reason--tip {
  color: #909399;
}

.review-candidates {
  margin-top: 10px;
  color: #909399;
  font-size: 13px;
  line-height: 1.8;
}

.review-candidates__item {
  margin-right: 10px;
}

.review-table {
  margin-top: 10px;
}

.review-block {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
}

.review-block__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.review-block__pair {
  display: flex;
  gap: 10px;
}

.review-block__code {
  flex: 1;
  border-radius: 4px;
  overflow: auto;
  max-height: 220px;
}

.review-block__code.is-old {
  background: #fef0f0;
}

.review-block__code.is-new {
  background: #f0f9eb;
}

.review-block__code pre {
  margin: 0;
  padding: 8px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.review-diff {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: auto;
  max-height: 520px;
  background: #fafafa;
}

.review-diff__row {
  display: flex;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.7;
  white-space: pre;
}

.review-diff__no {
  width: 52px;
  flex: none;
  text-align: right;
  padding-right: 8px;
  color: #b1b3b8;
  user-select: none;
}

.review-diff__sign {
  width: 16px;
  flex: none;
  text-align: center;
}

.review-diff__text {
  padding-right: 12px;
}

.review-diff__row.is-add {
  background: #f0f9eb;
  color: #2a7a3b;
}

.review-diff__row.is-del {
  background: #fef0f0;
  color: #a33;
}

.review-diff__row.is-hunk {
  background: #ecf5ff;
  color: #409eff;
}

.review-diff__row.is-meta {
  color: #909399;
}

.review-gate {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
</style>
