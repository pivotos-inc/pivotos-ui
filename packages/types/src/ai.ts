/* ================= AI 对话 ================= */

/** AI 会话视图对象（对齐 ConversationVO） */
export interface AiConversationVO {
  id: string;
  title: string;
  model?: string;
  createTime?: string;
  updateTime?: string;
}

/** AI 对话消息视图对象（对齐 ChatMessageVO） */
export interface AiChatMessageVO {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createTime?: string;
}

/** 对话请求体（对齐 ChatSendRequest；conversationId 为空 = 新建会话） */
export interface AiChatSendBody {
  conversationId?: string;
  content: string;
}

/** SSE meta 事件载荷（流开始时下发会话与用户消息定位信息） */
export interface AiChatStreamMeta {
  conversationId: string;
  userMessageId: string;
  title: string;
}

/** SSE done 事件载荷（助手消息落库完成） */
export interface AiChatStreamDone {
  conversationId: string;
  messageId: string;
}
