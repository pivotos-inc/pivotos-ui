<script setup lang="ts">
defineOptions({ name: 'Home' });
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElButton, ElCard, ElCol, ElEmpty, ElIcon, ElRow, ElSkeleton, ElTag } from 'element-plus';
import { Bell, MagicStick, Monitor } from '@element-plus/icons-vue';
import type { EChartsOption } from 'echarts';
import { YDialog } from '@pivotos/ui';
import type { DashboardSummaryVO, NoticeVO } from '@pivotos/types';
import { getPublishedNotice, listPublishedNotices } from '@/api/system/notice';
import { getDashboardSummary } from '@/api/monitor/dashboard';
import BaseChart from '@/components/BaseChart.vue';
import AiChartPanel from './AiChartPanel.vue';

const router = useRouter();

/** Long 序列化为字符串，统一转数值供图表使用 */
function toNum(value: string | number | undefined | null): number {
  return Number(value ?? 0);
}

// ---------- 看板聚合 ----------
const summaryLoading = ref(true);
const summary = ref<DashboardSummaryVO>();

/** warmflow 实例状态码 → 展示名（与后端 FlowInstance 口径一致） */
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

const statCards = computed(() => [
  { label: '用户总数', value: summary.value?.system?.userCount },
  { label: '今日登录', value: summary.value?.system?.todayLogins },
  { label: '在线用户', value: summary.value?.onlineUsers },
  { label: '流程待办', value: summary.value?.workflow?.pendingTasks },
  { label: '文件数', value: summary.value?.file?.fileCount },
  { label: 'AI 会话数', value: summary.value?.ai?.conversationCount },
]);

const loginTrendOption = computed<EChartsOption>(() => {
  const points = summary.value?.loginTrend ?? [];
  return {
    title: { text: '近 7 日登录趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 48, bottom: 28 },
    xAxis: { type: 'category', data: points.map((p) => p.date.slice(5)) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '登录次数',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.15 },
        data: points.map((p) => toNum(p.value)),
      },
    ],
  };
});

const workflowOption = computed<EChartsOption>(() => {
  const counts = summary.value?.workflow?.statusCounts ?? {};
  return {
    title: { text: '工作流实例状态分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['35%', '60%'],
        center: ['50%', '52%'],
        data: Object.entries(counts).map(([code, value]) => ({
          name: FLOW_STATUS_NAMES[code] ?? `状态${code}`,
          value: toNum(value),
        })),
      },
    ],
  };
});

const aiTrendOption = computed<EChartsOption>(() => {
  const points = summary.value?.ai?.messageTrend ?? [];
  return {
    title: { text: 'AI 消息近 7 日趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 48, bottom: 28 },
    xAxis: { type: 'category', data: points.map((p) => p.date.slice(5)) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '消息数',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.15 },
        data: points.map((p) => toNum(p.value)),
      },
    ],
  };
});

const kbOption = computed<EChartsOption>(() => {
  const kb = summary.value?.kb;
  return {
    title: { text: '知识库规模', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 16, top: 48, bottom: 28 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: {
      type: 'category',
      data: ['知识库', '文档', '分块', '评测记录'],
    },
    series: [
      {
        type: 'bar',
        barWidth: 18,
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

function goBigScreen(): void {
  router.push('/monitor/bigscreen');
}

onMounted(async () => {
  try {
    summary.value = await getDashboardSummary();
  } finally {
    summaryLoading.value = false;
  }
});

// ---------- 公告卡片 ----------
const noticeLoading = ref(true);
const notices = ref<NoticeVO[]>([]);

onMounted(async () => {
  try {
    notices.value = await listPublishedNotices(5);
  } finally {
    noticeLoading.value = false;
  }
});

// ---------- 公告详情 ----------
const detailVisible = ref(false);
const detail = ref<NoticeVO>();

async function openDetail(row: NoticeVO): Promise<void> {
  detail.value = await getPublishedNotice(row.id);
  detailVisible.value = true;
}
</script>

<template>
  <div class="home-page">
    <!-- 头部：标题 + 数据大屏入口 -->
    <div class="home-page__header">
      <span class="home-page__title">运营工作台</span>
      <ElButton type="primary" plain @click="goBigScreen">
        <ElIcon class="home-page__bigscreen-icon"><Monitor /></ElIcon>
        查看数据大屏
      </ElButton>
    </div>

    <!-- 统计卡片 -->
    <ElSkeleton v-if="summaryLoading" :rows="2" animated />
    <ElRow v-else :gutter="16">
      <ElCol v-for="card in statCards" :key="card.label" :xs="12" :sm="8" :md="4">
        <ElCard shadow="never" class="home-page__stat-card">
          <div class="home-page__stat-value">{{ card.value ?? '-' }}</div>
          <div class="home-page__stat-label">{{ card.label }}</div>
        </ElCard>
      </ElCol>
    </ElRow>

    <!-- 图表区 -->
    <ElRow :gutter="16" class="home-page__chart-row">
      <ElCol :xs="24" :md="12">
        <ElCard shadow="never">
          <div class="home-page__chart-box">
            <BaseChart v-if="summary?.loginTrend" :option="loginTrendOption" />
            <ElEmpty v-else description="暂无登录趋势数据" :image-size="60" />
          </div>
        </ElCard>
      </ElCol>
      <ElCol :xs="24" :md="12">
        <ElCard shadow="never">
          <div class="home-page__chart-box">
            <BaseChart v-if="summary?.workflow" :option="workflowOption" />
            <ElEmpty v-else description="暂无工作流数据" :image-size="60" />
          </div>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="16" class="home-page__chart-row">
      <ElCol :xs="24" :md="12">
        <ElCard shadow="never">
          <div class="home-page__chart-box">
            <BaseChart v-if="summary?.ai" :option="aiTrendOption" />
            <ElEmpty v-else description="暂无 AI 消息数据" :image-size="60" />
          </div>
        </ElCard>
      </ElCol>
      <ElCol :xs="24" :md="12">
        <ElCard shadow="never">
          <div class="home-page__chart-box">
            <BaseChart v-if="summary?.kb" :option="kbOption" />
            <ElEmpty v-else description="暂无知识库数据" :image-size="60" />
          </div>
        </ElCard>
      </ElCol>
    </ElRow>

    <!-- AI 图表（S72）：自然语言生成图表，需 monitor:dashboard:view 权限 -->
    <ElCard v-hasPermi="'monitor:dashboard:view'" shadow="never" class="home-page__chart-row">
      <template #header>
        <div class="home-page__card-header">
          <ElIcon><MagicStick /></ElIcon>
          <span>AI 图表</span>
        </div>
      </template>
      <AiChartPanel />
    </ElCard>

    <!-- 公告卡片 -->
    <ElCard shadow="never">
      <template #header>
        <div class="home-page__card-header">
          <ElIcon><Bell /></ElIcon>
          <span>通知公告</span>
        </div>
      </template>

      <ElSkeleton v-if="noticeLoading" :rows="4" animated />
      <ElEmpty v-else-if="notices.length === 0" description="暂无公告" :image-size="72" />
      <ul v-else class="home-page__notice-list">
        <li
          v-for="item in notices"
          :key="item.id"
          class="home-page__notice-item"
          @click="openDetail(item)"
        >
          <ElTag
            :type="item.noticeType === 1 ? 'primary' : 'warning'"
            size="small"
            disable-transitions
          >
            {{ item.noticeType === 1 ? '通知' : '公告' }}
          </ElTag>
          <span class="home-page__notice-title">{{ item.title }}</span>
          <span class="home-page__notice-time">{{ item.publishTime }}</span>
        </li>
      </ul>
    </ElCard>

    <YDialog v-model="detailVisible" :title="detail?.title ?? '公告详情'" width="640px" :show-footer="false">
      <div class="home-page__notice-meta">
        <ElTag
          :type="detail?.noticeType === 1 ? 'primary' : 'warning'"
          size="small"
          disable-transitions
        >
          {{ detail?.noticeType === 1 ? '通知' : '公告' }}
        </ElTag>
        <span>{{ detail?.publishTime }}</span>
      </div>
      <!-- 公告内容为管理端富文本编辑器产出的受控 HTML（仅管理员可写入） -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="home-page__notice-content" v-html="detail?.content || '<p>（无内容）</p>'" />
    </YDialog>
  </div>
</template>

<style scoped>
.home-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.home-page__title {
  font-size: 18px;
  font-weight: 600;
}

.home-page__bigscreen-icon {
  margin-right: 4px;
}

.home-page__stat-card {
  margin-bottom: 16px;
  text-align: center;
}

.home-page__stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.home-page__stat-label {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.home-page__chart-row {
  margin-bottom: 16px;
}

.home-page__chart-row :deep(.el-col) {
  margin-bottom: 0;
}

.home-page__chart-box {
  height: 300px;
}

.home-page__card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.home-page__notice-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-page__notice-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
}

.home-page__notice-item:last-child {
  border-bottom: none;
}

.home-page__notice-item:hover .home-page__notice-title {
  color: var(--el-color-primary);
}

.home-page__notice-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-page__notice-time {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.home-page__notice-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.home-page__notice-content {
  line-height: 1.7;
  word-break: break-word;
}

.home-page__notice-content :deep(img) {
  max-width: 100%;
}
</style>
