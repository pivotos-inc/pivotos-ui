<script setup lang="ts">
defineOptions({ name: 'ToolMigration' });
import { reactive, ref } from 'vue';
import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElMessage,
  ElMessageBox,
  ElTable,
  ElTableColumn,
  ElTag,
  ElUpload,
  ElSteps,
  ElStep,
  ElScrollbar,
} from 'element-plus';
import type { UploadFile } from 'element-plus';
import { Plus, Upload, Search, Operation } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormSchema, YTableColumn } from '@pivotos/ui';
import {
  type MigrationTaskVO,
  type MigrationTaskCreateRequest,
  type MigrationStep,
  type MigrationArtifact,
  MIGRATION_STATUS_MAP,
  getMigrationTask,
  createMigrationTask,
  uploadMigrationArchive,
  parseMigrationTask,
  analyzeMigrationTask,
  generateMigrationPlan,
  listMigrationSteps,
  executeMigrationStep,
  reviewMigrationStep,
  listStepArtifacts,
  getMigrationArtifact,
  applyMigrationArtifact,
  unapplyMigrationArtifact,
  applyStepArtifacts,
  completeMigrationTask,
  rollbackMigrationTask,
} from '@/api/system/migration';
import { useTablePage } from '@/hooks';

// ==================== 列表 ====================

const { loading, rows, total, params, load, search, reset } = useTablePage<MigrationTaskVO, Record<string, unknown>>({
  url: '/migration/task/page',
  query: {},
});

const searchSchemas: YFormSchema[] = [];

const columns: YTableColumn<MigrationTaskVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'name', label: '任务名称', minWidth: 160 },
  { prop: 'backendFramework', label: '后端框架', width: 150 },
  { prop: 'frontendFramework', label: '前端框架', width: 150 },
  { prop: 'status', label: '状态', width: 100, align: 'center', slot: 'status' },
  { prop: 'totalSteps', label: '总步骤', width: 80, align: 'center' },
  { prop: 'completedSteps', label: '已完成', width: 80, align: 'center' },
  { prop: 'createTime', label: '创建时间', width: 170 },
];

// ==================== 新增 ====================

const createVisible = ref(false);
const createLoading = ref(false);
const createFormRef = ref<InstanceType<typeof YForm>>();
const createModel = reactive<Record<string, unknown>>({});

const FRAMEWORK_OPTIONS_BE = [
  { label: 'Spring Boot 2.x', value: 'spring-boot-2.x' },
  { label: 'Spring Boot 3.x', value: 'spring-boot-3.x' },
  { label: 'SSM（Spring MVC）', value: 'ssm' },
  { label: 'Struts2', value: 'struts2' },
  { label: '其他', value: 'other' },
];

const FRAMEWORK_OPTIONS_FE = [
  { label: 'Vue 2 Options API', value: 'vue2-options' },
  { label: 'Vue 3 Composition API', value: 'vue3-composition' },
  { label: 'React', value: 'react' },
  { label: 'JSP/Thymeleaf', value: 'jsp' },
  { label: '其他', value: 'other' },
];

const createFormSchemas: YFormSchema[] = [
  {
    field: 'name',
    label: '任务名称',
    component: 'input',
    placeholder: '请输入迁移任务名称',
    rules: [{ required: true, message: '任务名称不能为空', trigger: 'blur' }],
  },
  {
    field: 'backendFramework',
    label: '后端框架',
    component: 'select',
    placeholder: '请选择源后端框架',
    options: FRAMEWORK_OPTIONS_BE,
  },
  {
    field: 'frontendFramework',
    label: '前端框架',
    component: 'select',
    placeholder: '请选择源前端框架',
    options: FRAMEWORK_OPTIONS_FE,
  },
  {
    field: 'description',
    label: '任务描述',
    component: 'textarea',
    placeholder: '可选，描述迁移目标与背景',
  },
];

function openCreate(): void {
  Object.keys(createModel).forEach((k) => delete createModel[k]);
  createVisible.value = true;
}

async function handleCreate(): Promise<void> {
  const valid = await createFormRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  createLoading.value = true;
  try {
    const body: MigrationTaskCreateRequest = {
      name: createModel.name as string,
      description: (createModel.description as string) || undefined,
      backendFramework: (createModel.backendFramework as string) || undefined,
      frontendFramework: (createModel.frontendFramework as string) || undefined,
    };
    await createMigrationTask(body);
    ElMessage.success('任务创建成功');
    createVisible.value = false;
    await load();
  } finally {
    createLoading.value = false;
  }
}

// ==================== 详情 / 操作 ====================

const detailVisible = ref(false);
const detailTask = ref<MigrationTaskVO | null>(null);

// 上传相关
const backendFile = ref<File | null>(null);
const frontendFile = ref<File | null>(null);
const uploadLoading = ref(false);

// 操作 loading 状态
const parseLoading = ref(false);
const analyzeLoading = ref(false);
const planLoading = ref(false);

// 迁移步骤列表
const migrationSteps = ref<MigrationStep[]>([]);

const STEP_TYPE_MAP: Record<string, { label: string; type: string }> = {
  BACKEND:  { label: '后端', type: 'primary' },
  FRONTEND: { label: '前端', type: 'success' },
  DB:       { label: '数据库', type: 'warning' },
};

const STEP_STATUS_MAP: Record<number, { label: string; type: string }> = {
  0: { label: '待执行', type: 'info' },
  1: { label: '执行中', type: 'warning' },
  2: { label: '自测通过', type: 'success' },
  3: { label: '评审中', type: 'warning' },
  4: { label: '已通过', type: 'success' },
  5: { label: '已驳回', type: 'danger' },
  6: { label: '已完成', type: 'success' },
  7: { label: '失败', type: 'danger' },
  8: { label: '回滚中', type: 'warning' },
  9: { label: '已回滚', type: 'info' },
};

const ARTIFACT_TYPE_MAP: Record<string, { label: string; type: string }> = {
  JAVA:   { label: 'Java', type: 'primary' },
  VUE:    { label: 'Vue', type: 'success' },
  FLYWAY: { label: 'Flyway', type: 'warning' },
  OTHER:  { label: '其他', type: 'info' },
};

// 步骤执行 / 评审 / 产物查看状态
const execLoadingStepId = ref<string | null>(null);
const reviewLoadingStepId = ref<string | null>(null);
const artifactVisible = ref(false);
const artifactLoading = ref(false);
const artifactStep = ref<MigrationStep | null>(null);
const stepArtifacts = ref<MigrationArtifact[]>([]);
const artifactContent = ref<string | null>(null);

async function openDetail(row: MigrationTaskVO): Promise<void> {
  const task = await getMigrationTask(row.id);
  detailTask.value = task;
  backendFile.value = null;
  frontendFile.value = null;
  migrationSteps.value = [];
  if (task.status >= 6) {
    migrationSteps.value = await listMigrationSteps(task.id).catch(() => []);
  }
  detailVisible.value = true;
}

function onBackendFileChange(uploadFile: UploadFile): void {
  backendFile.value = uploadFile.raw ?? null;
}

function onFrontendFileChange(uploadFile: UploadFile): void {
  frontendFile.value = uploadFile.raw ?? null;
}

async function handleUpload(): Promise<void> {
  if (!detailTask.value) return;
  if (!backendFile.value && !frontendFile.value) {
    ElMessage.warning('请至少选择一个源码包');
    return;
  }
  uploadLoading.value = true;
  try {
    if (backendFile.value) {
      const count = await uploadMigrationArchive(detailTask.value.id, 'BACKEND', backendFile.value);
      ElMessage.success(`后端源码上传成功，共 ${count} 个文件`);
    }
    if (frontendFile.value) {
      const count = await uploadMigrationArchive(detailTask.value.id, 'FRONTEND', frontendFile.value);
      ElMessage.success(`前端源码上传成功，共 ${count} 个文件`);
    }
    const updated = await getMigrationTask(detailTask.value.id);
    detailTask.value = updated;
    await load();
  } finally {
    uploadLoading.value = false;
  }
}

async function handleParse(): Promise<void> {
  if (!detailTask.value) return;
  await ElMessageBox.confirm('确定开始解析源码，生成 IR 节点吗？', '解析确认', { type: 'info' });
  parseLoading.value = true;
  try {
    const count = await parseMigrationTask(detailTask.value.id);
    ElMessage.success(`解析完成，共生成 ${count} 个 IR 节点`);
    const updated = await getMigrationTask(detailTask.value.id);
    detailTask.value = updated;
    await load();
  } finally {
    parseLoading.value = false;
  }
}

async function handleAnalyze(): Promise<void> {
  if (!detailTask.value) return;
  await ElMessageBox.confirm('确定调用 AI 进行架构分析吗？此操作将消耗 AI Token。', 'AI 分析确认', { type: 'info' });
  analyzeLoading.value = true;
  try {
    await analyzeMigrationTask(detailTask.value.id);
    ElMessage.success('架构分析完成，报告已生成');
    const updated = await getMigrationTask(detailTask.value.id);
    detailTask.value = updated;
    await load();
  } finally {
    analyzeLoading.value = false;
  }
}

async function handlePlan(): Promise<void> {
  if (!detailTask.value) return;
  await ElMessageBox.confirm('确定调用 AI 生成迁移步骤计划吗？此操作将消耗 AI Token。', 'AI 计划确认', { type: 'info' });
  planLoading.value = true;
  try {
    await generateMigrationPlan(detailTask.value.id);
    ElMessage.success('迁移计划已生成');
    const updated = await getMigrationTask(detailTask.value.id);
    detailTask.value = updated;
    migrationSteps.value = await listMigrationSteps(updated.id).catch(() => []);
    await load();
  } finally {
    planLoading.value = false;
  }
}

// ==================== 步骤执行 / 评审 / 产物 ====================

async function refreshDetailAndSteps(): Promise<void> {
  if (!detailTask.value) return;
  const updated = await getMigrationTask(detailTask.value.id);
  detailTask.value = updated;
  migrationSteps.value = await listMigrationSteps(updated.id).catch(() => []);
  await load();
}

async function handleExecuteStep(step: MigrationStep): Promise<void> {
  await ElMessageBox.confirm(
    `确定执行步骤「${step.name}」吗？将调用 AI 生成代码产物，消耗 AI Token。`,
    '执行确认',
    { type: 'info' },
  );
  execLoadingStepId.value = step.id;
  try {
    await executeMigrationStep(step.id);
    ElMessage.success('步骤执行完成，产物已生成，请评审');
    await refreshDetailAndSteps();
  } finally {
    execLoadingStepId.value = null;
  }
}

async function handleReviewPass(step: MigrationStep): Promise<void> {
  await ElMessageBox.confirm(`确认通过步骤「${step.name}」的评审吗？`, '评审确认', { type: 'success' });
  reviewLoadingStepId.value = step.id;
  try {
    await reviewMigrationStep(step.id, 'PASS');
    ElMessage.success('评审通过，步骤已完成');
    await refreshDetailAndSteps();
  } finally {
    reviewLoadingStepId.value = null;
  }
}

async function handleReviewReject(step: MigrationStep): Promise<void> {
  const { value } = await ElMessageBox.prompt('请填写驳回意见', '评审驳回', {
    confirmButtonText: '驳回',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '驳回原因与修改建议',
    type: 'warning',
  });
  reviewLoadingStepId.value = step.id;
  try {
    await reviewMigrationStep(step.id, 'REJECT', value || undefined);
    ElMessage.warning('已驳回，可重新执行该步骤');
    await refreshDetailAndSteps();
  } finally {
    reviewLoadingStepId.value = null;
  }
}

async function openArtifacts(step: MigrationStep): Promise<void> {
  artifactStep.value = step;
  artifactContent.value = null;
  stepArtifacts.value = [];
  artifactVisible.value = true;
  artifactLoading.value = true;
  try {
    stepArtifacts.value = await listStepArtifacts(step.id).catch(() => []);
  } finally {
    artifactLoading.value = false;
  }
}

async function viewArtifactContent(artifact: MigrationArtifact): Promise<void> {
  const full = await getMigrationArtifact(artifact.id);
  artifactContent.value = full.generatedContent ?? full.originalContent ?? '（无内容）';
}

// ==================== 落盘 / 完成 / 回滚 ====================

const applyLoadingArtifactId = ref<string | null>(null);
const applyStepLoading = ref(false);
const completeLoading = ref(false);
const rollbackLoading = ref(false);

async function reloadArtifacts(): Promise<void> {
  if (!artifactStep.value) return;
  stepArtifacts.value = await listStepArtifacts(artifactStep.value.id).catch(() => []);
}

async function handleApplyArtifact(artifact: MigrationArtifact): Promise<void> {
  applyLoadingArtifactId.value = artifact.id;
  try {
    await applyMigrationArtifact(artifact.id);
    ElMessage.success(`产物已落盘：${artifact.relativePath}`);
    await reloadArtifacts();
  } finally {
    applyLoadingArtifactId.value = null;
  }
}

async function handleUnapplyArtifact(artifact: MigrationArtifact): Promise<void> {
  await ElMessageBox.confirm(`确定撤销落盘「${artifact.relativePath}」吗？将删除目标文件。`, '撤销确认', {
    type: 'warning',
  });
  applyLoadingArtifactId.value = artifact.id;
  try {
    await unapplyMigrationArtifact(artifact.id);
    ElMessage.success('落盘已撤销');
    await reloadArtifacts();
  } finally {
    applyLoadingArtifactId.value = null;
  }
}

async function handleApplyStep(step: MigrationStep): Promise<void> {
  await ElMessageBox.confirm(`确定将步骤「${step.name}」的全部产物落盘到目标目录吗？`, '落盘确认', {
    type: 'info',
  });
  applyStepLoading.value = true;
  try {
    const count = await applyStepArtifacts(step.id);
    ElMessage.success(`落盘完成，共 ${count} 个产物`);
    await refreshDetailAndSteps();
  } finally {
    applyStepLoading.value = false;
  }
}

async function handleCompleteTask(): Promise<void> {
  if (!detailTask.value) return;
  await ElMessageBox.confirm('确定完成该迁移任务吗？', '完成确认', { type: 'success' });
  completeLoading.value = true;
  try {
    await completeMigrationTask(detailTask.value.id);
    ElMessage.success('任务已完成');
    await refreshDetailAndSteps();
  } finally {
    completeLoading.value = false;
  }
}

async function handleRollbackTask(): Promise<void> {
  if (!detailTask.value) return;
  await ElMessageBox.confirm(
    '回滚将删除本任务全部已落盘文件，且任务状态置为已回滚，该操作不可恢复。确定继续吗？',
    '任务回滚',
    { type: 'error', confirmButtonText: '确定回滚', confirmButtonClass: 'el-button--danger' },
  );
  rollbackLoading.value = true;
  try {
    const count = await rollbackMigrationTask(detailTask.value.id);
    ElMessage.success(`回滚完成，删除已落盘文件 ${count} 个`);
    await refreshDetailAndSteps();
  } finally {
    rollbackLoading.value = false;
  }
}

// 步骤进度映射（状态 → 当前步骤序号）
function statusToStep(status: number): number {
  if (status < 2) return 0;
  if (status < 4) return 1;
  if (status < 6) return 2;
  if (status < 8) return 3;
  return 4;
}
</script>

<template>
  <div class="page-card">
    <!-- 顶部工具栏 -->
    <div class="migration-bar">
      <ElButton v-hasPermi="'migration:task:create'" type="primary" :icon="Plus" @click="openCreate">
        新建迁移任务
      </ElButton>
    </div>

    <YSearchForm v-model="params" :schemas="searchSchemas" @search="search" @reset="reset" />

    <!-- 任务列表 -->
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
      <template #status="{ row }">
        <ElTag :type="(MIGRATION_STATUS_MAP[(row as MigrationTaskVO).status]?.type as any) ?? 'info'" size="small">
          {{ MIGRATION_STATUS_MAP[(row as MigrationTaskVO).status]?.label ?? '未知' }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'migration:task:query'"
            link
            type="primary"
            :icon="Search"
            @click="openDetail(row as MigrationTaskVO)"
          >
            详情
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <!-- 新建任务弹窗 -->
    <YDialog
      v-model="createVisible"
      title="新建迁移任务"
      width="520px"
      :confirm-loading="createLoading"
      @confirm="handleCreate"
    >
      <YForm ref="createFormRef" v-model="createModel" :schemas="createFormSchemas" label-width="90px" />
    </YDialog>

    <!-- 任务详情 / 操作弹窗 -->
    <YDialog
      v-model="detailVisible"
      title="迁移任务详情"
      width="760px"
      :show-footer="false"
    >
      <template v-if="detailTask">
        <!-- 流水线步骤指示器 -->
        <ElSteps :active="statusToStep(detailTask.status)" finish-status="success" class="migration-steps">
          <ElStep title="创建 & 上传" />
          <ElStep title="解析源码" />
          <ElStep title="架构分析" />
          <ElStep title="计划生成" />
          <ElStep title="执行完成" />
        </ElSteps>

        <!-- 基本信息 -->
        <ElDescriptions :column="2" border class="migration-desc">
          <ElDescriptionsItem label="任务名称" :span="2">{{ detailTask.name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="后端框架">{{ detailTask.backendFramework ?? '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="前端框架">{{ detailTask.frontendFramework ?? '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="当前状态">
            <ElTag :type="(MIGRATION_STATUS_MAP[detailTask.status]?.type as any) ?? 'info'" size="small">
              {{ MIGRATION_STATUS_MAP[detailTask.status]?.label ?? '未知' }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="创建时间">{{ detailTask.createTime ?? '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="detailTask.sourceSummary" label="解析摘要" :span="2">
            <code class="migration-json">{{ detailTask.sourceSummary }}</code>
          </ElDescriptionsItem>
        </ElDescriptions>

        <!-- 操作区 -->
        <div class="migration-actions">
          <!-- 阶段 1：上传源码包（状态 0-2 可上传） -->
          <div v-if="detailTask.status <= 2" class="migration-action-block">
            <div class="migration-action-title"><Upload style="width: 14px; margin-right: 4px" />上传源码包</div>
            <div class="migration-upload-row">
              <span class="migration-upload-label">后端源码（.zip）</span>
              <ElUpload
                :auto-upload="false"
                :show-file-list="true"
                :limit="1"
                accept=".zip"
                @change="onBackendFileChange"
              >
                <ElButton size="small" type="default">选择后端 ZIP</ElButton>
              </ElUpload>
            </div>
            <div class="migration-upload-row">
              <span class="migration-upload-label">前端源码（.zip）</span>
              <ElUpload
                :auto-upload="false"
                :show-file-list="true"
                :limit="1"
                accept=".zip"
                @change="onFrontendFileChange"
              >
                <ElButton size="small" type="default">选择前端 ZIP</ElButton>
              </ElUpload>
            </div>
            <ElButton
              v-hasPermi="'migration:task:execute'"
              type="primary"
              :loading="uploadLoading"
              :icon="Upload"
              @click="handleUpload"
            >
              上传
            </ElButton>
          </div>

          <!-- 阶段 2：解析源码（状态 = 2 已上传） -->
          <div v-if="detailTask.status === 2" class="migration-action-block">
            <div class="migration-action-title"><Operation style="width: 14px; margin-right: 4px" />解析源码</div>
            <p class="migration-action-desc">对已上传的源码文件进行静态解析，生成 IR 节点与产物索引。</p>
            <ElButton
              v-hasPermi="'migration:task:execute'"
              type="success"
              :loading="parseLoading"
              @click="handleParse"
            >
              开始解析
            </ElButton>
          </div>

          <!-- 阶段 3：AI 架构分析（状态 = 4 已分析） -->
          <div v-if="detailTask.status === 4" class="migration-action-block">
            <div class="migration-action-title">🤖 AI 架构分析</div>
            <p class="migration-action-desc">调用 AI 分析已解析的 IR 节点，生成架构分析报告与迁移建议。</p>
            <ElButton
              v-hasPermi="'migration:task:execute'"
              type="warning"
              :loading="analyzeLoading"
              @click="handleAnalyze"
            >
              生成分析报告
            </ElButton>
          </div>

          <!-- 分析报告展示 -->
          <div v-if="detailTask.analysisReport" class="migration-report-block">
            <div class="migration-action-title">📋 架构分析报告</div>
            <pre class="migration-report">{{ detailTask.analysisReport }}</pre>
          </div>

          <!-- 阶段 4：AI 计划生成（状态 4/5/6 显示） -->
          <div v-if="detailTask.status >= 4" class="migration-action-block">
            <div class="migration-action-title">📄 迁移计划生成</div>
            <p class="migration-action-desc">基于架构分析报告，调用 AI 生成结构化迁移步骤计划。</p>
            <!-- 状态 4：可以生成 -->
            <ElButton
              v-if="detailTask.status === 4"
              v-hasPermi="'migration:task:execute'"
              type="primary"
              :loading="planLoading"
              @click="handlePlan"
            >
              生成迁移计划
            </ElButton>
            <!-- 状态 5：计划中 -->
            <ElTag v-else-if="detailTask.status === 5" type="warning">计划生成中...</ElTag>
            <!-- 状态 6+：展示步骤列表 -->
            <template v-else-if="detailTask.status >= 6">
              <div class="migration-plan-stats">
                共 <strong>{{ detailTask.totalSteps ?? 0 }}</strong> 个步骤，已完成 <strong>{{ detailTask.completedSteps ?? 0 }}</strong> 个
              </div>
              <ElTable :data="migrationSteps" border size="small" class="migration-step-table">
                <ElTableColumn prop="stepNo" label="#" width="50" align="center" />
                <ElTableColumn prop="name" label="步骤名称" min-width="140" />
                <ElTableColumn label="类型" width="80" align="center">
                  <template #default="{ row }">
                    <ElTag :type="(STEP_TYPE_MAP[(row as MigrationStep).stepType]?.type as any) ?? 'info'" size="small">
                      {{ STEP_TYPE_MAP[(row as MigrationStep).stepType]?.label ?? (row as MigrationStep).stepType }}
                    </ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn prop="moduleName" label="模块" width="120" />
                <ElTableColumn label="状态" width="90" align="center">
                  <template #default="{ row }">
                    <ElTag :type="(STEP_STATUS_MAP[(row as MigrationStep).status]?.type as any) ?? 'info'" size="small">
                      {{ STEP_STATUS_MAP[(row as MigrationStep).status]?.label ?? '未知' }}
                    </ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="操作" width="230" align="center">
                  <template #default="{ row }">
                    <template v-if="[0, 5, 7].includes((row as MigrationStep).status)">
                      <ElButton
                        v-hasPermi="'migration:task:execute'"
                        link
                        type="primary"
                        size="small"
                        :loading="execLoadingStepId === (row as MigrationStep).id"
                        @click="handleExecuteStep(row as MigrationStep)"
                      >
                        {{ (row as MigrationStep).status === 0 ? '执行' : (row as MigrationStep).status === 5 ? '重新执行' : '重试' }}
                      </ElButton>
                    </template>
                    <template v-if="(row as MigrationStep).status === 2">
                      <ElButton
                        v-hasPermi="'migration:task:review'"
                        link
                        type="success"
                        size="small"
                        :loading="reviewLoadingStepId === (row as MigrationStep).id"
                        @click="handleReviewPass(row as MigrationStep)"
                      >
                        通过
                      </ElButton>
                      <ElButton
                        v-hasPermi="'migration:task:review'"
                        link
                        type="danger"
                        size="small"
                        :loading="reviewLoadingStepId === (row as MigrationStep).id"
                        @click="handleReviewReject(row as MigrationStep)"
                      >
                        驳回
                      </ElButton>
                    </template>
                    <ElButton
                      v-if="(row as MigrationStep).status === 6"
                      v-hasPermi="'migration:task:execute'"
                      link
                      type="success"
                      size="small"
                      :loading="applyStepLoading"
                      @click="handleApplyStep(row as MigrationStep)"
                    >
                      落盘
                    </ElButton>
                    <ElButton
                      v-if="(row as MigrationStep).status >= 2 && (row as MigrationStep).status !== 5"
                      link
                      type="info"
                      size="small"
                      @click="openArtifacts(row as MigrationStep)"
                    >
                      产物
                    </ElButton>
                  </template>
                </ElTableColumn>
                <ElTableColumn prop="irSnapshot" label="说明" min-width="140" show-overflow-tooltip />
              </ElTable>
              <!-- 计划原文（可折叠显示） -->
              <details v-if="detailTask.migrationPlan" class="migration-plan-raw">
                <summary>查看 AI 原始输出</summary>
                <ElScrollbar max-height="280px">
                  <pre class="migration-report">{{ detailTask.migrationPlan }}</pre>
                </ElScrollbar>
              </details>
            </template>
          </div>

          <!-- 阶段 5：任务收尾（状态 7/8 显示） -->
          <div v-if="detailTask.status === 7 || detailTask.status === 8" class="migration-action-block">
            <div class="migration-action-title">🏁 任务收尾</div>
            <p class="migration-action-desc">全部步骤评审通过后可完成任务；回滚将删除全部已落盘文件。</p>
            <ElButton
              v-if="detailTask.status === 8"
              v-hasPermi="'migration:task:execute'"
              type="success"
              :loading="completeLoading"
              @click="handleCompleteTask"
            >
              完成任务
            </ElButton>
            <ElButton
              v-hasPermi="'migration:task:execute'"
              type="danger"
              :loading="rollbackLoading"
              @click="handleRollbackTask"
            >
              任务回滚
            </ElButton>
          </div>
        </div>
      </template>
    </YDialog>

    <!-- 步骤产物查看对话框 -->
    <ElDialog
      v-model="artifactVisible"
      :title="`步骤产物：${artifactStep?.name ?? ''}`"
      width="720px"
      append-to-body
    >
      <ElTable v-loading="artifactLoading" :data="stepArtifacts" border size="small">
        <ElTableColumn prop="relativePath" label="产物路径" min-width="280" show-overflow-tooltip />
        <ElTableColumn label="类型" width="90" align="center">
          <template #default="{ row }">
            <ElTag :type="(ARTIFACT_TYPE_MAP[(row as MigrationArtifact).artifactType]?.type as any) ?? 'info'" size="small">
              {{ ARTIFACT_TYPE_MAP[(row as MigrationArtifact).artifactType]?.label ?? (row as MigrationArtifact).artifactType }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="已落盘" width="80" align="center">
          <template #default="{ row }">
            <ElTag :type="(row as MigrationArtifact).applied ? 'success' : 'info'" size="small">
              {{ (row as MigrationArtifact).applied ? '是' : '否' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="190" align="center">
          <template #default="{ row }">
            <ElButton link type="primary" size="small" @click="viewArtifactContent(row as MigrationArtifact)">
              查看代码
            </ElButton>
            <ElButton
              v-if="!(row as MigrationArtifact).applied"
              v-hasPermi="'migration:task:execute'"
              link
              type="success"
              size="small"
              :loading="applyLoadingArtifactId === (row as MigrationArtifact).id"
              @click="handleApplyArtifact(row as MigrationArtifact)"
            >
              应用
            </ElButton>
            <ElButton
              v-else
              v-hasPermi="'migration:task:execute'"
              link
              type="danger"
              size="small"
              :loading="applyLoadingArtifactId === (row as MigrationArtifact).id"
              @click="handleUnapplyArtifact(row as MigrationArtifact)"
            >
              撤销
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <ElScrollbar v-if="artifactContent !== null" max-height="320px" class="migration-artifact-content">
        <pre class="migration-report">{{ artifactContent }}</pre>
      </ElScrollbar>
    </ElDialog>
  </div>
</template>

<style scoped>
.migration-bar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.migration-steps {
  margin-bottom: 20px;
}

.migration-desc {
  margin-bottom: 16px;
}

.migration-json {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.migration-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.migration-action-block {
  padding: 14px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
}

.migration-action-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

.migration-action-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0 0 12px;
}

.migration-upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.migration-upload-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  width: 120px;
  flex-shrink: 0;
}

.migration-report-block {
  padding: 14px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
}

.migration-report {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 320px;
  overflow-y: auto;
}

.migration-plan-stats {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 10px;
}

.migration-step-table {
  width: 100%;
  margin-bottom: 12px;
}

.migration-plan-raw {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.migration-plan-raw summary {
  cursor: pointer;
  padding: 4px 0;
  color: var(--el-color-primary);
  user-select: none;
}

.migration-artifact-content {
  margin-top: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px;
}
</style>
