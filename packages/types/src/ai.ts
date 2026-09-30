import type { Emptyable, PageQuery } from './common';

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
  /** 来源知识库 ID（S68） */
  kbId?: string;
  /** 来源知识库名称（S68） */
  kbName?: string;
  /** 来源文档 ID（S68 溯源下钻用） */
  docId?: string;
  /** 命中分块 ID（S68 溯源下钻用，空表示未反查到） */
  chunkId?: string;
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
  /** 查询改写后的实际检索词（仅知识库开启智能改写且生效时下发，S68） */
  rewrittenQuery?: string;
  /** 意图路由出局：本轮判定无需知识库检索，按通用知识回答（S69） */
  kbRoutedOut?: boolean;
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
  /** 查询改写开关（S68） */
  queryRewrite?: boolean;
  /** 知识库类型（policy 制度类 / general 通用；A4E / S117） */
  kbType?: string;
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

/** 定位候选（A4-1 / S110 粗筛阶段产物） */
export interface CodingLocateCandidateVO {
  /** 仓库根相对路径 */
  path?: string;
  /** 所属模块 */
  module?: string;
  /** 分层标签（分层约定感知） */
  layer?: string;
  /** 主类型名 */
  typeName?: string;
  /** 候选来源：llm（粗筛）/ keyword（确定性召回） */
  source?: string;
  /** 置信度 0~1 */
  confidence?: number;
  /** 入选理由 */
  reason?: string;
}

/** 精定位结果（单候选，含确定性仲裁分项） */
export interface CodingLocatePreciseVO {
  /** 仓库根相对路径 */
  path?: string;
  layer?: string;
  /** 目标方法/区块名 */
  method?: string;
  /** 建议改动起始行（1 基） */
  startLine?: number;
  /** 建议改动结束行（1 基） */
  endLine?: number;
  /** LLM 判定该候选是否确为改动落点 */
  applicable?: boolean;
  /** LLM 精定位自评置信度 0~1 */
  confidence?: number;
  reason?: string;
  /** 确定性信号：符号表/路径关键词命中率 0~1 */
  symbolHit?: number;
  /** 确定性信号：分层因子归一值 0~1 */
  layerFactor?: number;
  /** 仲裁综合分（越大越优；0.5×自评 + 0.3×符号命中 + 0.2×分层因子） */
  score?: number;
}

/** 两段定位结果（A4-1 / S110） */
export interface CodingLocateVO {
  /** 目标仓库逻辑名：fw / ui */
  repo?: string;
  intent?: string;
  model?: string;
  /** 意图解析结果：domain / change_type / keywords */
  parse?: Record<string, unknown>;
  candidates?: CodingLocateCandidateVO[];
  precise?: CodingLocatePreciseVO[];
  /** 仲裁选中的落点 */
  chosen?: CodingLocatePreciseVO;
  /** 是否降级选中（全部候选被判不适用时退回最高置信度者） */
  fallback?: boolean;
  /** 索引文件数 */
  indexSize?: number;
  costMs?: number;
}

/** 结构化 edit 块（A4-2 / S111） */
export interface CodingEditBlockVO {
  /** 待替换原文片段（逐字，含缩进） */
  search?: string;
  /** 替换后的内容（空串表示删除） */
  replace?: string;
  /** 第几次命中（1-based）；<=0 表示要求唯一命中 */
  occurrence?: number;
  /** true 表示追加到文件末尾（不校验 search） */
  append?: boolean;
  /** LLM 给出的改动理由（评审辅助材料，不作裁决） */
  reason?: string;
}

/** 结构化 edit 指令（diff 由后端确定性渲染，此处不含 diff 文本） */
export interface CodingEditVO {
  path?: string;
  blocks?: CodingEditBlockVO[];
}

/** 自动门禁结果（Prepare 阶段为可应用性校验；编译/typecheck 在应用时执行） */
export interface CodingGateVO {
  /** git apply --check 是否通过 */
  applyCheck?: boolean;
  /** 是否靠 --recount 兜底才通过 */
  recountUsed?: boolean;
  /** 失败原因 / 原始报错 */
  message?: string;
}

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
  /** 任务类型：1=单表CRUD 2=Plugin骨架 3=主子表 4=树表 5=修改型（A4） */
  taskType?: number;
  /** 确定性渲染的 unified diff（修改型，A4-2） */
  diff?: string;
  /** 定位结论快照（A4-1） */
  locate?: CodingLocateVO;
  /** 结构化 edit 指令（A4-2） */
  edit?: CodingEditVO;
  /** 门禁结果（A4-2：apply-check；编译/typecheck 在应用时执行） */
  gate?: CodingGateVO;
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
  /** 知识库类型（policy 制度类 / general 通用；A4E / S117 制度类标记） */
  kbType?: string;
  description?: string;
  vectorStoreType: KbVectorStoreType;
  embeddingModel?: string;
  chunkSize: number;
  chunkOverlap: number;
  hybridSearch?: boolean;
  /** 重排开关（RRF 融合后经 reranker 精排，默认开，S65） */
  rerank?: boolean;
  /** 查询改写开关（检索前 LLM 改写多轮问题，默认关，S68） */
  queryRewrite?: boolean;
  status: number;
  docCount?: number;
  createTime?: string;
  updateTime?: string;
}

/** 知识库保存请求（对齐 KbBaseSaveRequest；id 为空表示新增） */
export interface KnowledgeBaseSaveBody {
  id?: string;
  name: string;
  /** 知识库类型（policy 制度类 / general 通用；A4E / S117） */
  kbType?: string;
  description?: string;
  vectorStoreType: KbVectorStoreType;
  embeddingModel?: string;
  chunkSize: number;
  chunkOverlap: number;
  hybridSearch?: boolean;
  /** 重排开关（RRF 融合后经 reranker 精排，默认开，S65） */
  rerank?: boolean;
  /** 查询改写开关（检索前 LLM 改写多轮问题，默认关，S68） */
  queryRewrite?: boolean;
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

/* ================= AI 检索评测跑分记录（S67） ================= */

/** 检索评测跑分记录视图对象（对齐 KbEvalRecordVO，聚合指标后端计算） */
export interface KbEvalRecordVO {
  id: string;
  kbId: string;
  /** 本轮跑分题数 */
  questionCount: number;
  /** 基线命中题数 */
  baselineHit: number;
  /** 重排命中题数 */
  rerankHit: number;
  /** 基线 Hit@K（0-1） */
  baselineHitRate: number;
  /** 重排 Hit@K（0-1） */
  rerankHitRate: number;
  /** 基线 MRR */
  baselineMrr: number;
  /** 重排 MRR */
  rerankMrr: number;
  /** 改序题数 */
  orderChangedCount: number;
  /** 跑分时间 */
  createTime?: string;
}

/** 检索评测跑分逐题明细视图对象（对齐 KbEvalRecordItemVO，快照） */
export interface KbEvalRecordItemVO {
  id: string;
  recordId: string;
  /** 原评测问题ID（问题可能已被删除） */
  questionId?: string;
  /** 评测问题快照 */
  question: string;
  /** 预期命中关键词快照 */
  expectedKeyword: string;
  /** 基线首次命中排名（0=未命中） */
  baselineRank: number;
  /** 重排首次命中排名（0=未命中） */
  rerankRank: number;
  /** 是否改序 */
  orderChanged: boolean;
}

/** 检索评测跑分记录保存请求（对齐 KbEvalRecordSaveRequest） */
export interface KbEvalRecordSaveBody {
  kbId: string;
  items: {
    questionId?: string;
    question: string;
    expectedKeyword: string;
    baselineRank: number;
    rerankRank: number;
    orderChanged: boolean;
  }[];
}

/* ================= AI 用量监控（S92） ================= */

/** 用量场景分布项（对齐 AiUsageSummaryVO.SceneItem；Long 序列化为字符串） */
export interface AiUsageSceneItem {
  /** 场景（chat/rag/coding/chart/other） */
  scene: string;
  /** 调用次数 */
  calls: number | string;
  /** token 合计 */
  totalTokens: number | string;
}

/** 用量日趋势项（对齐 AiUsageSummaryVO.TrendItem，缺日补 0） */
export interface AiUsageTrendItem {
  /** 日期 yyyy-MM-dd */
  day: string;
  /** 调用次数 */
  calls: number | string;
  /** token 合计 */
  totalTokens: number | string;
}

/** 用量汇总（对齐 AiUsageSummaryVO：总量卡片 + 场景分布 + 日趋势） */
export interface AiUsageSummaryVO {
  /** 调用总次数 */
  calls: number | string;
  /** 失败调用次数 */
  failedCalls: number | string;
  /** 提示词 token 合计 */
  promptTokens: number | string;
  /** 生成 token 合计 */
  completionTokens: number | string;
  /** 总 token 合计 */
  totalTokens: number | string;
  /** 按场景分布 */
  byScene: AiUsageSceneItem[];
  /** 按日趋势（缺日补 0） */
  trend: AiUsageTrendItem[];
}

/** 用量按供应商 × Key 聚合（对齐 AiUsageProviderVO） */
export interface AiUsageProviderVO {
  /** 供应商编码（静态兜底为 static） */
  providerCode: string;
  /** Key ID（静态兜底为空） */
  keyId?: string;
  /** Key 备注名（后端回填） */
  keyLabel?: string;
  /** 调用次数 */
  calls: number | string;
  /** 提示词 token 合计 */
  promptTokens: number | string;
  /** 生成 token 合计 */
  completionTokens: number | string;
  /** 总 token 合计 */
  totalTokens: number | string;
}

/** 用量按用户聚合（对齐 AiUsageUserVO） */
export interface AiUsageUserVO {
  /** 用户 ID（未登录链路为空） */
  userId?: string;
  /** 用户名（后端回填） */
  username?: string;
  /** 昵称（后端回填） */
  nickname?: string;
  /** 调用次数 */
  calls: number | string;
  /** 总 token 合计 */
  totalTokens: number | string;
}

/* ================= AI 审批助手（S101 A3） ================= */

/** 审批建议制度引用（对齐 ApprovalReferenceVO） */
export interface ApprovalReferenceVO {
  /** 命中分块 ID */
  chunkId?: string;
  /** 来源文件名 */
  fileName?: string;
  /** 依据摘录（≤200 字） */
  quote?: string;
}

/** 审批建议视图对象（对齐 ApprovalAdviceVO，GET /ai/approval/advice/{taskId}/latest） */
export interface ApprovalAdviceVO {
  id: string;
  taskId: string;
  /** 结论三态：approve 建议通过 / reject 建议驳回 / need_info 需补充材料 */
  conclusion?: string;
  /** 结论理由 */
  reason?: string;
  /** 制度依据引用（无依据为空） */
  references?: ApprovalReferenceVO[];
  /** 检索所用知识库 ID（无制度依据为空） */
  kbId?: string;
  createTime?: string;
  /** 是否受控自动通过（A4E / S117） */
  autoPassed?: boolean;
  /** 自动预审判定原因（未启用 / 未命中规则 / 命中明细） */
  autoDecisionReason?: string;
  /** 是否具备受控自动通过资格（不等于已通过；供前端决定是否发起自动预审） */
  autoEligible?: boolean;
}

/** 受控自动预审结果（A4E / S117，对齐 AutoApprovalResultVO） */
export interface AutoApprovalResultVO {
  taskId: string;
  /** 是否已自动通过 */
  autoPassed: boolean;
  /** 判定原因（未通过时说明哪条规则不满足） */
  reason?: string;
  /** 规则命中明细 */
  ruleHits?: string[];
  /** 依据的建议记录 ID */
  adviceId?: string;
}

/** 审批建议生成请求（对齐 ApprovalAdviceRequest；kbId 空 = 后端默认库策略） */
export interface ApprovalAdviceBody {
  taskId: string;
  kbId?: string;
}

/** 审批建议 SSE meta 事件载荷（流开始时下发） */
export interface ApprovalAdviceStreamMeta {
  taskId?: string;
  instanceId?: string;
  kbId?: string;
  /** 免责声明：AI 建议仅供参考，审批责任仍归审批人 */
  disclaimer?: string;
}

/** 审批建议 SSE done 事件载荷（建议落库完成，结构化结论在此帧） */
export interface ApprovalAdviceStreamDone {
  adviceId?: string;
  conclusion?: string;
  reason?: string;
  references?: ApprovalReferenceVO[];
  /** 免责声明：AI 建议仅供参考，审批责任仍归审批人 */
  disclaimer?: string;
  /** 是否具备受控自动通过资格（A4E / S117；够格才发起自动预审，不等于已通过） */
  autoEligible?: boolean;
}

/* ================= AI 工具管理（S98 A2 注册 / S99 管理页） ================= */

/** AI 工具注册视图（对齐 AiToolVO） */
export interface AiToolVO {
  id: string;
  /** 工具名（@Tool name，全局唯一） */
  toolName: string;
  /** 展示名（缺省同工具名） */
  displayName?: string;
  /** 工具描述（同步自 @Tool description） */
  description?: string;
  /** 工具类型：read=只读 write=写操作 */
  toolType: string;
  /** 写操作是否需二次确认（0否 1是） */
  confirmRequired?: number;
  /** 状态（0正常 1停用） */
  status?: number;
  /** 来源（register=@Tool 扫描自动注册） */
  source?: string;
  /** 注册时间 */
  createTime?: string;
  /** 角色白名单编码（空 = 登录用户皆可调用，* 为通配） */
  roles?: string[];
}

/** AI 工具调用审计视图（对齐 AiToolInvokeVO） */
export interface AiToolInvokeVO {
  id: string;
  /** 工具名 */
  toolName: string;
  /** 调用人 ID（未登录链路为空） */
  userId?: string;
  /** 入参摘要 */
  argsSummary?: string;
  /** 调用状态：success/fail/forbidden/need_confirm */
  invokeStatus: string;
  /** 失败/拒绝原因 */
  errorMsg?: string;
  /** 执行耗时（毫秒） */
  costMs?: number | string;
  /** 链路追踪 ID */
  traceId?: string;
  /** 调用时间 */
  createTime?: string;
}

/** AI 工具分页查询（对齐 AiToolQuery） */
export interface AiToolQuery extends PageQuery {
  /** 工具名（模糊） */
  toolName?: string;
  /** 工具类型（read/write） */
  toolType?: Emptyable<string>;
  /** 状态（0正常 1停用） */
  status?: Emptyable<number>;
}

/** AI 工具调用审计分页查询（对齐 AiToolInvokeQuery） */
export interface AiToolInvokeQuery extends PageQuery {
  /** 工具名（模糊） */
  toolName?: string;
  /** 调用状态（success/fail/forbidden/need_confirm） */
  invokeStatus?: Emptyable<string>;
  /** 调用人 ID */
  userId?: string;
}

// ============================================================
// A5-1 工具多步编排（S116）
// ============================================================

/** 编排计划单步（对齐 AiToolPlanVO.PlanStepVO） */
export interface AiToolPlanStepVO {
  /** 步骤序号（从 1 起） */
  no: number;
  /** 工具名 */
  tool: string;
  /** 入参 JSON 原文（含引用占位符） */
  args?: string;
  /** 规划理由 */
  reason?: string;
  /** 是否写操作（写操作需二次确认） */
  write?: boolean;
  /** 执行输出（未执行为空） */
  output?: string;
  /** 实际尝试次数（A5-2；未执行为 0，写步骤恒 ≤ 1） */
  attemptCount?: number;
  /** 步骤终态：success / failed / need_confirm / skipped（skipped = 熔断后未发起调用） */
  stepStatus?: string;
  /** 本步耗时（毫秒，含重试） */
  stepCostMs?: number | string;
  /** 失败原因（终态失败信号原文） */
  error?: string;
}

/** 编排计划视图（对齐 AiToolPlanVO） */
export interface AiToolPlanVO {
  id: string;
  /** 用户原始意图 */
  intent?: string;
  /** 计划目标 */
  goal?: string;
  /** 步骤数 */
  stepCount?: number;
  /** 状态：draft 待确认 / success 已完成 / need_confirm 等待写操作确认 / failed 中断 */
  status?: string;
  /** 已成功执行步骤数 */
  executedSteps?: number;
  /** 被写操作确认闸拦下的步骤序号（0 未拦停） */
  blockedStep?: number;
  /** 结果摘要 / 失败原因 */
  resultSummary?: string;
  /** 总耗时（毫秒） */
  costMs?: number | string;
  /** 本次执行累计重试次数（A5-2；写步骤恒为 0） */
  retryCount?: number;
  /** 是否触发熔断（A5-2：重试预算耗尽，后续步骤未再发起调用） */
  circuitBroken?: boolean;
  /** 失败原因（终态失败信号原文） */
  failReason?: string;
  /** 能力缺口说明（计划为空时） */
  unmapped?: string;
  /** 计划校验结论（非空 = 不允许执行） */
  errors?: string[];
  steps?: AiToolPlanStepVO[];
  createTime?: string;
}

/** 编排记录分页查询（对齐 AiToolPlanQuery） */
export interface AiToolPlanQuery extends PageQuery {
  intent?: string;
  status?: Emptyable<string>;
}

/** 编排执行入参（对齐 AiOrchestratorRunRequest） */
export interface AiOrchestratorRunRequest {
  intent: string;
  /** 是否已获得用户对写操作的二次确认（false 时停在写步骤前） */
  confirmed?: boolean;
}
