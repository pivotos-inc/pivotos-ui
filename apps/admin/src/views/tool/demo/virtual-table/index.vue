<script setup lang="ts">
defineOptions({ name: 'DemoVirtualTable' });
import { nextTick, ref } from 'vue';
import { ElAlert, ElButton, ElOption, ElSelect, ElSwitch, ElTag } from 'element-plus';
import { YTable } from '@pivotos/ui';
import type { YTableColumn } from '@pivotos/ui';

/**
 * 虚拟表格演示（FE-1）。
 *
 * 演示要点：
 * - YTable 的虚拟滚动是 opt-in（`virtual` prop），默认关闭，存量 30+ 页面零影响；
 * - 同一份 columns / total / 分页 / loading / selection 契约，两种模式都能跑；
 * - 关闭虚拟滚动时请把行数调小（≤ 5000），否则主线程会被 ElTable 的全量渲染卡住——
 *   这正是这个演示页要让人看见的对比。
 */

interface DemoRow {
  id: number;
  username: string;
  nickname: string;
  dept: string;
  role: string;
  status: '0' | '1';
  score: number;
  createTime: string;
}

const DEPTS = ['研发中心', '市场部', '财务部', '人力资源部', '客户成功部'];
const ROLES = ['系统管理员', '部门主管', '普通员工', '只读访客'];

/** 确定性造数（不用随机数：同一份数据才能做「开/关虚拟滚动」的公平对比） */
function buildRows(count: number): DemoRow[] {
  const list: DemoRow[] = [];
  const base = Date.parse('2026-01-01T08:00:00');
  for (let i = 0; i < count; i++) {
    list.push({
      id: 100000 + i,
      username: `user${String(i).padStart(6, '0')}`,
      nickname: `演示用户-${i + 1}`,
      dept: DEPTS[i % DEPTS.length],
      role: ROLES[i % ROLES.length],
      status: i % 7 === 0 ? '1' : '0',
      score: (i * 37) % 100,
      createTime: new Date(base + i * 60_000).toISOString().slice(0, 19).replace('T', ' '),
    });
  }
  return list;
}

const rows = ref<DemoRow[]>([]);
const rowCount = ref(20_000);
const virtual = ref(true);
const selected = ref<DemoRow[]>([]);
const costMs = ref<number | null>(null);
const generating = ref(false);

const columns: YTableColumn<DemoRow>[] = [
  { type: 'selection', width: 50 },
  { prop: 'username', label: '用户名', width: 140 },
  { prop: 'nickname', label: '昵称', width: 160 },
  { prop: 'dept', label: '部门', width: 140 },
  { prop: 'role', label: '角色', width: 140 },
  { prop: 'status', label: '状态', width: 100, align: 'center', slot: 'status' },
  { prop: 'score', label: '绩效分', width: 100, align: 'right' },
  { prop: 'createTime', label: '创建时间', width: 180 },
];

async function handleGenerate(): Promise<void> {
  generating.value = true;
  // 先清空再 nextTick：让上一轮的 DOM 先卸载，避免「旧树的销毁时间」混进本轮耗时
  rows.value = [];
  await nextTick();
  const start = performance.now();
  rows.value = buildRows(rowCount.value);
  await nextTick();
  costMs.value = Math.round(performance.now() - start);
  generating.value = false;
}

function handleSelectionChange(list: unknown[]): void {
  selected.value = list as DemoRow[];
}
</script>

<template>
  <div class="demo-virtual">
    <ElAlert
      type="info"
      show-icon
      :closable="false"
      title="FE-1 虚拟列表：数据量到万级以上时，窗口化渲染只渲染可视区域的行"
      description="关闭虚拟滚动后仅建议展示 ≤ 5000 行（真实场景下会明显掉帧，可用来做对比）；虚拟模式下不支持树形数据与追加列，selection / index / slot / formatter / 分页 / total 均与既有用法一致。"
      class="demo-virtual__alert"
    />

    <div class="page-card">
      <div class="demo-virtual__bar">
        <span class="demo-virtual__label">行数</span>
        <ElSelect v-model="rowCount" style="width: 140px">
          <ElOption :value="1000" label="1 000 行" />
          <ElOption :value="5000" label="5 000 行" />
          <ElOption :value="20000" label="20 000 行" />
          <ElOption :value="100000" label="100 000 行" />
        </ElSelect>
        <ElButton type="primary" :loading="generating" @click="handleGenerate">生成数据</ElButton>
        <ElButton :disabled="rows.length === 0" @click="rows = []">清空</ElButton>
        <span class="demo-virtual__hint">
          建议切换虚拟开关后再点一次「生成数据」，对比两种模式的处理耗时
        </span>
      </div>

      <div class="demo-virtual__bar">
        <ElSwitch v-model="virtual" active-text="虚拟滚动（开）" inactive-text="虚拟滚动（关）" />
        <span v-if="costMs !== null" class="demo-virtual__cost">本次渲染耗时 ≈ {{ costMs }} ms</span>
        <span v-if="rows.length" class="demo-virtual__cost">数据行数：{{ rows.length }}</span>
        <span v-if="selected.length" class="demo-virtual__cost">已选：{{ selected.length }} 行</span>
      </div>

      <YTable
        :data="rows"
        :columns="columns"
        :virtual="virtual"
        :virtual-height="460"
        :total="rows.length"
        hide-pagination
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <template #status="{ row }">
          <ElTag :type="(row as DemoRow).status === '0' ? 'success' : 'danger'" size="small" effect="plain">
            {{ (row as DemoRow).status === '0' ? '启用' : '停用' }}
          </ElTag>
        </template>
      </YTable>
    </div>
  </div>
</template>

<style scoped>
.demo-virtual__alert {
  margin-bottom: 12px;
}

.demo-virtual__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.demo-virtual__label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.demo-virtual__hint,
.demo-virtual__cost {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
