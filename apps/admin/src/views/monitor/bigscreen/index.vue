<script setup lang="ts">
/**
 * 数据大屏（S71 PL-REPORT 一期）：暗色全屏展示，数据复用 /monitor/dashboard/summary。
 * ESC 退出回到工作台；进入时拉取一次，不做轮询。
 */
defineOptions({ name: 'MonitorBigscreen' });
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { EChartsOption } from 'echarts';
import type { DashboardSummaryVO } from '@pivotos/types';
import { getDashboardSummary } from '@/api/monitor/dashboard';
import BaseChart from '@/components/BaseChart.vue';

const router = useRouter();

/** Long 序列化为字符串，统一转数值供图表使用 */
function toNum(value: string | number | undefined | null): number {
  return Number(value ?? 0);
}

/** 字节数人类可读格式 */
function formatBytes(bytes: string | number | undefined | null): string {
  let size = toNum(bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

// ---------- 数据 ----------
const summary = ref<DashboardSummaryVO>();

onMounted(async () => {
  summary.value = await getDashboardSummary();
});

// ---------- 实时时钟 ----------
const clock = ref('');
let clockTimer: number | undefined;

function tick(): void {
  const now = new Date();
  clock.value = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ---------- ESC 退出 ----------
function exit(): void {
  router.push('/home');
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    exit();
  }
}

// ---------- 浏览器全屏（页面在 Layout 内，用 Fullscreen API 实现沉浸展示） ----------
const isFullscreen = ref(false);

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // 无用户手势等场景静默降级为大屏布局内展示
  }
}

function onFullscreenChange(): void {
  isFullscreen.value = Boolean(document.fullscreenElement);
}

onMounted(async () => {
  tick();
  clockTimer = window.setInterval(tick, 1000);
  window.addEventListener('keydown', onKeydown);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  // 从工作台按钮跳转时用户手势仍有效，自动进入全屏
  await toggleFullscreen();
});

onBeforeUnmount(() => {
  if (clockTimer !== undefined) {
    window.clearInterval(clockTimer);
  }
  window.removeEventListener('keydown', onKeydown);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  // 离开页面时若仍处于全屏则退出，避免其他页面被全屏包裹
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
  }
});

// ---------- 头部统计 ----------
const headerStats = computed(() => [
  { label: '用户总数', value: summary.value?.system?.userCount },
  { label: '在线用户', value: summary.value?.onlineUsers },
  { label: '今日登录', value: summary.value?.system?.todayLogins },
  { label: 'AI 会话', value: summary.value?.ai?.conversationCount },
  { label: '文件数', value: summary.value?.file?.fileCount },
]);

// ---------- 图表 option ----------
const AXIS_STYLE = {
  axisLine: { lineStyle: { color: '#4a5568' } },
  axisLabel: { color: '#9aa7bd' },
};

const FLOW_STATUS_NAMES: Record<string, string> = {
  '0': '待提交',
  '1': '审批中',
  '2': '审批通过',
  '4': '终止',
  '5': '作废',
  '6': '撤销',
  '8': '已完成',
  '9': '已退回',
  '10': '失效',
  '11': '拿回',
};

const loginTrendOption = computed<EChartsOption>(() => {
  const points = summary.value?.loginTrend ?? [];
  return {
    title: { text: '近 7 日登录趋势', left: 'center', textStyle: { fontSize: 14, color: '#dfe7f3' } },
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 16, top: 44, bottom: 26 },
    xAxis: { type: 'category', data: points.map((p) => p.date.slice(5)), ...AXIS_STYLE },
    yAxis: { type: 'value', minInterval: 1, ...AXIS_STYLE, splitLine: { lineStyle: { color: '#2d3a50' } } },
    series: [
      {
        name: '登录次数',
        type: 'line',
        smooth: true,
        itemStyle: { color: '#40d8ff' },
        areaStyle: { opacity: 0.2 },
        data: points.map((p) => toNum(p.value)),
      },
    ],
  };
});

const aiTrendOption = computed<EChartsOption>(() => {
  const points = summary.value?.ai?.messageTrend ?? [];
  return {
    title: { text: 'AI 消息近 7 日趋势', left: 'center', textStyle: { fontSize: 14, color: '#dfe7f3' } },
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 16, top: 44, bottom: 26 },
    xAxis: { type: 'category', data: points.map((p) => p.date.slice(5)), ...AXIS_STYLE },
    yAxis: { type: 'value', minInterval: 1, ...AXIS_STYLE, splitLine: { lineStyle: { color: '#2d3a50' } } },
    series: [
      {
        name: '消息数',
        type: 'line',
        smooth: true,
        itemStyle: { color: '#9a6bff' },
        areaStyle: { opacity: 0.2 },
        data: points.map((p) => toNum(p.value)),
      },
    ],
  };
});

const workflowOption = computed<EChartsOption>(() => {
  const counts = summary.value?.workflow?.statusCounts ?? {};
  return {
    title: { text: '工作流实例状态分布', left: 'center', textStyle: { fontSize: 14, color: '#dfe7f3' } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#9aa7bd' }, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['32%', '58%'],
        center: ['50%', '50%'],
        label: { color: '#9aa7bd' },
        data: Object.entries(counts).map(([code, value]) => ({
          name: FLOW_STATUS_NAMES[code] ?? `状态${code}`,
          value: toNum(value),
        })),
      },
    ],
  };
});

const fileOption = computed<EChartsOption>(() => {
  const file = summary.value?.file;
  return {
    title: { text: '文件存储', left: 'center', textStyle: { fontSize: 14, color: '#dfe7f3' } },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 16, top: 44, bottom: 26 },
    xAxis: { type: 'value', minInterval: 1, ...AXIS_STYLE, splitLine: { lineStyle: { color: '#2d3a50' } } },
    yAxis: { type: 'category', data: ['文件数'], ...AXIS_STYLE },
    series: [
      {
        type: 'bar',
        barWidth: 20,
        itemStyle: { color: '#3ecf8e' },
        label: { show: true, position: 'right', color: '#dfe7f3' },
        data: [toNum(file?.fileCount)],
      },
    ],
  };
});

const kbOption = computed<EChartsOption>(() => {
  const kb = summary.value?.kb;
  return {
    title: { text: '知识库规模', left: 'center', textStyle: { fontSize: 14, color: '#dfe7f3' } },
    tooltip: { trigger: 'axis' },
    grid: { left: 76, right: 16, top: 44, bottom: 26 },
    xAxis: { type: 'value', minInterval: 1, ...AXIS_STYLE, splitLine: { lineStyle: { color: '#2d3a50' } } },
    yAxis: { type: 'category', data: ['知识库', '文档', '分块', '评测记录'], ...AXIS_STYLE },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        itemStyle: { color: '#40d8ff' },
        data: [
          toNum(kb?.baseCount),
          toNum(kb?.documentCount),
          toNum(kb?.chunkCount),
          toNum(kb?.evalRecordCount),
        ],
      },
    ],
  };
});

const keyHealthOption = computed<EChartsOption>(() => {
  const ai = summary.value?.ai;
  const active = toNum(ai?.activeKeyCount);
  const unhealthy = toNum(ai?.unhealthyKeyCount);
  const healthy = Math.max(active - unhealthy, 0);
  return {
    title: { text: 'Key 健康度', left: 'center', textStyle: { fontSize: 14, color: '#dfe7f3' } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#9aa7bd' } },
    series: [
      {
        type: 'pie',
        radius: ['45%', '65%'],
        center: ['50%', '50%'],
        label: { color: '#9aa7bd' },
        data: [
          { name: '健康', value: healthy, itemStyle: { color: '#3ecf8e' } },
          { name: '不健康', value: unhealthy, itemStyle: { color: '#ff6b6b' } },
        ],
      },
    ],
  };
});

const storageText = computed(() => formatBytes(summary.value?.file?.totalBytes));
</script>

<template>
  <div class="bigscreen">
    <header class="bigscreen__header">
      <div class="bigscreen__clock">{{ clock }}</div>
      <h1 class="bigscreen__title">PivotOS 运营数据大屏</h1>
      <div class="bigscreen__actions">
        <button class="bigscreen__exit" @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '进入全屏' }}
        </button>
        <button class="bigscreen__exit" @click="exit">ESC 退出</button>
      </div>
    </header>

    <section class="bigscreen__stats">
      <div v-for="item in headerStats" :key="item.label" class="bigscreen__stat">
        <div class="bigscreen__stat-value">{{ item.value ?? '-' }}</div>
        <div class="bigscreen__stat-label">{{ item.label }}</div>
      </div>
      <div class="bigscreen__stat">
        <div class="bigscreen__stat-value">{{ storageText }}</div>
        <div class="bigscreen__stat-label">存储用量</div>
      </div>
    </section>

    <section class="bigscreen__grid">
      <div class="bigscreen__panel">
        <BaseChart v-if="summary?.loginTrend" :option="loginTrendOption" dark />
      </div>
      <div class="bigscreen__panel">
        <BaseChart v-if="summary?.ai" :option="aiTrendOption" dark />
      </div>
      <div class="bigscreen__panel">
        <BaseChart v-if="summary?.workflow" :option="workflowOption" dark />
      </div>
      <div class="bigscreen__panel">
        <BaseChart v-if="summary?.file" :option="fileOption" dark />
      </div>
      <div class="bigscreen__panel">
        <BaseChart v-if="summary?.kb" :option="kbOption" dark />
      </div>
      <div class="bigscreen__panel">
        <BaseChart v-if="summary?.ai" :option="keyHealthOption" dark />
      </div>
    </section>
  </div>
</template>

<style scoped>
.bigscreen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px 24px;
  background: linear-gradient(180deg, #0b1220 0%, #101a2e 100%);
  color: #dfe7f3;
  overflow: auto;
}

.bigscreen__header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-bottom: 12px;
}

.bigscreen__title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 4px;
  text-align: center;
  background: linear-gradient(90deg, #40d8ff, #9a6bff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.bigscreen__clock {
  font-size: 14px;
  color: #9aa7bd;
  font-variant-numeric: tabular-nums;
}

.bigscreen__actions {
  display: flex;
  justify-self: end;
  gap: 8px;
}

.bigscreen__exit {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #4a5568;
  border-radius: 4px;
  color: #9aa7bd;
  font-size: 13px;
  cursor: pointer;
}

.bigscreen__exit:hover {
  border-color: #40d8ff;
  color: #40d8ff;
}

.bigscreen__stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.bigscreen__stat {
  flex: 1;
  padding: 12px 8px;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(74, 85, 104, 0.5);
  border-radius: 6px;
}

.bigscreen__stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #40d8ff;
  font-variant-numeric: tabular-nums;
}

.bigscreen__stat-label {
  margin-top: 4px;
  font-size: 13px;
  color: #9aa7bd;
}

.bigscreen__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.bigscreen__panel {
  min-height: 0;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(74, 85, 104, 0.5);
  border-radius: 6px;
}

@media (max-width: 1200px) {
  .bigscreen__grid {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
}
</style>
