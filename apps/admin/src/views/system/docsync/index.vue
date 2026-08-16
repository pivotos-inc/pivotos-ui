<script setup lang="ts">
defineOptions({ name: 'ToolDocsync' });
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  ElButton,
  ElMessage,
  ElMessageBox,
  ElTableColumn,
  ElSwitch,
  ElTag,
} from 'element-plus';
import { Plus, Download, Refresh } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import {
  type DocSyncConfigSaveRequest,
  type DocSyncConfigVO,
  type DocSyncTypeEnum,
  type PlatformInfoDTO,
  changeDocSyncStatus,
  createDocSyncConfig,
  deleteDocSyncConfig,
  exportDocSyncOpenApiUrl,
  getDocSyncConfig,
  getDocSyncPlatforms,
  syncDocSyncAll,
  syncDocSyncOne,
  testDocSyncConnection,
  updateDocSyncConfig,
} from '@/api/system/docsync';
import { useTablePage } from '@/hooks';
import { useUserStore } from '@/stores/user';

// ---------- 平台列表 ----------
const platforms = ref<PlatformInfoDTO[]>([]);
const platformMap = computed<Map<DocSyncTypeEnum, PlatformInfoDTO>>(() => {
  const m = new Map<DocSyncTypeEnum, PlatformInfoDTO>();
  platforms.value.forEach((p) => m.set(p.type, p));
  return m;
});

onMounted(async () => {
  platforms.value = await getDocSyncPlatforms();
});

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<
  DocSyncConfigVO,
  { name?: string; platformType?: string }
>({
  url: '/system/docsync/page',
  query: { name: '', platformType: '' },
});

const searchSchemas: YFormSchema[] = [
  { field: 'name', label: '配置名称', component: 'input', placeholder: '按名称模糊查询' },
  {
    field: 'platformType',
    label: '平台类型',
    component: 'select',
    placeholder: '全部',
    options: [],
  },
];

// 动态填充平台选项
watch(platforms, (list) => {
  const schema = searchSchemas.find((s) => s.field === 'platformType');
  if (schema) {
    schema.options = list.map((p) => ({ label: p.displayName, value: p.type }));
  }
});

const columns: YTableColumn<DocSyncConfigVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'name', label: '配置名称', minWidth: 140 },
  {
    prop: 'platformType',
    label: '平台',
    width: 120,
    align: 'center',
    slot: 'platformType',
  },
  { prop: 'serverUrl', label: '服务器地址', minWidth: 200 },
  { prop: 'enabled', label: '状态', width: 90, align: 'center', slot: 'enabled' },
  { prop: 'lastSyncTime', label: '上次同步', width: 170 },
  { prop: 'remark', label: '备注', minWidth: 160 },
];

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);

/** 当前选中平台的配置字段 */
const currentPlatformFields = computed(() => {
  const pt = formModel.platformType as DocSyncTypeEnum | undefined;
  if (!pt) return [];
  return platformMap.value.get(pt)?.configFields ?? [];
});

/** 根据平台动态生成表单 schema */
const formSchemas = computed<YFormSchema[]>(() => {
  const schemas: YFormSchema[] = [
    {
      field: 'name',
      label: '配置名称',
      component: 'input',
      placeholder: '请输入配置名称',
      rules: [{ required: true, message: '配置名称不能为空', trigger: 'blur' }],
    },
    {
      field: 'platformType',
      label: '平台类型',
      component: 'select',
      placeholder: '请选择平台',
      options: platforms.value.map((p) => ({
        label: `${p.displayName}（${p.autoSyncSupported ? '自动同步' : '手动'}）`,
        value: p.type,
      })),
      props: { disabled: isEdit.value },
      rules: [{ required: true, message: '平台类型不能为空', trigger: 'change' }],
    },
  ];

  // 根据平台配置字段动态添加
  for (const field of currentPlatformFields.value) {
    const component = field.inputType === 'textarea' ? 'textarea' : 'input';
    const schema: YFormSchema = {
      field: field.fieldKey,
      label: field.label,
      component,
      placeholder: field.placeholder,
    };
    if (field.required) {
      schema.rules = [{ required: true, message: `${field.label}不能为空`, trigger: 'blur' }];
    }
    schemas.push(schema);
  }

  schemas.push({ field: 'remark', label: '备注', component: 'textarea' });
  return schemas;
});

/** 平台选项（用于 select） */
watch(
  currentPlatformFields,
  () => {
    // 当平台改变时，清空已不需要的字段
    const validKeys = new Set(['name', 'platformType', 'remark', 'id']);
    currentPlatformFields.value.forEach((f) => validKeys.add(f.fieldKey));
    Object.keys(formModel).forEach((k) => {
      if (!validKeys.has(k) && k !== 'id') delete formModel[k];
    });
  },
  { flush: 'post' },
);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { enabled: 1 });
  dialogVisible.value = true;
}

async function openEdit(row: DocSyncConfigVO): Promise<void> {
  const detail = await getDocSyncConfig(row.id);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { ...detail });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: DocSyncConfigSaveRequest = {
      id: formModel.id as string | undefined,
      name: formModel.name as string,
      platformType: formModel.platformType as DocSyncTypeEnum,
      serverUrl: (formModel.serverUrl as string) || undefined,
      credential: (formModel.credential as string) || undefined,
      secondaryCredential: (formModel.secondaryCredential as string) || undefined,
      projectId: (formModel.projectId as string) || undefined,
      enabled: (formModel.enabled as number) ?? 1,
      remark: (formModel.remark as string) || undefined,
    };
    if (isEdit.value) {
      await updateDocSyncConfig(body);
    } else {
      await createDocSyncConfig(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

async function handleDelete(row: DocSyncConfigVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除配置「${row.name}」吗？`, '提示', { type: 'warning' });
  await deleteDocSyncConfig(row.id);
  ElMessage.success('删除成功');
  await load();
}

async function handleStatusChange(row: DocSyncConfigVO, val: number): Promise<void> {
  try {
    await changeDocSyncStatus(row.id, val);
    ElMessage.success(val === 1 ? '已启用' : '已禁用');
  } catch {
    // 恢复 UI 状态
    row.enabled = val === 1 ? 0 : 1;
  }
}

async function handleTest(row: DocSyncConfigVO): Promise<void> {
  ElMessage.info('正在测试连通性...');
  try {
    const ok = await testDocSyncConnection(row.id);
    if (ok) {
      ElMessage.success('连通性测试通过');
    } else {
      ElMessage.warning('连通性测试失败');
    }
  } catch {
    // 错误提示已由全局拦截器处理
  }
}

async function handleSync(row: DocSyncConfigVO): Promise<void> {
  await ElMessageBox.confirm(`确定同步配置「${row.name}」到 ${row.platformType} 吗？`, '同步确认', {
    type: 'info',
  });
  ElMessage.info('同步中...');
  try {
    const result = await syncDocSyncOne(row.id);
    if (result.status === 'SUCCESS') {
      ElMessage.success(`同步成功：${result.message}（${result.apiCount} 个接口）`);
    } else {
      ElMessage.warning(`同步失败：${result.message}`);
    }
    await load();
  } catch {
    // 错误提示已由全局拦截器处理
  }
}

async function handleSyncAll(): Promise<void> {
  await ElMessageBox.confirm('确定同步所有启用的配置吗？', '批量同步', { type: 'info' });
  ElMessage.info('批量同步中...');
  try {
    const results = await syncDocSyncAll();
    const ok = results.filter((r) => r.status === 'SUCCESS').length;
    const fail = results.filter((r) => r.status !== 'SUCCESS').length;
    ElMessage.success(`同步完成：成功 ${ok} 个${fail > 0 ? `，失败 ${fail} 个` : ''}`);
    await load();
  } catch {
    // 错误提示已由全局拦截器处理
  }
}

function handleExport(row: DocSyncConfigVO): void {
  const url = exportDocSyncOpenApiUrl(row.id);
  const link = document.createElement('a');
  link.download = `openapi-${row.name}.json`;
  // 使用 fetch 带 Authorization 头下载（token 键为 pivotos-token，经 user store 读取）
  const token = useUserStore().token;
  fetch(url, { headers: { Authorization: token } })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        // OpenAPI 文档本身也是 JSON；仅当响应体为统一错误结构（success === false）时才视为业务错误（如未登录）
        const parsed = await res.json().catch(() => null);
        if (parsed && parsed.success === false) {
          throw new Error(parsed.msg || '导出失败');
        }
        return new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      }
      return res.blob();
    })
    .then((blob) => {
      const objUrl = URL.createObjectURL(blob);
      link.href = objUrl;
      link.click();
      URL.revokeObjectURL(objUrl);
    })
    .catch((e) => ElMessage.error(e?.message || '导出失败'));
}
</script>

<template>
  <div class="page-card">
    <div class="docsync-page__bar">
      <div class="docsync-page__bar-left">
        <ElButton
          v-if="rows.length > 0"
          v-hasPermi="'system:docsync:sync'"
          type="warning"
          :icon="Refresh"
          @click="handleSyncAll"
        >
          同步全部
        </ElButton>
      </div>
      <ElButton v-hasPermi="'system:docsync:add'" type="primary" :icon="Plus" @click="openAdd">
        新增配置
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
      <template #platformType="{ row }">
        <ElTag>{{ (row as DocSyncConfigVO).platformType }}</ElTag>
      </template>
      <template #enabled="{ row }">
        <ElSwitch
          :model-value="(row as DocSyncConfigVO).enabled === 1"
          :active-value="true"
          :inactive-value="false"
          @change="((val: any) => handleStatusChange(row as DocSyncConfigVO, val ? 1 : 0)) as any"
        />
      </template>
      <ElTableColumn label="操作" width="280" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'system:docsync:edit'"
            link
            type="primary"
            @click="openEdit(row as DocSyncConfigVO)"
          >
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:docsync:test'"
            link
            type="info"
            @click="handleTest(row as DocSyncConfigVO)"
          >
            测试
          </ElButton>
          <ElButton
            v-hasPermi="'system:docsync:sync'"
            link
            type="success"
            :disabled="(row as DocSyncConfigVO).enabled !== 1"
            @click="handleSync(row as DocSyncConfigVO)"
          >
            同步
          </ElButton>
          <ElButton
            v-hasPermi="'system:docsync:sync'"
            link
            :icon="Download"
            @click="handleExport(row as DocSyncConfigVO)"
          >
            导出
          </ElButton>
          <ElButton
            v-hasPermi="'system:docsync:remove'"
            link
            type="danger"
            @click="handleDelete(row as DocSyncConfigVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑同步配置' : '新增同步配置'"
      width="560px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="110px" />
      <!-- 平台描述 -->
      <div v-if="formModel.platformType" class="docsync-platform-desc">
        {{ platformMap.get(formModel.platformType as DocSyncTypeEnum)?.description }}
      </div>
    </YDialog>
  </div>
</template>

<style scoped>
.docsync-page__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.docsync-page__bar-left {
  display: flex;
  gap: 8px;
}

.docsync-platform-desc {
  margin-top: -8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>
