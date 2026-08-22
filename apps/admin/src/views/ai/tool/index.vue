<script setup lang="ts">
defineOptions({ name: 'AiTool' });
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElSwitch, ElTableColumn, ElTabPane, ElTabs, ElTag } from 'element-plus';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import type { AiToolInvokeQuery, AiToolInvokeVO, AiToolQuery, AiToolVO, RoleVO } from '@pivotos/types';
import { listAllRoles } from '@/api/system/role';
import { updateToolRoles, updateToolStatus } from '@/api/ai/tool';
import { useTablePage } from '@/hooks';

// ---------- 常量 ----------

/** 工具类型选项（对齐 ToolType 枚举：read/write） */
const TYPE_OPTIONS: YFormOption[] = [
  { label: '只读', value: 'read' },
  { label: '写操作', value: 'write' },
];

/** 工具状态选项（0正常 1停用） */
const STATUS_OPTIONS: YFormOption[] = [
  { label: '正常', value: 0 },
  { label: '停用', value: 1 },
];

/** 调用状态选项（对齐 ai_tool_invoke.invoke_status） */
const INVOKE_STATUS_OPTIONS: YFormOption[] = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'fail' },
  { label: '越权拒绝', value: 'forbidden' },
  { label: '预检待确认', value: 'need_confirm' },
];

/** 调用状态 → 文案与颜色 */
const INVOKE_STATUS_META: Record<string, { text: string; type: 'success' | 'danger' | 'warning' | 'info' }> = {
  success: { text: '成功', type: 'success' },
  fail: { text: '失败', type: 'danger' },
  forbidden: { text: '越权拒绝', type: 'warning' },
  need_confirm: { text: '预检待确认', type: 'info' },
};

// ---------- Tab 页签 ----------
const activeTab = ref('registry');
const auditLoaded = ref(false);

// ---------- 工具注册列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<AiToolVO, AiToolQuery>({
  url: '/ai/tool/page',
  query: { toolName: '', toolType: '', status: '' },
});

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'toolName', label: '工具名', component: 'input', placeholder: '按工具名模糊查询' },
  { field: 'toolType', label: '类型', component: 'select', placeholder: '全部', options: TYPE_OPTIONS },
  { field: 'status', label: '状态', component: 'select', placeholder: '全部', options: STATUS_OPTIONS },
]);

const columns: YTableColumn<AiToolVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'displayName', label: '展示名', minWidth: 130 },
  { prop: 'toolName', label: '工具名', minWidth: 150 },
  { prop: 'toolType', label: '类型', width: 90, align: 'center', slot: 'toolType' },
  { prop: 'confirmRequired', label: '二次确认', width: 90, align: 'center', slot: 'confirm' },
  { prop: 'roles', label: '角色白名单', minWidth: 150, formatter: (row) => roleText(row) },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'status' },
  { prop: 'createTime', label: '注册时间', width: 170 },
];

/** 停用/启用切换（取消确认框则不变更） */
async function handleStatusChange(row: AiToolVO, status: number): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定${status === 1 ? '停用' : '启用'}工具「${row.displayName || row.toolName}」吗？`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await updateToolStatus(row.id, status);
  ElMessage.success(status === 1 ? '已停用' : '已启用');
  await load();
}

// ---------- 角色白名单 ----------
const roleOptions = ref<YFormOption[]>([]);
const roleNameMap = computed(() => {
  const map: Record<string, string> = {};
  roleOptions.value.forEach((o) => {
    map[String(o.value)] = o.label;
  });
  return map;
});

onMounted(async () => {
  try {
    const roles: RoleVO[] = await listAllRoles();
    roleOptions.value = roles.map((r) => ({ label: r.roleName, value: r.roleCode }));
  } catch {
    roleOptions.value = [];
  }
});

/** 白名单列文案：空或通配 = 全部登录用户 */
function roleText(row: AiToolVO): string {
  const roles = row.roles ?? [];
  if (roles.length === 0 || roles.includes('*')) return '全部登录用户';
  return roles.map((code) => roleNameMap.value[code] ?? code).join('、');
}

const roleDialogVisible = ref(false);
const roleConfirmLoading = ref(false);
const roleFormModel = reactive<Record<string, unknown>>({});
const currentTool = ref<AiToolVO>();

function openRoles(row: AiToolVO): void {
  currentTool.value = row;
  Object.keys(roleFormModel).forEach((k) => delete roleFormModel[k]);
  // 通配 '*' 等价全部登录用户，编辑时按空选择呈现
  Object.assign(roleFormModel, { roles: (row.roles ?? []).filter((code) => code !== '*') });
  roleDialogVisible.value = true;
}

const roleFormSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'roles',
    label: '角色白名单',
    component: 'select',
    placeholder: '不选 = 全部登录用户可调用',
    options: roleOptions.value,
    props: { multiple: true, clearable: true },
  },
]);

async function handleRoleSubmit(): Promise<void> {
  if (!currentTool.value) return;
  roleConfirmLoading.value = true;
  try {
    const roles = (roleFormModel.roles as string[] | undefined) ?? [];
    await updateToolRoles(currentTool.value.id, roles);
    ElMessage.success('白名单已更新');
    roleDialogVisible.value = false;
    await load();
  } finally {
    roleConfirmLoading.value = false;
  }
}

// ---------- 调用审计列表（切页签时懒加载，避免无 ai:tool:invoke:list 权限者进页即 403） ----------
const {
  loading: auditLoading,
  rows: auditRows,
  total: auditTotal,
  params: auditParams,
  load: auditLoad,
  search: auditSearch,
  reset: auditReset,
} = useTablePage<AiToolInvokeVO, AiToolInvokeQuery>({
  url: '/ai/tool/invoke/page',
  query: { toolName: '', invokeStatus: '' },
  immediate: false,
});

const auditSearchSchemas = computed<YFormSchema[]>(() => [
  { field: 'toolName', label: '工具名', component: 'input', placeholder: '按工具名模糊查询' },
  {
    field: 'invokeStatus',
    label: '调用状态',
    component: 'select',
    placeholder: '全部',
    options: INVOKE_STATUS_OPTIONS,
  },
]);

const auditColumns: YTableColumn<AiToolInvokeVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'toolName', label: '工具名', minWidth: 150 },
  { prop: 'userId', label: '调用人', width: 100 },
  { prop: 'argsSummary', label: '入参摘要', minWidth: 180, showOverflowTooltip: true },
  { prop: 'invokeStatus', label: '状态', width: 110, align: 'center', slot: 'invokeStatus' },
  { prop: 'costMs', label: '耗时(ms)', width: 90, align: 'right' },
  { prop: 'traceId', label: 'TraceId', minWidth: 140, showOverflowTooltip: true },
  { prop: 'createTime', label: '调用时间', width: 170 },
];

function onTabChange(name: string | number): void {
  if (name === 'audit' && !auditLoaded.value) {
    auditLoaded.value = true;
    void auditLoad();
  }
}
</script>

<template>
  <div class="page-card">
    <ElTabs v-model="activeTab" @tab-change="onTabChange">
      <ElTabPane label="工具注册" name="registry">
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
          <template #toolType="{ row }">
            <ElTag :type="(row as AiToolVO).toolType === 'write' ? 'warning' : 'success'" size="small">
              {{ (row as AiToolVO).toolType === 'write' ? '写操作' : '只读' }}
            </ElTag>
          </template>
          <template #confirm="{ row }">
            <ElTag
              v-if="(row as AiToolVO).toolType === 'write'"
              :type="(row as AiToolVO).confirmRequired === 1 ? 'danger' : 'info'"
              size="small"
            >
              {{ (row as AiToolVO).confirmRequired === 1 ? '需确认' : '免确认' }}
            </ElTag>
            <span v-else>-</span>
          </template>
          <template #status="{ row }">
            <ElSwitch
              v-hasPermi="'ai:tool:edit'"
              :model-value="(row as AiToolVO).status === 0"
              @change="(v: string | number | boolean) => handleStatusChange(row as AiToolVO, v ? 0 : 1)"
            />
          </template>
          <ElTableColumn label="操作" width="90" align="center" fixed="right">
            <template #default="{ row }">
              <ElButton v-hasPermi="'ai:tool:edit'" link type="primary" @click="openRoles(row as AiToolVO)">
                白名单
              </ElButton>
            </template>
          </ElTableColumn>
        </YTable>
      </ElTabPane>

      <ElTabPane label="调用审计" name="audit">
        <YSearchForm v-model="auditParams" :schemas="auditSearchSchemas" @search="auditSearch" @reset="auditReset" />

        <YTable
          v-model:page-num="auditParams.pageNum"
          v-model:page-size="auditParams.pageSize"
          :loading="auditLoading"
          :data="auditRows"
          :columns="auditColumns"
          :total="auditTotal"
          row-key="id"
          @refresh="auditLoad"
        >
          <template #invokeStatus="{ row }">
            <ElTag
              :type="(INVOKE_STATUS_META[(row as AiToolInvokeVO).invokeStatus] ?? INVOKE_STATUS_META.fail).type"
              size="small"
            >
              {{ (INVOKE_STATUS_META[(row as AiToolInvokeVO).invokeStatus] ?? INVOKE_STATUS_META.fail).text }}
            </ElTag>
          </template>
        </YTable>
      </ElTabPane>
    </ElTabs>

    <!-- 角色白名单编辑 -->
    <YDialog
      v-model="roleDialogVisible"
      :title="`角色白名单 — ${currentTool?.displayName || currentTool?.toolName || ''}`"
      width="520px"
      :confirm-loading="roleConfirmLoading"
      @confirm="handleRoleSubmit"
    >
      <div class="ai-tool__role-tip">不选任何角色 = 全部登录用户可调用；写操作工具调用时仍需二次确认。</div>
      <YForm v-model="roleFormModel" :schemas="roleFormSchemas" label-width="100px" />
    </YDialog>
  </div>
</template>

<style scoped>
.page-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 12px;
}

.ai-tool__role-tip {
  color: #909399;
  font-size: 13px;
  margin-bottom: 12px;
}
</style>
