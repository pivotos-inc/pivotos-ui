import { getToken } from '@pivotos/core';
import type {
  ApprovalAdviceBody,
  ApprovalAdviceStreamDone,
  ApprovalAdviceStreamMeta,
  ApprovalAdviceVO,
} from '@pivotos/types';
import { request } from '../request';

/** 最近一条审批建议回显（仅本人记录；无记录返回 null） */
export function latestApprovalAdvice(taskId: string): Promise<ApprovalAdviceVO | null> {
  return request.get<unknown, ApprovalAdviceVO | null>(`/ai/approval/advice/${taskId}/latest`);
}

/** SSE 流式审批建议回调（事件序列 meta → delta* → done，异常 error） */
export interface ApprovalAdviceStreamCallbacks {
  onMeta?: (meta: ApprovalAdviceStreamMeta) => void;
  onDelta?: (content: string) => void;
  onDone?: (done: ApprovalAdviceStreamDone) => void;
  onError?: (msg: string) => void;
}

/**
 * 流式生成审批建议：POST /ai/approval/advice/stream，手动解析 SSE。
 * EventSource 不支持 POST + 请求头，故用 fetch + ReadableStream 按空行分帧解析；
 * 事件 data 为 JSON（后端 fastjson2 已做 Long→String 与换行转义）。
 * 返回 Promise 在流正常结束或出错后 resolve（错误统一走 onError，不 reject）。
 * 姿势同 chat.ts streamChat（S101 A3 前端接入）。
 */
export async function streamApprovalAdvice(
  body: ApprovalAdviceBody,
  callbacks: ApprovalAdviceStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/ai/approval/advice/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        // 后端 token-name = Authorization，未配置 token-prefix，发裸值
        Authorization: getToken(),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      callbacks.onError?.('网络异常，请稍后重试');
    }
    return;
  }

  // 流建立前的业务异常（未登录/参数错误/非审批人等）返回 JSON 的 R 错误体
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
        dispatchFrame(frame, callbacks);
      }
    }
    // 流结束后 flush decoder 并处理残留 buffer：done 是最后一帧，
    // 其 \n\n 终止符可能未随最终 chunk 送达（代理缓冲 / 连接关闭时序），
    // 不补处理则 done 事件（含结论与引用）丢失，delta 正常因后续帧推入。
    buffer += decoder.decode();
    if (buffer.trim()) {
      dispatchFrame(buffer.trim(), callbacks);
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      callbacks.onError?.('连接中断，请稍后重试');
    }
  }
}

/** 解析单个 SSE 帧（event: 名称 + data: JSON），分发到对应回调 */
function dispatchFrame(frame: string, callbacks: ApprovalAdviceStreamCallbacks): void {
  let event = 'message';
  let data = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data += line.slice(5).trimStart();
    }
  }
  if (!data) return;
  try {
    const payload = JSON.parse(data) as Record<string, unknown>;
    switch (event) {
      case 'meta':
        callbacks.onMeta?.(payload as unknown as ApprovalAdviceStreamMeta);
        break;
      case 'delta':
        callbacks.onDelta?.((payload.content as string) ?? '');
        break;
      case 'done':
        callbacks.onDone?.(payload as unknown as ApprovalAdviceStreamDone);
        break;
      case 'error':
        callbacks.onError?.((payload.msg as string) || 'AI 建议生成失败');
        break;
      default:
        break;
    }
  } catch {
    /* 忽略无法解析的帧（如注释/心跳） */
  }
}
