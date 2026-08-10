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
  /** 供应商 id（空 = 默认供应商 → 静态配置兜底） */
  providerId?: string;
  /** 模型名（空 = 供应商默认模型） */
  model?: string;
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

/* ================= AI 供应商配置 ================= */

/** 供应商视图对象（对齐 ProviderVO，管理页） */
export interface AiProviderVO {
  id: string;
  name: string;
  code: string;
  baseUrl: string;
  defaultModel?: string;
  sort?: number;
  status?: number;
  remark?: string;
  /** 租户ID（'0'=平台/默认租户，区分平台配置与租户自有配置） */
  tenantId?: string;
  /** 启用中的 Key 数 */
  activeKeyCount?: string | number;
  createTime?: string;
  updateTime?: string;
}

/** 供应商下拉选项（对齐 ProviderOptionVO，对话页） */
export interface AiProviderOptionVO {
  id: string;
  name: string;
  defaultModel?: string;
}

/** API Key 视图对象（对齐 ApiKeyVO，keyMasked 只回尾 4 位） */
export interface AiApiKeyVO {
  id: string;
  providerId: string;
  label?: string;
  keyMasked: string;
  status?: number;
  /** 连续失败次数（健康度：成功清零，达阈值自动停用） */
  failCount?: number;
  createTime?: string;
  updateTime?: string;
}

/** 供应商保存请求（对齐 ProviderSaveRequest；id 为空新增） */
export interface AiProviderSaveBody {
  id?: string;
  name: string;
  code: string;
  baseUrl: string;
  defaultModel?: string;
  sort?: number;
  status?: number;
  remark?: string;
}

/** API Key 保存请求（对齐 ApiKeySaveRequest；修改时 apiKey 留空 = 不变更） */
export interface AiApiKeySaveBody {
  id?: string;
  providerId: string;
  label?: string;
  apiKey?: string;
  status?: number;
}

/* ================= AI Coding ================= */

/** AI Coding 会话视图对象（对齐 CodingSessionVO） */
export interface CodingSessionVO {
  id: string;
  /** 用户自然语言描述 */
  description?: string;
  /** 解析结果：模块名 */
  moduleName?: string;
  /** 解析结果：表名 */
  tableName?: string;
  /** 解析结果：功能名称 */
  functionName?: string;
  /** 解析结果：业务名 */
  businessName?: string;
  /** 状态：0=解析中 1=待评审 2=已应用 3=失败 */
  status?: number;
  /** 生成的文件列表（文件路径 → 文件内容），列表视图不下发 */
  generatedFiles?: Record<string, string>;
  createBy?: string;
  createTime?: string;
}

/** AI Coding 解析请求体（对齐 CodingRequest） */
export interface CodingParseBody {
  description: string;
}
