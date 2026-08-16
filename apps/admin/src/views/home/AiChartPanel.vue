<script setup lang="ts">
/**
 * AI 图表面板（S72 PL-REPORT 二期）：自然语言 → 后端 ChartSpec → 确定性装配 ECharts option。
 * option 一律由本页按 chartType 白名单装配，不直渲后端/AI 原始配置（规避 formatter 注入面）。
 */
defineOptions({ name: 'AiChartPanel' });
import { computed, ref } from 'vue';
import { ElButton, ElDialog, ElEmpty, ElIcon, ElInput, ElMessage, ElMessageBox, ElPagination, ElTag } from 'element-plus';
import { Clock, MagicStick, Star } from '@element-plus/icons-vue';
import type { EChartsOption } from 'echarts';
import type { AiChartHistoryVO, AiChartSpecVO } from '@pivotos/types';
import { deleteAiChart, generateAiChart, pageAiChartHistory, saveAiChart } from '@/api/monitor/dashboard';
import BaseChart from '@/components/BaseChart.vue';

/** dark：大屏暗色容器内使用（S73 F2），图表与提示文字走暗色样式 */
const props = defineProps<{ dark?: boolean }>();

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

// ==================== S83 保存 / 历史 ====================

const saving = ref(false);
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyList = ref<AiChartHistoryVO[]>([]);
const historyTotal = ref(0);
const historyPageNum = ref(1);

/** 收藏当前图表（spec 存在时可点） */
async function saveChart(): Promise<void> {
  if (!spec.value || saving.value) {
    return;
  }
  saving.value = true;
  try {
    await saveAiChart({ question: question.value.trim() || undefined, spec: spec.value });
    ElMessage.success('图表已保存，可在「历史」中查看');
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '图表保存失败');
  } finally {
    saving.value = false;
  }
}

async function loadHistory(): Promise<void> {
  historyLoading.value = true;
  try {
    const res = await pageAiChartHistory(historyPageNum.value, 10);
    historyList.value = res.list;
    historyTotal.value = Number(res.total) || 0;
  } catch {
    historyList.value = [];
    historyTotal.value = 0;
  } finally {
    historyLoading.value = false;
  }
}

function openHistory(): void {
  historyVisible.value = true;
  historyPageNum.value = 1;
  loadHistory();
}

/** 回放：解析 specJson 快照，仍走 chartOption 确定性装配（不直渲 raw option） */
function replay(item: AiChartHistoryVO): void {
  try {
    const s = JSON.parse(item.specJson) as AiChartSpecVO;
    if (!s || !s.chartType || !Array.isArray(s.series)) {
      throw new Error('invalid spec');
    }
    spec.value = s;
    if (item.question) {
      question.value = item.question;
    }
    historyVisible.value = false;
    errorMsg.value = '';
  } catch {
    ElMessage.error('图表数据已损坏，无法回放');
  }
}

async function removeHistory(item: AiChartHistoryVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除图表「${item.title ?? item.question ?? item.id}」？`, '删除确认', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await deleteAiChart(item.id);
  ElMessage.success('已删除');
  loadHistory();
}

const CHART_TYPE_LABEL: Record<string, string> = { line: '折线图', bar: '柱状图', pie: '饼图' };
</script>

<template>
  <div class="ai-chart" :class="{ 'ai-chart--dark': props.dark }">
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
      <ElButton :disabled="!spec" :loading="saving" @click="saveChart">
        <ElIcon class="ai-chart__icon"><Star /></ElIcon>
        保存
      </ElButton>
      <ElButton @click="openHistory">
        <ElIcon class="ai-chart__icon"><Clock /></ElIcon>
        历史
      </ElButton>
    </div>

    <div class="ai-chart__box">
      <BaseChart v-if="chartOption" :option="chartOption" :dark="props.dark" />
      <div v-else-if="loading" class="ai-chart__hint">AI 正在分析数据并生成图表…</div>
      <div v-else-if="errorMsg" class="ai-chart__hint ai-chart__hint--error">{{ errorMsg }}</div>
      <ElEmpty v-else description="输入一句话，AI 帮你把运营数据画成图表" :image-size="60" />
    </div>

    <div v-if="spec?.explanation" class="ai-chart__explanation">{{ spec.explanation }}</div>

    <!-- S83 我的图表历史：点击回放 spec 快照，支持删除 -->
    <ElDialog v-model="historyVisible" title="我的图表历史" width="560px" append-to-body>
      <div v-loading="historyLoading" class="ai-chart__history">
        <ElEmpty v-if="!historyLoading && historyList.length === 0" description="暂无保存的图表" :image-size="50" />
        <div v-for="item in historyList" :key="item.id" class="ai-chart__history-item">
          <div class="ai-chart__history-info">
            <div class="ai-chart__history-title">{{ item.title || item.question || '未命名图表' }}</div>
            <div class="ai-chart__history-meta">
              <ElTag size="small" type="info">{{ CHART_TYPE_LABEL[item.chartType] ?? item.chartType }}</ElTag>
              <span>{{ item.createTime }}</span>
            </div>
          </div>
          <div class="ai-chart__history-actions">
            <ElButton size="small" type="primary" link @click="replay(item)">回放</ElButton>
            <ElButton size="small" type="danger" link @click="removeHistory(item)">删除</ElButton>
          </div>
        </div>
        <ElPagination
          v-if="historyTotal > 10"
          class="ai-chart__history-page"
          layout="prev, pager, next"
          :total="historyTotal"
          :page-size="10"
          :current-page="historyPageNum"
          @current-change="(page: number) => { historyPageNum = page; loadHistory(); }"
        />
      </div>
    </ElDialog>
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

/* 暗色容器（大屏 Drawer，S73 F2）：提示与说明文字走暗色系 */
.ai-chart--dark .ai-chart__hint {
  color: #9aa7bd;
}

.ai-chart--dark .ai-chart__explanation {
  color: #9aa7bd;
}

.ai-chart__history {
  min-height: 120px;
}

.ai-chart__history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.ai-chart__history-item:last-child {
  border-bottom: none;
}

.ai-chart__history-title {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.ai-chart__history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.ai-chart__history-page {
  justify-content: center;
  margin-top: 12px;
}
</style>
