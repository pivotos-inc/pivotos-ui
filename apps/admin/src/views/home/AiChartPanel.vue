<script setup lang="ts">
/**
 * AI 图表面板（S72 PL-REPORT 二期）：自然语言 → 后端 ChartSpec → 确定性装配 ECharts option。
 * option 一律由本页按 chartType 白名单装配，不直渲后端/AI 原始配置（规避 formatter 注入面）。
 */
defineOptions({ name: 'AiChartPanel' });
import { computed, ref } from 'vue';
import { ElButton, ElEmpty, ElIcon, ElInput } from 'element-plus';
import { MagicStick } from '@element-plus/icons-vue';
import type { EChartsOption } from 'echarts';
import type { AiChartSpecVO } from '@pivotos/types';
import { generateAiChart } from '@/api/monitor/dashboard';
import BaseChart from '@/components/BaseChart.vue';

const question = ref('');
const loading = ref(false);
const spec = ref<AiChartSpecVO>();
const errorMsg = ref('');

/** ChartSpec → ECharts option 确定性装配（chartType 已经后端白名单校验） */
const chartOption = computed<EChartsOption | undefined>(() => {
  const s = spec.value;
  if (!s) {
    return undefined;
  }
  const categories = s.categories ?? [];
  if (s.chartType === 'pie') {
    const first = s.series[0];
    return {
      title: { text: s.title ?? '', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          type: 'pie',
          radius: ['35%', '60%'],
          center: ['50%', '52%'],
          data: (first?.data ?? []).map((value, idx) => ({
            name: categories[idx] ?? `分类${idx + 1}`,
            value,
          })),
        },
      ],
    };
  }
  return {
    title: { text: s.title ?? '', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: s.series.length > 1 ? { bottom: 0 } : undefined,
    grid: { left: 44, right: 16, top: 48, bottom: s.series.length > 1 ? 40 : 28 },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value', minInterval: 1 },
    series: s.series.map((item) => ({
      name: item.name,
      type: s.chartType,
      smooth: s.chartType === 'line',
      areaStyle: s.chartType === 'line' ? { opacity: 0.15 } : undefined,
      data: item.data,
    })),
  };
});

async function generate(): Promise<void> {
  const text = question.value.trim();
  if (!text || loading.value) {
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  try {
    spec.value = await generateAiChart(text);
  } catch (err) {
    spec.value = undefined;
    errorMsg.value = err instanceof Error ? err.message : 'AI 图表生成失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="ai-chart">
    <div class="ai-chart__input-row">
      <ElInput
        v-model="question"
        placeholder="描述想看的图表，如：把登录趋势和 AI 消息趋势画成一张对比折线图"
        clearable
        :maxlength="200"
        @keyup.enter="generate"
      />
      <ElButton type="primary" :loading="loading" :disabled="!question.trim()" @click="generate">
        <ElIcon class="ai-chart__icon"><MagicStick /></ElIcon>
        AI 生成
      </ElButton>
    </div>

    <div class="ai-chart__box">
      <BaseChart v-if="chartOption" :option="chartOption" />
      <div v-else-if="loading" class="ai-chart__hint">AI 正在分析数据并生成图表…</div>
      <div v-else-if="errorMsg" class="ai-chart__hint ai-chart__hint--error">{{ errorMsg }}</div>
      <ElEmpty v-else description="输入一句话，AI 帮你把运营数据画成图表" :image-size="60" />
    </div>

    <div v-if="spec?.explanation" class="ai-chart__explanation">{{ spec.explanation }}</div>
  </div>
</template>

<style scoped>
.ai-chart__input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.ai-chart__icon {
  margin-right: 4px;
}

.ai-chart__box {
  height: 300px;
}

.ai-chart__hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.ai-chart__hint--error {
  color: var(--el-color-danger);
}

.ai-chart__explanation {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
