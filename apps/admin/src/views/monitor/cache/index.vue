<script setup lang="ts">
defineOptions({ name: 'MonitorCache' });
import { computed, onMounted, ref } from 'vue';
import { ElButton, ElCard, ElCol, ElDescriptions, ElDescriptionsItem, ElMessage, ElProgress, ElRow, ElTable, ElTableColumn } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import type { CacheInfoVO } from '@pivotos/types';
import { getCacheInfo } from '@/api/monitor/cache';

// ---------- 数据 ----------
const loading = ref(false);
const info = ref<CacheInfoVO | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    info.value = await getCacheInfo();
  } catch {
    ElMessage.error('缓存监控数据加载失败');
  } finally {
    loading.value = false;
  }
}

// ---------- 格式化 ----------
function formatSeconds(sec?: number): string {
  if (sec == null) return '-';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} 天 ${h} 小时 ${m} 分钟`;
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  return `${m} 分钟`;
}

const modeText = computed(() => {
  const mode = info.value?.redisMode;
  if (mode === 'standalone') return '单机';
  if (mode === 'cluster') return '集群';
  if (mode === 'sentinel') return '哨兵';
  return mode ?? '-';
});

/** 命令统计只展示调用量 Top 20，避免长表刷屏 */
const topCommandStats = computed(() => (info.value?.commandStats ?? []).slice(0, 20));

function hitColor(rate?: number): string {
  if (rate == null) return '#67c23a';
  if (rate < 50) return '#f56c6c';
  if (rate < 80) return '#e6a23c';
  return '#67c23a';
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="page-card cache-monitor-page">
    <div class="cache-monitor-page__bar">
      <ElButton :icon="Refresh" @click="load">刷新</ElButton>
    </div>

    <template v-if="info">
      <ElRow :gutter="12">
        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="基本信息">
            <ElDescriptions :column="1" border size="small">
              <ElDescriptionsItem label="Redis 版本">{{ info.redisVersion }}</ElDescriptionsItem>
              <ElDescriptionsItem label="运行模式">{{ modeText }}</ElDescriptionsItem>
              <ElDescriptionsItem label="端口">{{ info.tcpPort }}</ElDescriptionsItem>
              <ElDescriptionsItem label="进程 ID">{{ info.processId }}</ElDescriptionsItem>
              <ElDescriptionsItem label="运行环境">{{ info.os }}（{{ info.archBits }} 位）</ElDescriptionsItem>
              <ElDescriptionsItem label="已运行时长">{{ formatSeconds(info.uptimeInSeconds) }}</ElDescriptionsItem>
              <ElDescriptionsItem label="客户端连接">
                已连接 {{ info.connectedClients }} / 阻塞 {{ info.blockedClients }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="键值总数（DBSIZE）">{{ info.dbSize }}</ElDescriptionsItem>
            </ElDescriptions>
          </ElCard>
        </ElCol>

        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="内存与命中率">
            <div class="metric-grid">
              <div class="metric">
                <div class="metric__value">{{ info.usedMemoryHuman }}</div>
                <div class="metric__label">已用内存（峰值 {{ info.usedMemoryPeakHuman }}）</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ info.memFragmentationRatio }}</div>
                <div class="metric__label">内存碎片率</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ info.maxmemoryHuman }}</div>
                <div class="metric__label">内存上限（0B=不限制）</div>
              </div>
              <div class="metric">
                <ElProgress
                  type="dashboard"
                  :percentage="info.hitRate"
                  :color="hitColor(info.hitRate)"
                  :width="110"
                />
                <div class="metric__label">
                  缓存命中率（命中 {{ info.keyspaceHits }} / 未中 {{ info.keyspaceMisses }}）
                </div>
              </div>
            </div>
          </ElCard>
        </ElCol>
      </ElRow>

      <ElRow :gutter="12">
        <ElCol :xs="24" :md="10">
          <ElCard shadow="never" header="键空间">
            <ElTable :data="info.keyspace" size="small" empty-text="所有库均为空">
              <ElTableColumn prop="db" label="数据库" width="100" />
              <ElTableColumn prop="keys" label="键数量" width="110" />
              <ElTableColumn prop="expires" label="带过期时间" width="110" />
              <ElTableColumn prop="avgTtl" label="平均 TTL (ms)" min-width="120" />
            </ElTable>
          </ElCard>
        </ElCol>

        <ElCol :xs="24" :md="14">
          <ElCard shadow="never" header="命令统计（调用量 Top 20）">
            <ElTable :data="topCommandStats" size="small" max-height="360" empty-text="暂无命令调用记录">
              <ElTableColumn prop="name" label="命令" min-width="140" show-overflow-tooltip />
              <ElTableColumn prop="calls" label="调用次数" width="120" sortable />
              <ElTableColumn prop="usecPerCall" label="平均耗时 (µs)" width="130" />
            </ElTable>
          </ElCard>
        </ElCol>
      </ElRow>
    </template>
  </div>
</template>

<style scoped>
.cache-monitor-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.cache-monitor-page :deep(.el-row) {
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
