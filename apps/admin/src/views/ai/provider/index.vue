<script setup lang="ts">
defineOptions({ name: 'AiProvider' });
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn, ElTag } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import type { AiApiKeySaveBody, AiApiKeyVO, AiProviderSaveBody, AiProviderVO } from '@pivotos/types';
import {
  createKey,
  createProvider,
  deleteKey,
  deleteProvider,
  listKeys,
  listProviders,
  updateKey,
  updateProvider,
} from '@/api/ai/provider';

const STATUS_OPTIONS: YFormOption[] = [
  { label: '启用', value: 0 },
  { label: '停用', value: 1 },
];

// ---------- 供应商列表 ----------
const loading = ref(false);
const rows = ref<AiProviderVO[]>([]);

const columns: YTableColumn<AiProviderVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'name', label: '供应商名称', minWidth: 130 },
  { prop: 'code', label: '编码', width: 120 },
  { prop: 'baseUrl', label: 'base-url', minWidth: 240, showOverflowTooltip: true },
  { prop: 'defaultModel', label: '默认模型', minWidth: 130 },
  { prop: 'activeKeyCount', label: '启用 Key', width: 90, align: 'center' },
  { prop: 'status', label: '状态', width: 80, align: 'center', slot: 'status' },
  { prop: 'sort', label: '排序', width: 70, align: 'center' },
  { prop: 'createTime', label: '创建时间', width: 170 },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await listProviders();
  } finally {
    loading.value = false;
  }
}

// ---------- 供应商新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);

/** base-url 占位建议按 code 区分：保留字 anthropic/gemini 走官方 SDK（源站地址，无需版本段），其余按 OpenAI 兼容（须含 /v1） */
const baseUrlPlaceholder = computed(() => {
  const code = (formModel.code as string | undefined)?.trim().toLowerCase();
  if (code === 'anthropic') return 'Anthropic 源站地址，默认 https://api.anthropic.com';
  if (code === 'gemini') return 'Gemini 源站地址，默认 https://generativelanguage.googleapis.com';
  return 'OpenAI 兼容地址，须含 /v1';
});

const formSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'name',
    label: '供应商名称',
    component: 'input',
    placeholder: '如 阿里云百炼',
    rules: [{ required: true, message: '供应商名称不能为空', trigger: 'blur' }],
  },
  {
    field: 'code',
    label: '编码',
    component: 'input',
    placeholder: '如 dashscope；保留字 anthropic / gemini，其余按 OpenAI 兼容接入',
    props: { disabled: isEdit.value },
    rules: [
      { required: true, message: '编码不能为空', trigger: 'blur' },
      { pattern: /^[a-z0-9-]{2,64}$/, message: '仅限小写字母/数字/中划线（2-64 位）', trigger: 'blur' },
    ],
  },
  {
    field: 'baseUrl',
    label: 'base-url',
    component: 'input',
    placeholder: baseUrlPlaceholder.value,
    rules: [
      { required: true, message: 'base-url 不能为空', trigger: 'blur' },
      { pattern: /^https?:\/\/.+/, message: '须以 http(s):// 开头', trigger: 'blur' },
    ],
  },
  { field: 'defaultModel', label: '默认模型', component: 'input', placeholder: '如 qwen-plus（对话未选模型时兜底）' },
  { field: 'sort', label: '排序', component: 'number', props: { min: 0 } },
  { field: 'status', label: '状态', component: 'radio', options: STATUS_OPTIONS },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { sort: 0, status: 0 });
  dialogVisible.value = true;
}

function openEdit(row: AiProviderVO): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { ...row });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: AiProviderSaveBody = {
      id: formModel.id as string | undefined,
      name: formModel.name as string,
      code: formModel.code as string,
      baseUrl: formModel.baseUrl as string,
      defaultModel: formModel.defaultModel as string | undefined,
      sort: formModel.sort as number | undefined,
      status: formModel.status as number | undefined,
      remark: formModel.remark as string | undefined,
    };
    if (isEdit.value) {
      await updateProvider(body);
    } else {
      await createProvider(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

async function handleDelete(row: AiProviderVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除供应商「${row.name}」吗？其 API Key 将一并删除。`, '提示', {
    type: 'warning',
  });
  await deleteProvider(row.id);
  ElMessage.success('删除成功');
  await load();
}

// ---------- Key 管理 ----------
const keyDialogVisible = ref(false);
const keyLoading = ref(false);
const keyProvider = ref<AiProviderVO>();
const keyRows = ref<AiApiKeyVO[]>([]);

async function openKeys(row: AiProviderVO): Promise<void> {
  keyProvider.value = row;
  keyDialogVisible.value = true;
  await loadKeys();
}

async function loadKeys(): Promise<void> {
  if (!keyProvider.value) return;
  keyLoading.value = true;
  try {
    keyRows.value = await listKeys(keyProvider.value.id);
  } finally {
    keyLoading.value = false;
  }
}

const keyColumns: YTableColumn<AiApiKeyVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'label', label: '备注名', minWidth: 120 },
  { prop: 'keyMasked', label: 'API Key', minWidth: 130 },
  { prop: 'status', label: '状态', width: 80, align: 'center', slot: 'status' },
  { prop: 'failCount', label: '健康状态', width: 110, align: 'center', slot: 'health' },
  { prop: 'createTime', label: '创建时间', width: 170 },
];

/** 健康状态文案：连续失败 0 次=正常；>0 且启用=异常；>0 且停用=已自动停用（达阈值被后端停用） */
function keyHealth(row: AiApiKeyVO): { text: string; type: 'success' | 'warning' | 'danger' } {
  const failCount = row.failCount ?? 0;
  if (failCount === 0) return { text: '正常', type: 'success' };
  if (row.status === 0) return { text: `连败 ${failCount} 次`, type: 'warning' };
  return { text: `连败 ${failCount} 次·已停用`, type: 'danger' };
}

// Key 新增 / 编辑（编辑时 Key 明文留空 = 不变更，已存 Key 不可回看）
const keyFormVisible = ref(false);
const keyConfirmLoading = ref(false);
const keyFormRef = ref<InstanceType<typeof YForm>>();
const keyFormModel = reactive<Record<string, unknown>>({});
const isKeyEdit = computed(() => !!keyFormModel.id);

const keyFormSchemas = computed<YFormSchema[]>(() => [
  { field: 'label', label: '备注名', component: 'input', placeholder: '如 主 Key / 备用 Key' },
  {
    field: 'apiKey',
    label: 'Key 明文',
    component: 'input',
    placeholder: isKeyEdit.value ? '留空则不变更（已存 Key 不可回看）' : '请输入 API Key 明文',
    props: { type: 'password', showPassword: true },
    rules: isKeyEdit.value
      ? []
      : [{ required: true, message: 'API Key 不能为空', trigger: 'blur' }],
  },
  { field: 'status', label: '状态', component: 'radio', options: STATUS_OPTIONS },
]);

function openKeyAdd(): void {
  Object.keys(keyFormModel).forEach((k) => delete keyFormModel[k]);
  Object.assign(keyFormModel, { status: 0 });
  keyFormVisible.value = true;
}

function openKeyEdit(row: AiApiKeyVO): void {
  Object.keys(keyFormModel).forEach((k) => delete keyFormModel[k]);
  Object.assign(keyFormModel, { id: row.id, label: row.label, status: row.status });
  keyFormVisible.value = true;
}

async function handleKeySubmit(): Promise<void> {
  const valid = await keyFormRef.value?.validate()?.catch(() => false);
  if (!valid || !keyProvider.value) return;
  keyConfirmLoading.value = true;
  try {
    const body: AiApiKeySaveBody = {
      id: keyFormModel.id as string | undefined,
      providerId: keyProvider.value.id,
      label: keyFormModel.label as string | undefined,
      apiKey: keyFormModel.apiKey as string | undefined,
      status: keyFormModel.status as number | undefined,
    };
    if (isKeyEdit.value) {
      await updateKey(body);
    } else {
      await createKey(body);
    }
    ElMessage.success(isKeyEdit.value ? '修改成功' : '新增成功');
    keyFormVisible.value = false;
    await Promise.all([loadKeys(), load()]);
  } finally {
    keyConfirmLoading.value = false;
  }
}

async function handleKeyDelete(row: AiApiKeyVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除该 API Key（${row.keyMasked}）吗？`, '提示', { type: 'warning' });
  await deleteKey(row.id);
  ElMessage.success('删除成功');
  await Promise.all([loadKeys(), load()]);
}

onMounted(load);
</script>

<template>
  <div class="page-card">
    <div class="ai-provider__bar">
      <ElButton v-hasPermi="'ai:provider:add'" type="primary" :icon="Plus" @click="openAdd">
        新增供应商
      </ElButton>
    </div>

    <YTable :loading="loading" :data="rows" :columns="columns" row-key="id" hide-pagination @refresh="load">
      <template #status="{ row }">
        <ElTag :type="(row as AiProviderVO).status === 0 ? 'success' : 'info'" size="small">
          {{ (row as AiProviderVO).status === 0 ? '启用' : '停用' }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton v-hasPermi="'ai:provider:edit'" link type="primary" @click="openKeys(row as AiProviderVO)">
            Key 管理
          </ElButton>
          <ElButton v-hasPermi="'ai:provider:edit'" link type="primary" @click="openEdit(row as AiProviderVO)">
            编辑
          </ElButton>
          <ElButton v-hasPermi="'ai:provider:remove'" link type="danger" @click="handleDelete(row as AiProviderVO)">
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <!-- 供应商表单 -->
    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑供应商' : '新增供应商'"
      width="520px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="100px" />
    </YDialog>

    <!-- Key 管理 -->
    <YDialog
      v-model="keyDialogVisible"
      :title="`API Key 管理 — ${keyProvider?.name ?? ''}`"
      width="720px"
      :show-footer="false"
    >
      <div class="ai-provider__bar">
        <ElButton v-hasPermi="'ai:provider:edit'" type="primary" size="small" :icon="Plus" @click="openKeyAdd">
          新增 Key
        </ElButton>
      </div>
      <YTable :loading="keyLoading" :data="keyRows" :columns="keyColumns" row-key="id" hide-pagination @refresh="loadKeys">
        <template #status="{ row }">
          <ElTag :type="(row as AiApiKeyVO).status === 0 ? 'success' : 'info'" size="small">
            {{ (row as AiApiKeyVO).status === 0 ? '启用' : '停用' }}
          </ElTag>
        </template>
        <template #health="{ row }">
          <ElTag :type="keyHealth(row as AiApiKeyVO).type" size="small">
            {{ keyHealth(row as AiApiKeyVO).text }}
          </ElTag>
        </template>
        <ElTableColumn label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <ElButton v-hasPermi="'ai:provider:edit'" link type="primary" @click="openKeyEdit(row as AiApiKeyVO)">
              编辑
            </ElButton>
            <ElButton v-hasPermi="'ai:provider:remove'" link type="danger" @click="handleKeyDelete(row as AiApiKeyVO)">
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </YTable>
    </YDialog>

    <!-- Key 表单 -->
    <YDialog
      v-model="keyFormVisible"
      :title="isKeyEdit ? '编辑 Key' : '新增 Key'"
      width="460px"
      :confirm-loading="keyConfirmLoading"
      @confirm="handleKeySubmit"
    >
      <YForm ref="keyFormRef" v-model="keyFormModel" :schemas="keyFormSchemas" label-width="90px" />
    </YDialog>
  </div>
</template>

<style scoped>
.ai-provider__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
