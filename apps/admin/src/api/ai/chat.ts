import { getToken } from '@pivotos/core';
import type {
  AiChatMessageVO,
  AiChatSendBody,
  AiChatStreamDone,
  AiChatStreamMeta,
  AiConversationVO,
  KbSimpleOptionVO,
} from '@pivotos/types';
import { request } from '../request';

/** 同步对话（一次性返回完整回复） */
export function sendChat(body: AiChatSendBody): Promise<AiChatMessageVO> {
  return request.post<unknown, AiChatMessageVO>('/ai/chat/send', body);
}

/** 我的会话列表（按更新时间倒序） */
export function listConversations(): Promise<AiConversationVO[]> {
  return request.get<unknown, AiConversationVO[]>('/ai/conversation/list');
}

/** 会话内消息（按时间正序） */
export function listMessages(conversationId: string): Promise<AiChatMessageVO[]> {
  return request.get<unknown, AiChatMessageVO[]>(`/ai/conversation/${conversationId}/messages`);
}

/** 删除会话（级联删除消息） */
export function deleteConversation(conversationId: string): Promise<void> {
  return request.delete<unknown, void>(`/ai/conversation/${conversationId}`);
}

/** 重命名会话（PUT body {title}，后端校验非空且 ≤128） */
export function renameConversation(conversationId: string, title: string): Promise<void> {
  return request.put<unknown, void>(`/ai/conversation/${conversationId}`, { title });
}

/** 知识库下拉选项（对话页 RAG 选择用；kb 插件未部署时返回空数组） */
export function listKbOptions(): Promise<KbSimpleOptionVO[]> {
  return request.get<unknown, KbSimpleOptionVO[]>('/ai/chat/kb-options');
}

/** SSE 流式对话回调（事件序列 meta → delta* → done，异常 error） */
export interface ChatStreamCallbacks {
  onMeta?: (meta: AiChatStreamMeta) => void;
  onDelta?: (content: string) => void;
  onDone?: (done: AiChatStreamDone) => void;
  onError?: (msg: string) => void;
}

/**
 * 流式对话：POST /ai/chat/stream，手动解析 SSE。
 * EventSource 不支持 POST + 请求头，故用 fetch + ReadableStream 按空行分帧解析；
 * 事件 data 为 JSON（后端 fastjson2 已做 Long→String 与换行转义）。
 * 返回 Promise 在流正常结束或出错后 resolve（错误统一走 onError，不 reject）。
 */
export async function streamChat(
  body: AiChatSendBody,
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/ai/chat/stream', {
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

  // 流建立前的业务异常（未登录/参数错误等）返回 JSON 的 R 错误体
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
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      callbacks.onError?.('连接中断，请稍后重试');
    }
  }
}

/** 解析单个 SSE 帧（event: 名称 + data: JSON），分发到对应回调 */
function dispatchFrame(frame: string, callbacks: ChatStreamCallbacks): void {
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
    const payload = JSON.parse(data) as Record<string, string>;
    switch (event) {
      case 'meta':
        callbacks.onMeta?.(payload as unknown as AiChatStreamMeta);
        break;
      case 'delta':
        callbacks.onDelta?.(payload.content ?? '');
        break;
      case 'done':
        callbacks.onDone?.(payload as unknown as AiChatStreamDone);
        break;
      case 'error':
        callbacks.onError?.(payload.msg || 'AI 服务调用失败');
        break;
      default:
        break;
    }
  } catch {
    /* 忽略无法解析的帧（如注释/心跳） */
  }
}
