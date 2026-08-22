import { getToken } from '@pivotos/core';
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

// ==================== 进度 SSE 流 ====================

/** 迁移进度 SSE 事件载荷（后端技术方案 §9.3） */
export interface MigrationProgressEvent {
  /** 事件类型：CONNECTED/PARSE/ANALYZE/PLAN/STEP_PROGRESS/REVIEW/APPLY */
  eventType: string;
  taskId: string;
  stepId?: string;
  stepNo?: number;
  stepName?: string;
  /** 业务状态：EXECUTING/DONE/FAILED/APPROVED/REJECTED/APPLIED/ROLLED_BACK 等 */
  status: string;
  /** 进度百分比（0~100，-1 表示失败/不适用） */
  progressPercent?: number;
  message?: string;
  timestamp?: number;
}

/** 迁移进度 SSE 回调 */
export interface MigrationProgressCallbacks {
  onEvent?: (event: MigrationProgressEvent) => void;
  onError?: (msg: string) => void;
}

/**
 * 订阅迁移任务进度流：POST /migration/task/progress，手动解析 SSE。
 * EventSource 不支持 POST + 请求头，故用 fetch + ReadableStream 按空行分帧解析
 * （与 AI 对话流式端点同款约定）；错误统一走 onError，不 reject。
 */
export async function subscribeMigrationProgress(
  taskId: string,
  callbacks: MigrationProgressCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/migration/task/progress?taskId=${taskId}`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        // 后端 token-name = Authorization，未配置 token-prefix，发裸值
        Authorization: getToken(),
      },
      signal,
    });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      callbacks.onError?.('进度流连接失败，请稍后重试');
    }
    return;
  }

  // 流建立前的业务异常（未登录/任务不存在等）返回 JSON 的 R 错误体
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    let msg = `请求失败（HTTP ${response.status}）`;
    try {
      const r = (await response.json()) as { msg?: string };
      if (r.msg) msg = r.msg;
    } catch {
      /* 非 JSON 响应体，保留默认提示 */
    }
    callbacks.onError?.(msg);
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 帧以空行分隔；末段可能不完整，留在 buffer 等下一批
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        dispatchProgressFrame(frame, callbacks);
      }
    }
    // 流结束后 flush decoder 并处理残留 buffer
    buffer += decoder.decode();
    if (buffer.trim()) {
      dispatchProgressFrame(buffer.trim(), callbacks);
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      callbacks.onError?.('进度流连接中断，请稍后重试');
    }
  }
}

/** 解析单个 SSE 帧（event: 名称 + data: JSON），统一分发到 onEvent */
function dispatchProgressFrame(frame: string, callbacks: MigrationProgressCallbacks): void {
  let data = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) {
      data += line.slice(5).trimStart();
    }
  }
  if (!data) return;
  try {
    const payload = JSON.parse(data) as MigrationProgressEvent;
    callbacks.onEvent?.(payload);
  } catch {
    /* 非 JSON 载荷忽略（心跳/注释帧） */
  }
}
