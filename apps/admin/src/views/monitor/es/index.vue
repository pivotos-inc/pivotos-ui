<script setup lang="ts">
defineOptions({ name: 'MonitorEs' });
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  ElAlert,
  ElButton,
  ElCard,
  ElCol,
  ElDescriptions,
  ElDescriptionsItem,
  ElMessage,
  ElProgress,
  ElRow,
  ElTag,
} from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { YTable } from '@pivotos/ui';
import type { YTableColumn } from '@pivotos/ui';
import type { EsIndexInfo, EsInfoVO, EsNodeInfo } from '@pivotos/types';
import { getEsInfo } from '@/api/monitor/es';

/** 轮询间隔（毫秒）：ES 指标变化平缓，30s 足够，避免频繁打集群 */
const POLL_INTERVAL_MS = 30_000;

// ---------- 数据 ----------
const loading = ref(false);
const info = ref<EsInfoVO | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

async function load(silent = false): Promise<void> {
  loading.value = true;
  try {
    info.value = await getEsInfo();
  } catch {
    // 后端降级时仍返回 code=0，走到这里说明接口本身异常；保留上一次快照以免页面抖动
    if (!silent) ElMessage.error('ES 监控数据加载失败');
  } finally {
    loading.value = false;
  }
}

function stopPolling(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}

onMounted(() => {
  void load();
  timer = setInterval(() => void load(true), POLL_INTERVAL_MS);
});

onBeforeUnmount(stopPolling);

// ---------- 展示辅助 ----------
const HEALTH_TAG_TYPE: Record<string, 'success' | 'warning' | 'danger'> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
};

const HEALTH_TEXT: Record<string, string> = {
  green: '健康（green）',
  yellow: '亚健康（yellow）',
  red: '异常（red）',
};

/** 生效实现：simple 时提示未连 ES，es-java / easy-es 时展示实现名 */
const implementationText = computed(() => {
  const impl = info.value?.implementation;
  if (impl === 'es-java') return 'es-java（官方客户端 8.19.x）';
  if (impl === 'easy-es') return 'easy-es（面向 ES 7.17）';
  if (impl === 'simple') return 'simple（内存兜底，未连 ES）';
  return impl ?? '-';
});

const statusText = computed(() => {
  const status = info.value?.status;
  return status ? (HEALTH_TEXT[status] ?? status) : '-';
});

function num(value?: string | number | null): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value) || 0;
}

function heapPercent(): number {
  const used = num(info.value?.jvmHeapUsedBytes);
  const max = num(info.value?.jvmHeapMaxBytes);
  if (max <= 0) return num(info.value?.jvmHeapUsedPercent);
  return Math.round((used / max) * 100);
}

function heapColor(percent: number): string {
  if (percent >= 85) return '#f56c6c';
  if (percent >= 70) return '#e6a23c';
  return '#67c23a';
}

function humanBytes(value?: string | number | null): string {
  const bytes = num(value);
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const nodeColumns: YTableColumn<EsNodeInfo>[] = [
  { prop: 'name', label: '节点', minWidth: 150, showOverflowTooltip: true },
  { prop: 'ip', label: 'IP', width: 150 },
  { prop: 'version', label: '版本', width: 100 },
  { prop: 'roles', label: '角色', width: 130, slot: 'roles' },
  { prop: 'master', label: '主节点', width: 90, align: 'center', slot: 'master' },
  { prop: 'heapPercent', label: '堆 %', width: 90, align: 'center' },
  { prop: 'ramPercent', label: '内存 %', width: 90, align: 'center' },
  { prop: 'cpu', label: 'CPU %', width: 90, align: 'center' },
  { prop: 'load1m', label: '负载 1m', width: 100, align: 'center' },
];

const indexColumns: YTableColumn<EsIndexInfo>[] = [
  { prop: 'index', label: '索引', minWidth: 200, showOverflowTooltip: true },
  { prop: 'health', label: '健康', width: 100, align: 'center', slot: 'health' },
  { prop: 'status', label: '状态', width: 90, align: 'center' },
  { prop: 'docsCount', label: '文档数', width: 110, align: 'right', slot: 'docsCount' },
  { prop: 'storeSizeBytes', label: '存储大小', width: 120, align: 'right', slot: 'storeSize' },
  { prop: 'pri', label: '主分片', width: 90, align: 'center' },
  { prop: 'rep', label: '副本', width: 80, align: 'center' },
];
</script>

<template>
  <div v-loading="loading" class="page-card es-monitor-page">
    <div class="es-monitor-page__bar">
      <span v-if="info?.collectedAt" class="es-monitor-page__time">
        数据截至 {{ info.collectedAt }}（每 30 秒自动刷新）
      </span>
      <ElButton :icon="Refresh" @click="load()">刷新</ElButton>
    </div>

    <!-- 不可用（simple / 未启用 / 连接不可达）：展示原因而不是报错 -->
    <ElAlert
      v-if="info && !info.available"
      class="es-monitor-page__alert"
      type="warning"
      :closable="false"
      show-icon
      :title="info.reason ?? 'ES 监控不可用'"
    >
      <template v-if="info.fallback">
        <div class="es-monitor-page__hint">
          配置实现 <b>{{ info.configuredType ?? '-' }}</b> 未生效，已回落
          <b>simple</b> 内存实现——检索仅在单进程内可见且重启即失。
        </div>
      </template>
    </ElAlert>

    <template v-if="info">
      <ElRow :gutter="12">
        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="集群概览">
            <ElDescriptions :column="1" border size="small">
              <ElDescriptionsItem label="集群健康">
                <ElTag v-if="info.status" :type="HEALTH_TAG_TYPE[info.status] ?? 'info'" size="small">
                  {{ statusText }}
                </ElTag>
                <span v-else>-</span>
              </ElDescriptionsItem>
              <ElDescriptionsItem label="集群名称">{{ info.clusterName ?? '-' }}</ElDescriptionsItem>
              <ElDescriptionsItem label="服务端版本">{{ info.serverVersion ?? '-' }}</ElDescriptionsItem>
              <ElDescriptionsItem label="节点数">{{ info.nodeCount }}</ElDescriptionsItem>
              <ElDescriptionsItem label="索引数">{{ info.indexCount }}</ElDescriptionsItem>
              <ElDescriptionsItem label="文档总数">{{ num(info.docCount) }}</ElDescriptionsItem>
              <ElDescriptionsItem label="存储大小">
                {{ info.storeSizeHuman ?? humanBytes(info.storeSizeBytes) }}
              </ElDescriptionsItem>
            </ElDescriptions>
          </ElCard>
        </ElCol>

        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="JVM 堆与分片">
            <div class="metric-grid">
              <div class="metric">
                <ElProgress
                  type="dashboard"
                  :percentage="heapPercent()"
                  :color="heapColor(heapPercent())"
                  :width="110"
                />
                <div class="metric__label">
                  JVM 堆使用率（{{ humanBytes(info.jvmHeapUsedBytes) }} /
                  {{ humanBytes(info.jvmHeapMaxBytes) }}）
                </div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ info.shardsActive }}</div>
                <div class="metric__label">
                  活跃分片（主分片 {{ info.shardsActivePrimary }}）
                </div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ info.shardsUnassigned }}</div>
                <div class="metric__label">未分配分片</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ info.shardsRelocating + info.shardsInitializing }}</div>
                <div class="metric__label">迁移中 / 初始化中</div>
              </div>
            </div>
          </ElCard>
        </ElCol>
      </ElRow>

      <ElRow :gutter="12">
        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="搜索实现">
            <ElDescriptions :column="1" border size="small">
              <ElDescriptionsItem label="当前生效">{{ implementationText }}</ElDescriptionsItem>
              <ElDescriptionsItem label="配置值">{{ info.configuredType ?? '-' }}</ElDescriptionsItem>
              <ElDescriptionsItem label="是否回落">
                <ElTag :type="info.fallback ? 'warning' : 'success'" size="small">
                  {{ info.fallback ? '已回落' : '未回落' }}
                </ElTag>
              </ElDescriptionsItem>
            </ElDescriptions>
          </ElCard>
        </ElCol>

        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="节点明细">
            <YTable
              :data="info.nodes ?? []"
              :columns="nodeColumns"
              hide-pagination
              :border="false"
            >
              <template #roles="{ row }">
                {{ (row as EsNodeInfo).roles ?? '-' }}
              </template>
              <template #master="{ row }">
                <ElTag :type="(row as EsNodeInfo).master ? 'success' : 'info'" size="small">
                  {{ (row as EsNodeInfo).master ? '主节点' : '-' }}
                </ElTag>
              </template>
              <template #empty>暂无节点数据</template>
            </YTable>
          </ElCard>
        </ElCol>
      </ElRow>

      <ElRow :gutter="12">
        <ElCol :span="24">
          <ElCard shadow="never" header="索引明细（系统内建索引不计入）">
            <YTable
              :data="info.indices ?? []"
              :columns="indexColumns"
              hide-pagination
              :border="false"
            >
              <template #health="{ row }">
                <ElTag
                  :type="HEALTH_TAG_TYPE[(row as EsIndexInfo).health ?? ''] ?? 'info'"
                  size="small"
                >
                  {{ (row as EsIndexInfo).health ?? '-' }}
                </ElTag>
              </template>
              <template #docsCount="{ row }">
                {{ num((row as EsIndexInfo).docsCount) }}
              </template>
              <template #storeSize="{ row }">
                {{ (row as EsIndexInfo).storeSizeHuman ?? humanBytes((row as EsIndexInfo).storeSizeBytes) }}
              </template>
              <template #empty>暂无索引数据</template>
            </YTable>
          </ElCard>
        </ElCol>
      </ElRow>
    </template>
  </div>
</template>

<style scoped>
.es-monitor-page__bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 12px;
}

.es-monitor-page__time {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.es-monitor-page__alert {
  margin-bottom: 12px;
}

.es-monitor-page__hint {
  margin-top: 4px;
  font-size: 13px;
}

.es-monitor-page :deep(.el-row) {
  margin-bottom: 12px;
}

.metric-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: space-around;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.metric__value {
  font-size: 28px;
  font-weight: 600;
  line-height: 110px;
}

.metric__label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-align: center;
}
</style>
