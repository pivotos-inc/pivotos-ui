<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElButton, ElCard, ElCol, ElDescriptions, ElDescriptionsItem, ElMessage, ElProgress, ElRow, ElTable, ElTableColumn } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import type { ServerInfoVO } from '@pivotos/types';
import { getServerInfo } from '@/api/monitor/server';

// ---------- 数据 ----------
const loading = ref(false);
const info = ref<ServerInfoVO | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    info.value = await getServerInfo();
  } catch (e) {
    ElMessage.error('服务监控数据加载失败');
  } finally {
    loading.value = false;
  }
}

// ---------- 格式化 ----------
function formatBytes(bytes?: number): string {
  if (bytes == null || bytes < 0) return '-';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function formatUptime(ms?: number): string {
  if (ms == null) return '-';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} 天 ${h} 小时 ${m} 分钟`;
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  return `${m} 分钟`;
}

function usageColor(pct?: number): string {
  if (pct == null) return '#67c23a';
  if (pct >= 90) return '#f56c6c';
  if (pct >= 70) return '#e6a23c';
  return '#67c23a';
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="page-card server-monitor-page">
    <div class="server-monitor-page__bar">
      <ElButton :icon="Refresh" @click="load">刷新</ElButton>
    </div>

    <template v-if="info">
      <ElRow :gutter="12">
        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="CPU">
            <div class="metric-grid">
              <div class="metric">
                <div class="metric__value">{{ info.cpu.cpuNum }}</div>
                <div class="metric__label">逻辑核心（物理 {{ info.cpu.physicalNum }} 核）</div>
              </div>
              <div class="metric">
                <ElProgress type="dashboard" :percentage="info.cpu.used" :color="usageColor(info.cpu.used)" :width="110" />
                <div class="metric__label">用户使用率</div>
              </div>
              <div class="metric">
                <ElProgress type="dashboard" :percentage="info.cpu.sys" :color="usageColor(info.cpu.sys)" :width="110" />
                <div class="metric__label">系统使用率</div>
              </div>
              <div class="metric">
                <ElProgress type="dashboard" :percentage="info.cpu.idle" :width="110" color="#67c23a" />
                <div class="metric__label">空闲率</div>
              </div>
              <div class="metric">
                <ElProgress type="dashboard" :percentage="info.cpu.wait" :width="110" color="#e6a23c" />
                <div class="metric__label">IO 等待率</div>
              </div>
            </div>
          </ElCard>
        </ElCol>

        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="内存">
            <div class="metric-grid">
              <div class="metric">
                <ElProgress type="dashboard" :percentage="info.mem.usage" :color="usageColor(info.mem.usage)" :width="110" />
                <div class="metric__label">使用率</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ formatBytes(info.mem.total) }}</div>
                <div class="metric__label">总内存</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ formatBytes(info.mem.used) }}</div>
                <div class="metric__label">已使用</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ formatBytes(info.mem.free) }}</div>
                <div class="metric__label">剩余</div>
              </div>
            </div>
          </ElCard>
        </ElCol>
      </ElRow>

      <ElRow :gutter="12">
        <ElCol :xs="24" :md="12">
          <ElCard shadow="never" header="JVM">
            <ElDescriptions :column="1" border size="small">
              <ElDescriptionsItem label="名称">{{ info.jvm.name }}</ElDescriptionsItem>
              <ElDescriptionsItem label="版本">{{ info.jvm.version }}（{{ info.jvm.vendor }}）</ElDescriptionsItem>
              <ElDescriptionsItem label="启动时间">{{ info.jvm.startTime }}</ElDescriptionsItem>
              <ElDescriptionsItem label="运行时长">{{ formatUptime(info.jvm.uptimeMillis) }}</ElDescriptionsItem>
              <ElDescriptionsItem label="安装路径">{{ info.jvm.home }}</ElDescriptionsItem>
              <ElDescriptionsItem label="堆内存">
                已用 {{ formatBytes(info.jvm.heapUsed) }} / 提交 {{ formatBytes(info.jvm.heapCommitted) }} / 上限 {{ formatBytes(info.jvm.heapMax) }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="非堆已用">{{ formatBytes(info.jvm.nonHeapUsed) }}</ElDescriptionsItem>
              <ElDescriptionsItem label="平台线程">
                当前 {{ info.jvm.threadCount }} / 峰值 {{ info.jvm.peakThreadCount }} / 守护 {{ info.jvm.daemonThreadCount }}
              </ElDescriptionsItem>
              <ElDescriptionsItem v-if="info.jvm.inputArgs" label="启动参数">
                <span class="server-monitor-page__args">{{ info.jvm.inputArgs }}</span>
              </ElDescriptionsItem>
            </ElDescriptions>
          </ElCard>
        </ElCol>

        <ElCol :xs="24" :md="12">
          <ElCard v-if="info.virtualThreads.supported" shadow="never" header="虚拟线程调度器">
            <div class="metric-grid">
              <div class="metric">
                <div class="metric__value">{{ info.virtualThreads.parallelism }}</div>
                <div class="metric__label">调度并行度</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ info.virtualThreads.poolSize }}</div>
                <div class="metric__label">载体线程池大小</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ info.virtualThreads.mounted }}</div>
                <div class="metric__label">已挂载虚拟线程</div>
              </div>
              <div class="metric">
                <div class="metric__value">{{ info.virtualThreads.queued }}</div>
                <div class="metric__label">排队待调度</div>
              </div>
            </div>
          </ElCard>

          <ElCard shadow="never" header="服务器信息" style="margin-top: 12px">
            <ElDescriptions :column="1" border size="small">
              <ElDescriptionsItem label="主机名">{{ info.sys.hostName }}</ElDescriptionsItem>
              <ElDescriptionsItem label="IP 地址">{{ info.sys.ip }}</ElDescriptionsItem>
              <ElDescriptionsItem label="操作系统">{{ info.sys.osName }} {{ info.sys.osVersion }}（{{ info.sys.osArch }}）</ElDescriptionsItem>
            </ElDescriptions>
          </ElCard>
        </ElCol>
      </ElRow>

      <ElCard shadow="never" header="磁盘状态">
        <ElTable :data="info.sysFiles" size="small">
          <ElTableColumn prop="dirName" label="挂载点" min-width="120" />
          <ElTableColumn prop="sysTypeName" label="文件系统" width="110" />
          <ElTableColumn prop="typeName" label="卷名" min-width="140" show-overflow-tooltip />
          <ElTableColumn label="总大小" width="110">
            <template #default="{ row }">{{ formatBytes(row.total) }}</template>
          </ElTableColumn>
          <ElTableColumn label="已用" width="110">
            <template #default="{ row }">{{ formatBytes(row.used) }}</template>
          </ElTableColumn>
          <ElTableColumn label="可用" width="110">
            <template #default="{ row }">{{ formatBytes(row.free) }}</template>
          </ElTableColumn>
          <ElTableColumn label="使用率" min-width="160">
            <template #default="{ row }">
              <ElProgress :percentage="row.usage" :color="usageColor(row.usage)" />
            </template>
          </ElTableColumn>
        </ElTable>
      </ElCard>
    </template>
  </div>
</template>

<style scoped>
.server-monitor-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.server-monitor-page :deep(.el-row) {
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
}

.server-monitor-page__args {
  word-break: break-all;
}
</style>
