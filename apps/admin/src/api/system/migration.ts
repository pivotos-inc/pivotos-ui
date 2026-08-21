import { request } from '../request';

// ==================== 类型定义 ====================

/** 任务状态枚举 */
export type MigrationTaskStatusEnum =
  | 0  // CREATED
  | 1  // UPLOADING
  | 2  // UPLOADED
  | 3  // ANALYZING
  | 4  // ANALYZED
  | 5  // PLANNING
  | 6  // PLANNED
  | 7  // EXECUTING
  | 8  // EXECUTED
  | 9  // COMPLETED
  | 10 // FAILED
  | 11 // ROLLING_BACK
  | 12; // ROLLED_BACK

export const MIGRATION_STATUS_MAP: Record<number, { label: string; type: string }> = {
  0:  { label: '已创建',  type: 'info' },
  1:  { label: '上传中',  type: 'warning' },
  2:  { label: '已上传',  type: 'success' },
  3:  { label: '分析中',  type: 'warning' },
  4:  { label: '已分析',  type: 'success' },
  5:  { label: '计划中',  type: 'warning' },
  6:  { label: '已计划',  type: 'success' },
  7:  { label: '执行中',  type: 'warning' },
  8:  { label: '已执行',  type: 'success' },
  9:  { label: '已完成',  type: 'success' },
  10: { label: '失败',    type: 'danger' },
  11: { label: '回滚中',  type: 'warning' },
  12: { label: '已回滚',  type: 'info' },
};

/** 迁移任务 VO */
export interface MigrationTaskVO {
  id: string;
  name: string;
  description?: string;
  status: MigrationTaskStatusEnum;
  backendFramework?: string;
  frontendFramework?: string;
  sourceSummary?: string;
  analysisReport?: string;
  migrationPlan?: string;
  currentStepId?: string;
  totalSteps?: number;
  completedSteps?: number;
  rolledBack?: boolean;
  createTime?: string;
  updateTime?: string;
}

/** 创建任务请求 */
export interface MigrationTaskCreateRequest {
  name: string;
  description?: string;
  backendFramework?: string;
  frontendFramework?: string;
}

/** 分页查询参数 */
export interface MigrationTaskQuery {
  pageNum?: number;
  pageSize?: number;
}

// ==================== API 函数 ====================

/** 分页查询任务列表 */
export function pageMigrationTasks(params: MigrationTaskQuery) {
  return request.get<unknown, { list: MigrationTaskVO[]; total: number; pageNum: number; pageSize: number }>(
    '/migration/task/page',
    { params },
  );
}

/** 获取任务详情 */
export function getMigrationTask(id: string): Promise<MigrationTaskVO> {
  return request.get<unknown, MigrationTaskVO>(`/migration/task/${id}`);
}

/** 创建迁移任务 */
export function createMigrationTask(body: MigrationTaskCreateRequest): Promise<string> {
  return request.post<unknown, string>('/migration/task', body);
}

/** 上传源码压缩包（超时独立设置为 5 分钟，支持大文件） */
export function uploadMigrationArchive(taskId: string, fileType: 'BACKEND' | 'FRONTEND', file: File): Promise<number> {
  const form = new FormData();
  form.append('file', file);
  return request.post<unknown, number>(`/migration/task/upload?taskId=${taskId}&fileType=${fileType}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300_000, // 5 分钟，兼容大文件上传
  });
}

/** 解析源码（超时独立设置 5 分钟，大文件解析耗时较长） */
export function parseMigrationTask(taskId: string): Promise<number> {
  return request.post<unknown, number>(`/migration/task/parse?taskId=${taskId}`, null, {
    timeout: 300_000,
  });
}

/** AI 架构分析（超时独立设置 5 分钟，等待 AI 生成报告） */
export function analyzeMigrationTask(taskId: string): Promise<string> {
  return request.post<unknown, string>(`/migration/task/analyze?taskId=${taskId}`, null, {
    timeout: 300_000,
  });
}

/** 迁移步骤 VO */
export interface MigrationStep {
  id: string;
  taskId: string;
  stepNo: number;
  name: string;
  stepType: 'BACKEND' | 'FRONTEND' | 'DB';
  moduleId?: string;
  moduleName?: string;
  status: number;
  irSnapshot?: string;
  generatedArtifacts?: string;
  selfTestResult?: string;
  reviewStatus?: number;
  reviewComment?: string;
  errorMsg?: string;
  createTime?: string;
}

/** 迁移产物 VO */
export interface MigrationArtifact {
  id: string;
  taskId: string;
  stepId: string;
  artifactType: 'JAVA' | 'VUE' | 'FLYWAY' | 'OTHER';
  relativePath: string;
  contentHash?: string;
  originalContent?: string;
  generatedContent?: string;
  applied?: boolean;
  createTime?: string;
}

/** 生成迁移步骤计划（超时独立设置 5 分钟） */
export function generateMigrationPlan(taskId: string): Promise<string> {
  return request.post<unknown, string>(`/migration/task/plan?taskId=${taskId}`, null, {
    timeout: 300_000,
  });
}

/** 查询迁移步骤列表 */
export function listMigrationSteps(taskId: string): Promise<MigrationStep[]> {
  return request.get<unknown, MigrationStep[]>(`/migration/step/list`, { params: { taskId } });
}

/** 执行迁移步骤（AI 生成产物，超时独立设置 5 分钟） */
export function executeMigrationStep(stepId: string): Promise<string> {
  return request.post<unknown, string>(`/migration/step/execute?stepId=${stepId}`, null, {
    timeout: 300_000,
  });
}

/** 人工评审步骤（PASS/REJECT） */
export function reviewMigrationStep(stepId: string, action: 'PASS' | 'REJECT', comment?: string): Promise<void> {
  return request.post<unknown, void>(`/migration/step/review`, null, {
    params: { stepId, action, comment },
  });
}

/** 查询步骤产物列表（不含代码内容） */
export function listStepArtifacts(stepId: string): Promise<MigrationArtifact[]> {
  return request.get<unknown, MigrationArtifact[]>(`/migration/artifact/list`, { params: { stepId } });
}

/** 获取产物详情（含代码内容） */
export function getMigrationArtifact(id: string): Promise<MigrationArtifact> {
  return request.get<unknown, MigrationArtifact>(`/migration/artifact/${id}`);
}

/** 产物落盘到目标目录 */
export function applyMigrationArtifact(artifactId: string): Promise<void> {
  return request.post<unknown, void>(`/migration/artifact/apply?artifactId=${artifactId}`);
}

/** 撤销产物落盘 */
export function unapplyMigrationArtifact(artifactId: string): Promise<void> {
  return request.post<unknown, void>(`/migration/artifact/unapply?artifactId=${artifactId}`);
}

/** 批量落盘指定步骤的全部产物 */
export function applyStepArtifacts(stepId: string): Promise<number> {
  return request.post<unknown, number>(`/migration/artifact/apply-step?stepId=${stepId}`);
}

/** 完成迁移任务 */
export function completeMigrationTask(taskId: string): Promise<void> {
  return request.post<unknown, void>(`/migration/task/complete?taskId=${taskId}`);
}

/** 任务级回滚：删除全部已落盘文件 */
export function rollbackMigrationTask(taskId: string): Promise<number> {
  return request.post<unknown, number>(`/migration/task/rollback?taskId=${taskId}`);
}
