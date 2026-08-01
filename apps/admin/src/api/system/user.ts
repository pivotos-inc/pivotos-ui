import type { PageResult, ResetPasswordBody, UserQuery, UserSaveRequest, UserVO } from '@pivotos/types';
import { getToken } from '@pivotos/core';
import type { ImportStreamCallbacks } from '@pivotos/components';
import { request } from '../request';

/** 剔除空值查询参数（'' 与 undefined/null 不传给后端） */
function cleanParams(query?: UserQuery): Record<string, unknown> | undefined {
  if (!query) return undefined;
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null));
}

/** 用户分页（接收人选择等场景复用，需 system:user:list 权限） */
export function pageUsers(query: UserQuery): Promise<PageResult<UserVO>> {
  return request.get<unknown, PageResult<UserVO>>('/system/user/page', { params: cleanParams(query) });
}

/** 用户详情 */
export function getUser(id: string): Promise<UserVO> {
  return request.get<unknown, UserVO>(`/system/user/${id}`);
}

/** 新增用户 */
export function createUser(body: UserSaveRequest): Promise<string> {
  return request.post<unknown, string>('/system/user', body);
}

/** 修改用户 */
export function updateUser(body: UserSaveRequest): Promise<void> {
  return request.put<unknown, void>('/system/user', body);
}

/** 删除用户 */
export function deleteUser(id: string): Promise<void> {
  return request.delete<unknown, void>(`/system/user/${id}`);
}

/** 重置用户密码 */
export function resetUserPassword(body: ResetPasswordBody): Promise<void> {
  return request.put<unknown, void>('/system/user/reset-password', body);
}

// ==================== Excel 导入导出（S27 2.1-F8/F9） ====================

/** 导出用户 Excel（POST + 查询条件 + responseType: blob） */
export function exportUsers(query: UserQuery): Promise<Blob> {
  return request.post<unknown, Blob>('/system/user/export', query, { responseType: 'blob' });
}

/** 导入用户 Excel（FormData 上传文件） */
export function importUsers(file: File): Promise<{ successRows: unknown[]; errors: Array<{ rowNum: number; message: string }> }> {
  const fd = new FormData();
  fd.append('file', file);
  return request.post<unknown, { successRows: unknown[]; errors: Array<{ rowNum: number; message: string }> }>('/system/user/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** 下载用户导入模板（GET + responseType: blob） */
export function downloadUserTemplate(): Promise<Blob> {
  return request.get<unknown, Blob>('/system/user/template', { responseType: 'blob' });
}

/** 流式导入用户 Excel：fetch + ReadableStream 解析 SSE，逐行回调 */
export async function importUsersStream(
  file: File,
  callbacks: ImportStreamCallbacks,
  signal: AbortSignal,
): Promise<void> {
  const fd = new FormData();
  fd.append('file', file);

  const response = await fetch('/system/user/import/stream', {
    method: 'POST',
    headers: {
      // Sa-Token token-name=Authorization，未配置 token-prefix，发裸值
      // 与 axios 拦截器保持一致：request/index.ts L59
      Authorization: getToken(),
    },
    body: fd,
    signal,
  });

  if (!response.ok) {
    callbacks.onError(`请求失败 (HTTP ${response.status})`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('浏览器不支持流式读取');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) break;

      if (done) {
        // 队列排空：逐行解析剩余 buffer
        const lines = buffer.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          parseSseLine(trimmed, callbacks);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // 按行解析 SSE（空行 = 事件分隔）
      while (true) {
        const idx = buffer.indexOf('\n\n');
        if (idx === -1) break;
        const eventBlock = buffer.substring(0, idx);
        buffer = buffer.substring(idx + 2);
        parseSseBlock(eventBlock, callbacks);
      }
    }
  } catch (e: unknown) {
    if (signal.aborted) return;
    const err = e instanceof Error ? e : new Error(String(e));
    callbacks.onError(err.message);
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** 解析一个 SSE 事件块（event: + data: 行） */
function parseSseBlock(block: string, callbacks: ImportStreamCallbacks): void {
  let eventName = '';
  let data = '';

  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('event:')) {
      eventName = trimmed.substring(6).trim();
    } else if (trimmed.startsWith('data:')) {
      data = trimmed.substring(5).trim();
    }
  }

  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (eventName === 'row') {
        callbacks.onRow(parsed);
      } else if (eventName === 'done') {
        callbacks.onDone(parsed);
      } else if (eventName === 'error') {
        callbacks.onError(parsed.message || '未知错误');
      }
    } catch {
      // JSON 解析失败，忽略
    }
  }
}

/** 解析最后可能残余的单行 SSE（无事件分隔符的情况） */
function parseSseLine(line: string, callbacks: ImportStreamCallbacks): void {
  if (line.startsWith('data:')) {
    const data = line.substring(5).trim();
    if (data) {
      try {
        const parsed = JSON.parse(data);
        callbacks.onRow(parsed);
      } catch {
        // 忽略
      }
    }
  }
}
