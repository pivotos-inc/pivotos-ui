<script setup lang="ts">
defineOptions({ name: 'MonitorData' });
import { computed, onMounted, ref } from 'vue';
import {
  ElAlert,
  ElButton,
  ElCard,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElTag,
  ElTree,
} from 'element-plus';
import { MagicStick, Refresh } from '@element-plus/icons-vue';
import { format } from 'sql-formatter';
import { YTable } from '@pivotos/ui';
import type { YTableColumn } from '@pivotos/ui';
import type {
  DataComponentSnapshot,
  DataQueryResult,
  DataSchemaItem,
  DataTableItem,
} from '@pivotos/types';
import {
  getDataComponents,
  getDataSchemas,
  getDataTables,
  previewData,
  queryData,
} from '@/api/monitor/data';

/**
 * 通用数据监控（S130）：左侧组件/库表树 + 右侧数据网格 + SQL 输入区（美化 + 执行）。
 *
 * 铁律落地：
 * - 「执行」按钮与 SQL 输入区按 v-hasPermi="'monitor:data:query'" 控制可见性；
 * - 后端 SQL 安全闸门（语句类型白名单 / 表白名单 / 强制 LIMIT / 超时熔断 / 租户改写 / 敏感列脱敏）
 *   在执行侧硬生效，与权限无关，超管也不豁免；
 * - 组件不可用时后端返回 200 + code=0 + available=false + reason，这里只展示 reason，不报错。
 */

interface TreeNode {
  key: string;
  label: string;
  level: 'component' | 'schema' | 'table';
  component: string;
  schema?: string;
  table?: string;
  disabled?: boolean;
  children?: TreeNode[];
}

const loading = ref(false);
const treeLoading = ref(false);
const executing = ref(false);

const components = ref<DataComponentSnapshot[]>([]);
const schemas = ref<DataSchemaItem[]>([]);
const tables = ref<DataTableItem[]>([]);
const result = ref<DataQueryResult | null>(null);

const activeComponent = ref('');
const selectedSchema = ref('');
const selectedTable = ref('');
const sql = ref('SELECT * FROM sys_user LIMIT 20');
const pageNum = ref(1);
const pageSize = ref(20);

/** 当前组件能力集（决定 SQL 区是否渲染——Redis 无 QUERY 能力） */
const activeCapabilities = computed<string[]>(() => {
  const hit = components.value.find((c) => c.type === activeComponent.value);
  return hit?.capabilities ?? [];
});

const canQuery = computed(() => activeCapabilities.value.includes('QUERY'));

const activeUnavailableReason = computed(() => {
  const hit = components.value.find((c) => c.type === activeComponent.value);
  return hit && !hit.available ? hit.reason ?? '组件不可用' : '';
});

const treeData = computed<TreeNode[]>(() =>
  components.value.map((component) => {
    const node: TreeNode = {
      key: `c:${component.type}`,
      label: component.available ? component.name : `${component.name}（不可用）`,
      level: 'component',
      component: component.type,
    };
    if (!component.available || component.type !== activeComponent.value) {
      return node;
    }
    node.children = schemas.value.map((schema) => {
      const schemaNode: TreeNode = {
        key: `s:${component.type}:${schema.name}`,
        label: schema.name,
        level: 'schema',
        component: component.type,
        schema: schema.name,
      };
      if (selectedSchema.value === schema.name) {
        schemaNode.children = tables.value.map((table) => ({
          key: `t:${component.type}:${schema.name}:${table.name}`,
          label: table.name,
          level: 'table',
          component: component.type,
          schema: schema.name,
          table: table.name,
        }));
      }
      return schemaNode;
    });
    return node;
  }),
);

/** 结果列 → YTable 列定义（脱敏列在表头标注） */
const resultColumns = computed<YTableColumn<Record<string, unknown>>[]>(() =>
  (result.value?.columns ?? []).map((column) => ({
    prop: column.name,
    label: column.masked ? `${column.name}（已脱敏）` : column.name,
    minWidth: 140,
    showOverflowTooltip: true,
  })),
);

const total = computed(() => Number(result.value?.total ?? 0));

async function loadComponents(): Promise<void> {
  treeLoading.value = true;
  try {
    components.value = await getDataComponents();
    const firstAvailable = components.value.find((c) => c.available);
    if (!activeComponent.value && firstAvailable) {
      activeComponent.value = firstAvailable.type;
      await loadSchemas();
    }
  } catch {
    ElMessage.error('数据监控组件加载失败');
  } finally {
    treeLoading.value = false;
  }
}

async function loadSchemas(): Promise<void> {
  if (!activeComponent.value) return;
  schemas.value = await getDataSchemas(activeComponent.value);
  tables.value = [];
  selectedSchema.value = '';
  selectedTable.value = '';
}

async function loadTables(schema: string): Promise<void> {
  treeLoading.value = true;
  try {
    tables.value = await getDataTables(activeComponent.value, schema);
    selectedSchema.value = schema;
    selectedTable.value = '';
  } catch {
    ElMessage.error('表清单加载失败');
  } finally {
    treeLoading.value = false;
  }
}

async function runPreview(): Promise<void> {
  if (!selectedSchema.value || !selectedTable.value) return;
  loading.value = true;
  try {
    result.value = await previewData({
      component: activeComponent.value,
      schema: selectedSchema.value,
      table: selectedTable.value,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    });
  } catch {
    ElMessage.error('预览失败');
  } finally {
    loading.value = false;
  }
}

/** 自由 SQL 执行：二次确认（体验层），真正边界在后端闸门 */
async function runQuery(): Promise<void> {
  const statement = sql.value.trim();
  if (!statement) {
    ElMessage.warning('请输入要执行的语句');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `即将执行（只读，闸门硬生效，写语句一律拒绝）：\n\n${statement}`,
      '高危操作确认',
      { type: 'warning', confirmButtonText: '执行', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  executing.value = true;
  loading.value = true;
  try {
    result.value = await queryData({
      component: activeComponent.value,
      schema: selectedSchema.value || undefined,
      statement,
    });
  } catch {
    ElMessage.error('执行失败');
  } finally {
    executing.value = false;
    loading.value = false;
  }
}

/** SQL 美化：纯浏览器本地执行（sql-formatter），无后端接口、无数据出域，因此不列权限点 */
function formatSql(): void {
  try {
    sql.value = format(sql.value, { language: 'mysql', keywordCase: 'upper' });
  } catch {
    ElMessage.warning('语句无法格式化，已保留原文');
  }
}

function handleNodeClick(node: TreeNode): void {
  if (node.level === 'component') {
    if (!components.value.find((c) => c.type === node.component)?.available) return;
    activeComponent.value = node.component;
    void loadSchemas();
  } else if (node.level === 'schema') {
    void loadTables(node.schema as string);
  } else if (node.level === 'table') {
    selectedSchema.value = node.schema as string;
    selectedTable.value = node.table as string;
    pageNum.value = 1;
    void runPreview();
  }
}

function handleRefresh(): void {
  if (selectedTable.value) {
    void runPreview();
  }
}

onMounted(() => {
  void loadComponents();
});
</script>

<template>
  <div class="page-card data-monitor-page">
    <div class="data-monitor-page__layout">
      <!-- 左：组件 / 库表树 -->
      <ElCard v-loading="treeLoading" shadow="never" class="data-monitor-page__tree">
        <template #header>
          <div class="data-monitor-page__tree-header">
            <span>数据源</span>
            <ElButton :icon="Refresh" circle size="small" @click="loadComponents()" />
          </div>
        </template>
        <ElTree
          :data="treeData"
          node-key="key"
          :props="{ children: 'children', label: 'label' }"
          :expand-on-click-node="false"
          highlight-current
          @node-click="handleNodeClick"
        >
          <template #default="{ data }">
            <span class="data-monitor-page__node">
              <span>{{ (data as TreeNode).label }}</span>
              <ElTag
                v-if="(data as TreeNode).level === 'component'"
                size="small"
                :type="components.find((c) => c.type === (data as TreeNode).component)?.available ? 'success' : 'info'"
              >
                {{ components.find((c) => c.type === (data as TreeNode).component)?.available ? '可用' : '不可用' }}
              </ElTag>
            </span>
          </template>
        </ElTree>
      </ElCard>

      <!-- 右：工具条 + SQL 区 + 数据网格 -->
      <div class="data-monitor-page__main">
        <ElAlert
          v-if="activeUnavailableReason"
          class="data-monitor-page__alert"
          type="warning"
          :closable="false"
          show-icon
          :title="activeUnavailableReason"
        />

        <ElCard shadow="never" class="data-monitor-page__sql">
          <template #header>
            <div class="data-monitor-page__sql-header">
              <span>
                数据源 <b>{{ activeComponent || '-' }}</b>
                <template v-if="selectedTable"> · {{ selectedSchema }}.{{ selectedTable }}</template>
              </span>
              <ElButton :icon="Refresh" size="small" :disabled="!selectedTable" @click="handleRefresh">
                刷新
              </ElButton>
            </div>
          </template>

          <!-- SQL 输入区：无 QUERY 能力的组件（如 Redis）整块不渲染 -->
          <template v-if="canQuery">
            <ElInput
              v-model="sql"
              v-hasPermi="'monitor:data:query'"
              type="textarea"
              :rows="4"
              placeholder="仅支持单条只读 SELECT；写语句、多语句、注释绕过、非白名单表一律被拒绝"
            />
            <div class="data-monitor-page__actions">
              <ElButton :icon="MagicStick" size="small" @click="formatSql">美化</ElButton>
              <ElButton
                v-hasPermi="'monitor:data:query'"
                type="danger"
                size="small"
                :loading="executing"
                @click="runQuery"
              >
                执行（只读）
              </ElButton>
            </div>
          </template>
          <div v-else class="data-monitor-page__hint">
            当前组件不支持自由查询（无 QUERY 能力），只能通过左侧树预览数据。
          </div>
        </ElCard>

        <ElCard shadow="never" class="data-monitor-page__grid">
          <template v-if="result && !result.available">
            <ElAlert type="warning" :closable="false" show-icon :title="result.reason ?? '查询不可用'" />
          </template>
          <template v-else>
            <ElAlert
              v-for="(warning, index) in result?.warnings ?? []"
              :key="index"
              class="data-monitor-page__alert"
              type="info"
              :closable="false"
              show-icon
              :title="warning"
            />
            <YTable
              :data="result?.rows ?? []"
              :columns="resultColumns"
              :loading="loading"
              :total="total"
              :page-num="pageNum"
              :page-size="pageSize"
              :hide-pagination="!selectedTable"
              @update:page-num="pageNum = $event"
              @update:page-size="pageSize = $event"
              @refresh="runPreview"
            >
              <template #empty>请选择左侧的表，或执行一条只读查询</template>
            </YTable>
          </template>
        </ElCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-monitor-page__layout {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.data-monitor-page__tree {
  width: 280px;
  flex: 0 0 280px;
}

.data-monitor-page__tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.data-monitor-page__node {
  display: flex;
  align-items: center;
  gap: 8px;
}

.data-monitor-page__main {
  flex: 1 1 auto;
  min-width: 0;
}

.data-monitor-page__sql-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.data-monitor-page__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.data-monitor-page__alert {
  margin-bottom: 12px;
}

.data-monitor-page__hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
