/* ================= AI 对话 ================= */

/** AI 会话视图对象（对齐 ConversationVO） */
export interface AiConversationVO {
  id: string;
  title: string;
  model?: string;
  createTime?: string;
  updateTime?: string;
}

/** RAG 引用来源（对齐 ChatReferenceVO） */
export interface AiChatReferenceVO {
  /** 来源文件名 */
  fileName?: string;
  /** 命中的文本块内容（截取前 200 字） */
  content: string;
  /** 相似度分数 */
  score?: number;
}

/** AI 对话消息视图对象（对齐 ChatMessageVO） */
export interface AiChatMessageVO {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  /** RAG 引用来源（仅 assistant 消息且使用了知识库时有值） */
  references?: AiChatReferenceVO[];
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
  /** RAG：关联的知识库 ID 列表（空 = 不使用知识库） */
  kbIds?: string[];
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
  /** RAG 引用来源（仅使用了知识库时有值） */
  references?: AiChatReferenceVO[];
}

/** 知识库下拉选项（对齐 KbOptionDTO，对话页选择知识库用） */
export interface KbSimpleOptionVO {
  id: string;
  name: string;
}

/* ================= AI 供应商配置 ================= */

/** 供应商视图对象（对齐 ProviderVO，管理页） */
export interface AiProviderVO {
  id: string;
  name: string;
  code: string;
  baseUrl: string;
  defaultModel?: string;
  /** 向量化模型名（空则回退 spring.ai.openai.embedding.options.model 静态配置） */
  embeddingModel?: string;
  /** 重排模型名（如 qwen3-rerank，空则不启用重排，S65） */
  rerankModel?: string;
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
  /** Key 用途（chat=对话, embedding=向量化, all=通用） */
  purpose?: string;
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
  /** 向量化模型名（空则回退 spring.ai.openai.embedding.options.model 静态配置） */
  embeddingModel?: string;
  /** 重排模型名（如 qwen3-rerank，空则不启用重排，S65） */
  rerankModel?: string;
  sort?: number;
  status?: number;
  remark?: string;
}

/** API Key 保存请求（对齐 ApiKeySaveRequest；修改时 apiKey 留空 = 不变更） */
export interface AiApiKeySaveBody {
  id?: string;
  providerId: string;
  label?: string;
  /** Key 用途（chat=对话, embedding=向量化, all=通用；默认 all） */
  purpose?: string;
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
  /** 任务类型：1=单表CRUD 2=Plugin骨架 */
  taskType?: number;
  /** 任务类型特定参数（骨架：pluginName/errorCodeBase/tablePrefix/lintReport 等） */
  extra?: Record<string, unknown>;
  /** 生成的文件列表（文件路径 → 文件内容），列表视图不下发 */
  generatedFiles?: Record<string, string>;
  createBy?: string;
  createTime?: string;
}

/** AI Coding 解析请求体（对齐 CodingRequest） */
export interface CodingParseBody {
  description: string;
}

/* ================= AI 知识库（S58 RAG） ================= */

/** 向量存储类型 */
export type KbVectorStoreType = 'simple' | 'milvus' | 'pgvector' | 'qdrant';

/** 知识库视图对象（对齐 KnowledgeBaseVO） */
export interface KnowledgeBaseVO {
  id: string;
  name: string;
  description?: string;
  vectorStoreType: KbVectorStoreType;
  embeddingModel?: string;
  chunkSize: number;
  chunkOverlap: number;
  hybridSearch?: boolean;
  /** 重排开关（RRF 融合后经 reranker 精排，默认开，S65） */
  rerank?: boolean;
  status: number;
  docCount?: number;
  createTime?: string;
  updateTime?: string;
}

/** 知识库保存请求（对齐 KbBaseSaveRequest；id 为空表示新增） */
export interface KnowledgeBaseSaveBody {
  id?: string;
  name: string;
  description?: string;
  vectorStoreType: KbVectorStoreType;
  embeddingModel?: string;
  chunkSize: number;
  chunkOverlap: number;
  hybridSearch?: boolean;
  /** 重排开关（RRF 融合后经 reranker 精排，默认开，S65） */
  rerank?: boolean;
  status: number;
}

/** 知识库文档视图对象（对齐 KbDocumentVO） */
export interface KbDocumentVO {
  id: string;
  kbId: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  status: number;
  errorMsg?: string;
  vectorCount?: number;
  chunkCount?: number;
  createTime?: string;
  updateTime?: string;
}

/** 知识库文档分页查询（对齐 KbDocPageQuery） */
export interface KbDocPageQuery {
  pageNum?: number;
  pageSize?: number;
  kbId: string;
  fileName?: string;
  status?: number | '';
}

/** 知识库文档上传请求（对齐 KbDocUploadRequest） */
export interface KbDocUploadBody {
  kbId: string;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
}

/** 知识库相似性检索请求（对齐 KbSearchRequest） */
export interface KbSearchBody {
  kbId: string;
  query: string;
  topK?: number;
}

/** 知识库相似性检索结果（对齐 KbSearchResultDTO） */
export interface KbSearchResult {
  /** 命中的文本块内容 */
  content: string;
  /** RRF 融合分数 */
  score?: number;
  /** 来源文件名 */
  fileName?: string;
  /** 向量通道排名（0 表示未命中，检索调试用） */
  vectorRank?: number;
  /** BM25 通道排名（0 表示未命中，检索调试用） */
  bm25Rank?: number;
  /** reranker 重排分数（null 表示未重排，检索调试用，S65） */
  rerankScore?: number;
  /** 元数据：kb_id / doc_id / file_name 等 */
  metadata?: Record<string, unknown>;
}

/** 知识库文本块视图对象（对齐 AiKbChunkVO） */
export interface KbChunkVO {
  id: string;
  /** 块序号（从 0 开始） */
  chunkIndex: number;
  /** 文本块原文 */
  content: string;
  /** 内容MD5（前100字，去重用） */
  contentHash?: string;
}

/* ================= AI 检索评测（S66） ================= */

/** 检索评测问题视图对象（对齐 KbEvalQuestionVO） */
export interface KbEvalQuestionVO {
  id: string;
  kbId: string;
  /** 评测问题 */
  question: string;
  /** 预期命中关键词（命中=topK 任一结果内容包含该词） */
  expectedKeyword: string;
  sort?: number;
  createTime?: string;
}

/** 检索评测问题保存请求（对齐 KbEvalSaveRequest；id 为空新增） */
export interface KbEvalSaveBody {
  id?: string;
  kbId: string;
  question: string;
  expectedKeyword: string;
  sort?: number;
}

/** 检索评测单题跑分请求（对齐 KbEvalRunRequest） */
export interface KbEvalRunBody {
  questionId: string;
  topK?: number;
}

/** 检索评测单题对比结果（对齐 KbEvalCompareVO） */
export interface KbEvalCompareVO {
  questionId: string;
  question: string;
  expectedKeyword: string;
  /** 基线（rerank 关）是否命中 topK */
  baselineHit: boolean;
  /** 基线首次命中排名（0=未命中） */
  baselineRank: number;
  /** 重排（rerank 开）是否命中 topK */
  rerankHit: boolean;
  /** 重排首次命中排名（0=未命中） */
  rerankRank: number;
  /** 两配置 topK 内容序列是否变化（改序/换题） */
  orderChanged: boolean;
}
