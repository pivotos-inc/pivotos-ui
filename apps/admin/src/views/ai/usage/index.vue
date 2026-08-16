<script setup lang="ts">
/**
 * AI 用量监控页（S92）：近 N 日 Token 调用量与消耗统计。
 * 数据全部来自 /ai/usage 聚合接口（后端 GROUP BY 下推），本页只做展示装配。
 */
defineOptions({ name: 'AiUsage' });
import { computed, onMounted, ref } from 'vue';
import { ElButton, ElCard, ElCol, ElEmpty, ElRadioButton, ElRadioGroup, ElRow, ElSkeleton, ElTag } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import type { EChartsOption } from 'echarts';
import { YTable } from '@pivotos/ui';
import type { YTableColumn } from '@pivotos/ui';
import type { AiUsageProviderVO, AiUsageSummaryVO, AiUsageUserVO } from '@pivotos/types';
import { getUsageByProvider, getUsageByUser, getUsageSummary } from '@/api/ai/usage';
import BaseChart from '@/components/BaseChart.vue';

/** 场景编码 → 中文标签（与 AiUsageContext 常量对齐） */
const SCENE_LABEL: Record<string, string> = {
  chat: '对话',
  rag: '知识库问答',
  coding: 'AI Coding',
  chart: 'AI 图表',
  other: '其他',
};

const days = ref(7);
const loading = ref(false);
const summary = ref<AiUsageSummaryVO>();
const providerRows = ref<AiUsageProviderVO[]>([]);
const userRows = ref<AiUsageUserVO[]>([]);

/** 千分位展示（后端 Long 序列化为字符串，先归一再格式化） */
function fmt(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return Number(value).toLocaleString('en-US');
}

const statCards = computed(() => [
  { label: '调用总次数', value: fmt(summary.value?.calls) },
  { label: '失败次数', value: fmt(summary.value?.failedCalls) },
  { label: 'Prompt Token', value: fmt(summary.value?.promptTokens) },
  { label: 'Completion Token', value: fmt(summary.value?.completionTokens) },
  { label: '总 Token', value: fmt(summary.value?.totalTokens) },
]);

/** 日趋势：调用次数（柱）+ Token 消耗（线）双轴 */
const trendOption = computed<EChartsOption>(() => {
  const trend = summary.value?.trend ?? [];
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 44, right: 56, top: 24, bottom: 40 },
    xAxis: { type: 'category', data: trend.map((t) => t.day) },
    yAxis: [
      { type: 'value', name: '调用次数', minInterval: 1 },
      { type: 'value', name: 'Token' },
    ],
    series: [
      { name: '调用次数', type: 'bar', data: trend.map((t) => Number(t.calls)), yAxisIndex: 0 },
      { name: 'Token 消耗', type: 'line', smooth: true, data: trend.map((t) => Number(t.totalTokens)), yAxisIndex: 1 },
    ],
  };
});

const sceneColumns: YTableColumn<AiUsageSummaryVO['byScene'][number]>[] = [
  { prop: 'scene', label: '场景', minWidth: 110, slot: 'scene' },
  { prop: 'calls', label: '调用次数', width: 100, align: 'center' },
  { prop: 'totalTokens', label: 'Token', minWidth: 100, align: 'center' },
];

const providerColumns: YTableColumn<AiUsageProviderVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'providerCode', label: '供应商', minWidth: 110 },
  { prop: 'keyLabel', label: 'Key', minWidth: 120, slot: 'key' },
  { prop: 'calls', label: '调用次数', width: 90, align: 'center' },
  { prop: 'promptTokens', label: 'Prompt', width: 90, align: 'center' },
  { prop: 'completionTokens', label: 'Completion', width: 110, align: 'center' },
  { prop: 'totalTokens', label: '总 Token', width: 90, align: 'center' },
];

const userColumns: YTableColumn<AiUsageUserVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'nickname', label: '用户', minWidth: 140, slot: 'user' },
  { prop: 'calls', label: '调用次数', width: 100, align: 'center' },
  { prop: 'totalTokens', label: '总 Token', minWidth: 110, align: 'center' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [s, p, u] = await Promise.all([
      getUsageSummary(days.value),
      getUsageByProvider(days.value),
      getUsageByUser(days.value),
    ]);
    summary.value = s;
    providerRows.value = p;
    userRows.value = u;
  } finally {
    loading.value = false;
  }
}

function handleDaysChange(): void {
  load();
}

onMounted(load);
</script>

<template>
  <div class="page-card">
    <div class="ai-usage__bar">
      <ElRadioGroup v-model="days" @change="handleDaysChange">
        <ElRadioButton :value="7">近 7 日</ElRadioButton>
        <ElRadioButton :value="14">近 14 日</ElRadioButton>
        <ElRadioButton :value="30">近 30 日</ElRadioButton>
        <ElRadioButton :value="90">近 90 日</ElRadioButton>
      </ElRadioGroup>
      <ElButton :icon="Refresh" :loading="loading" @click="load">刷新</ElButton>
    </div>

    <!-- 总量卡片 -->
    <ElSkeleton v-if="loading && !summary" :rows="2" animated />
    <ElRow v-else :gutter="16">
      <ElCol v-for="card in statCards" :key="card.label" :xs="12" :sm="8" :md="4">
        <ElCard shadow="never" class="ai-usage__stat-card">
          <div class="ai-usage__stat-value">{{ card.value }}</div>
          <div class="ai-usage__stat-label">{{ card.label }}</div>
        </ElCard>
      </ElCol>
    </ElRow>

    <!-- 场景分布 + 日趋势 -->
    <ElRow :gutter="16" class="ai-usage__chart-row">
      <ElCol :xs="24" :md="8">
        <ElCard shadow="never">
          <template #header>
            <span class="ai-usage__card-title">场景分布</span>
          </template>
          <YTable
            :loading="loading"
            :data="summary?.byScene ?? []"
            :columns="sceneColumns"
            row-key="scene"
            hide-pagination
            @refresh="load"
          >
            <template #scene="{ row }">
              <ElTag size="small">
                {{ SCENE_LABEL[(row as { scene: string }).scene] ?? (row as { scene: string }).scene }}
              </ElTag>
            </template>
          </YTable>
        </ElCard>
      </ElCol>
      <ElCol :xs="24" :md="16">
        <ElCard shadow="never">
          <template #header>
            <span class="ai-usage__card-title">日趋势（调用次数 × Token 消耗）</span>
          </template>
          <div class="ai-usage__chart-box">
            <BaseChart v-if="summary?.trend?.length" :option="trendOption" />
            <ElEmpty v-else description="暂无用量数据" :image-size="60" />
          </div>
        </ElCard>
      </ElCol>
    </ElRow>

    <!-- 供应商 × Key / 用户聚合 -->
    <ElRow :gutter="16" class="ai-usage__chart-row">
      <ElCol :xs="24" :md="12">
        <ElCard shadow="never">
          <template #header>
            <span class="ai-usage__card-title">按供应商 × Key</span>
          </template>
          <YTable
            :loading="loading"
            :data="providerRows"
            :columns="providerColumns"
            hide-pagination
            @refresh="load"
          >
            <template #key="{ row }">
              {{ (row as AiUsageProviderVO).keyLabel || ((row as AiUsageProviderVO).keyId ? `Key ${String((row as AiUsageProviderVO).keyId).slice(-6)}` : '静态兜底') }}
            </template>
          </YTable>
        </ElCard>
      </ElCol>
      <ElCol :xs="24" :md="12">
        <ElCard shadow="never">
          <template #header>
            <span class="ai-usage__card-title">按用户</span>
          </template>
          <YTable
            :loading="loading"
            :data="userRows"
            :columns="userColumns"
            hide-pagination
            @refresh="load"
          >
            <template #user="{ row }">
              {{ (row as AiUsageUserVO).nickname ?? (row as AiUsageUserVO).username ?? '未登录链路' }}
            </template>
          </YTable>
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<style scoped>
.ai-usage__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.ai-usage__stat-card {
  margin-bottom: 12px;
  text-align: center;
}

.ai-usage__stat-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.ai-usage__stat-label {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ai-usage__chart-row {
  margin-top: 4px;
}

.ai-usage__card-title {
  font-size: 14px;
  font-weight: 600;
}

.ai-usage__chart-box {
  height: 300px;
}
</style>
