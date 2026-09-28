<script setup lang="ts">
defineOptions({ name: 'WorkflowDefinition' });
import { ref } from 'vue';
import { ElButton, ElDialog, ElMessage, ElMessageBox, ElTableColumn, ElTag } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import type { FlowDefinitionQuery, FlowDefinitionVO } from '@pivotos/types';
import {
  deleteDefinition,
  publishDefinition,
  toggleActivity,
} from '@/api/workflow/definition';
import { useUserStore } from '@/stores/user';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<FlowDefinitionVO, FlowDefinitionQuery>({
  url: '/workflow/definition/page',
  query: { flowName: '', flowCode: '', category: '', isPublish: '' },
});

const PUBLISH_OPTIONS = [
  { label: '未发布', value: 0 },
  { label: '已发布', value: 1 },
  { label: '失效', value: 9 },
];

const PUBLISH_TAG: Record<number, { label: string; type: 'info' | 'success' | 'warning' | 'danger' }> = {
  0: { label: '未发布', type: 'info' },
  1: { label: '已发布', type: 'success' },
  9: { label: '失效', type: 'danger' },
};

const ACTIVITY_TAG: Record<number, { label: string; type: 'success' | 'warning' }> = {
  0: { label: '挂起', type: 'warning' },
  1: { label: '激活', type: 'success' },
};

const searchSchemas: YFormSchema[] = [
  { field: 'flowName', label: '流程名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'flowCode', label: '流程编码', component: 'input', placeholder: '按编码模糊查询' },
  {
    field: 'isPublish',
    label: '发布状态',
    component: 'select',
    placeholder: '全部',
    options: PUBLISH_OPTIONS,
  },
];

const columns: YTableColumn<FlowDefinitionVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'flowCode', label: '流程编码', minWidth: 140 },
  { prop: 'flowName', label: '流程名称', minWidth: 160 },
  { prop: 'category', label: '类别', width: 100 },
  { prop: 'version', label: '版本', width: 80, align: 'center' },
  { prop: 'isPublish', label: '发布状态', width: 100, align: 'center', slot: 'publishStatus' },
  { prop: 'activityStatus', label: '激活状态', width: 100, align: 'center', slot: 'activityStatus' },
  { prop: 'createTime', label: '创建时间', width: 170 },
  { prop: 'updateTime', label: '更新时间', width: 170 },
];

// ---------- 设计器（iframe 内嵌） ----------
const designerVisible = ref(false);
const designerUrl = ref('');
const designerTitle = ref('流程设计器');

/** 同步 token 到 WarmFlow 设计器期望的 localStorage key */
function syncWarmFlowToken(): void {
  const { token } = useUserStore();
  if (token) {
    localStorage.setItem('Authorization', token);
  }
}

/** 打开 WarmFlow 内置设计器（编辑已有定义） */
function openDesigner(row: FlowDefinitionVO): void {
  syncWarmFlowToken();
  designerTitle.value = `设计流程 - ${row.flowName}`;
  // 注意：query 参数必须在 # 之前，WarmFlow SPA 用 location.search 解析
  designerUrl.value = `/api/warm-flow-ui/index.html?id=${row.id}#/design`;
  designerVisible.value = true;
}

/** 打开 WarmFlow 新建设计器 */
function openDesignerCreate(): void {
  syncWarmFlowToken();
  designerTitle.value = '新建流程';
  designerUrl.value = '/api/warm-flow-ui/index.html#/design';
  designerVisible.value = true;
}

function onDesignerClose(): void {
  designerVisible.value = false;
  designerUrl.value = '';
  // 关闭设计器后刷新列表（可能保存了新定义）
  load();
}

// ---------- 新版设计器（S104，bpmn-js 自绘页面，与旧 iframe 入口并存灰度） ----------
const router = useRouter();

/** 跳转新版设计器编辑既有定义（query-def → defJsonToBpmnXml 回显链路） */
function openNewDesigner(row: FlowDefinitionVO): void {
  void router.push({ path: '/workflow/designer', query: { id: row.id } });
}

// ---------- 操作 ----------

async function handlePublish(row: FlowDefinitionVO): Promise<void> {
  await ElMessageBox.confirm(`确定发布流程「${row.flowName}」吗？`, '提示', { type: 'warning' });
  await publishDefinition(row.id);
  ElMessage.success('发布成功');
  await load();
}

async function handleToggleActivity(row: FlowDefinitionVO): Promise<void> {
  const action = row.activityStatus === 1 ? '挂起' : '激活';
  await ElMessageBox.confirm(`确定${action}流程「${row.flowName}」吗？`, '提示', { type: 'warning' });
  await toggleActivity(row.id);
  ElMessage.success(`${action}成功`);
  await load();
}

async function handleDelete(row: FlowDefinitionVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除流程「${row.flowName}」吗？此操作不可逆。`, '提示', { type: 'warning' });
  await deleteDefinition(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="definition-page__bar">
      <ElButton v-hasPermi="'workflow:definition:design'" type="primary" :icon="Plus" @click="openDesignerCreate">
        新建流程
      </ElButton>
    </div>

    <YSearchForm v-model="params" :schemas="searchSchemas" @search="search" @reset="reset" />

    <YTable
      v-model:page-num="params.pageNum"
      v-model:page-size="params.pageSize"
      :loading="loading"
      :data="rows"
      :columns="columns"
      :total="total"
      row-key="id"
      @refresh="load"
    >
      <template #publishStatus="{ row }">
        <ElTag :type="PUBLISH_TAG[(row as FlowDefinitionVO).isPublish]?.type ?? 'info'" disable-transitions>
          {{ PUBLISH_TAG[(row as FlowDefinitionVO).isPublish]?.label ?? (row as FlowDefinitionVO).isPublish }}
        </ElTag>
      </template>
      <template #activityStatus="{ row }">
        <ElTag :type="ACTIVITY_TAG[(row as FlowDefinitionVO).activityStatus]?.type ?? 'info'" disable-transitions>
          {{ ACTIVITY_TAG[(row as FlowDefinitionVO).activityStatus]?.label ?? (row as FlowDefinitionVO).activityStatus }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="300" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'workflow:definition:design'"
            link
            type="primary"
            @click="openDesigner(row as FlowDefinitionVO)"
          >
            设计
          </ElButton>
          <ElButton
            v-hasPermi="'workflow:definition:design'"
            link
            type="primary"
            @click="openNewDesigner(row as FlowDefinitionVO)"
          >
            新版设计
          </ElButton>
          <ElButton
            v-if="(row as FlowDefinitionVO).isPublish !== 1"
            v-hasPermi="'workflow:definition:publish'"
            link
            type="success"
            @click="handlePublish(row as FlowDefinitionVO)"
          >
            发布
          </ElButton>
          <ElButton
            v-hasPermi="'workflow:definition:edit'"
            link
            :type="(row as FlowDefinitionVO).activityStatus === 1 ? 'warning' : 'primary'"
            @click="handleToggleActivity(row as FlowDefinitionVO)"
          >
            {{ (row as FlowDefinitionVO).activityStatus === 1 ? '挂起' : '激活' }}
          </ElButton>
          <ElButton
            v-hasPermi="'workflow:definition:remove'"
            link
            type="danger"
            @click="handleDelete(row as FlowDefinitionVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>
  </div>

  <!-- WarmFlow 设计器 iframe 弹窗 -->
  <ElDialog
    v-model="designerVisible"
    :title="designerTitle"
    fullscreen
    destroy-on-close
    @close="onDesignerClose"
  >
    <iframe
      v-if="designerUrl"
      :src="designerUrl"
      class="designer-iframe"
      frameborder="0"
    />
  </ElDialog>
</template>

<style scoped>
.definition-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.designer-iframe {
  width: 100%;
  height: calc(100vh - 120px);
  border: none;
}
</style>
