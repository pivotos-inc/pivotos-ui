/**
 * 监控运维类型（S48 2.3-F6/F7：对齐 monitor 插件 ServerInfoVO / CacheInfoVO）
 * S71：运营工作台/数据大屏聚合类型（对齐 DashboardSummaryVO）
 * 注：后端 Long 统一序列化为字符串，计数类字段类型为 string | number
 */

/** 趋势点（近 N 日按日聚合） */
export interface DashboardTrendPoint {
  /** yyyy-MM-dd */
  date: string;
  value: string | number;
}

/** 系统基础盘统计（对齐 SystemStatsDTO） */
export interface SystemStatsDTO {
  userCount: string | number;
  roleCount: string | number;
  deptCount: string | number;
  postCount: string | number;
  todayLogins: string | number;
}

/** 工作流实例统计（对齐 WorkflowStatsDTO） */
export interface WorkflowStatsDTO {
  totalInstances: string | number;
  pendingTasks: string | number;
  /** flow_status 状态码 → 实例数 */
  statusCounts: Record<string, string | number>;
}

/** 文件存储统计（对齐 FileStatsDTO） */
export interface FileStatsDTO {
  fileCount: string | number;
  totalBytes: string | number;
}

/** AI 运营统计（对齐 AiChatStatsDTO） */
export interface AiChatStatsDTO {
  conversationCount: string | number;
  messageCount: string | number;
  providerCount: string | number;
  activeKeyCount: string | number;
  unhealthyKeyCount: string | number;
  messageTrend: DashboardTrendPoint[];
}

/** 知识库统计（对齐 KbStatsDTO） */
export interface KbStatsDTO {
  baseCount: string | number;
  documentCount: string | number;
  chunkCount: string | number;
  evalRecordCount: string | number;
}

/** 运营看板聚合（工作台与数据大屏共用，区块降级时为 null） */
export interface DashboardSummaryVO {
  onlineUsers: string | number;
  system: SystemStatsDTO | null;
  loginTrend: DashboardTrendPoint[] | null;
  workflow: WorkflowStatsDTO | null;
  file: FileStatsDTO | null;
  ai: AiChatStatsDTO | null;
  kb: KbStatsDTO | null;
}

/** AI 生成图表规格（S72，对齐 AiChartSpecVO）：前端按 chartType 确定性装配 ECharts option */
export interface AiChartSpecVO {
  title: string | null;
  /** line / bar / pie（后端白名单校验） */
  chartType: 'line' | 'bar' | 'pie';
  /** 类目轴（line/bar 必有，pie 可能为占位类目） */
  categories: string[] | null;
  series: AiChartSeries[];
  /** 一句话说明 */
  explanation: string | null;
}

/** AI 图表数据系列 */
export interface AiChartSeries {
  name: string;
  data: number[];
}

/** AI 图表保存命令（S83，对齐 AiChartSaveCmd） */
export interface AiChartSaveCmd {
  /** 生成时的自然语言描述（可选） */
  question?: string;
  /** 图表规格（与生成端点同结构） */
  spec: AiChartSpecVO;
}

/** AI 图表历史（S83，对齐 AiChartHistoryVO）：回放时解析 specJson 确定性装配 */
export interface AiChartHistoryVO {
  id: string;
  question: string | null;
  title: string | null;
  chartType: 'line' | 'bar' | 'pie';
  /** ChartSpec JSON 全量快照 */
  specJson: string;
  createTime: string;
}


/** 服务监控快照 */
export interface ServerInfoVO {
  cpu: {
    /** 物理核数 */
    physicalNum: number;
    /** 逻辑核数 */
    cpuNum: number;
    /** 用户态使用率 % */
    used: number;
    /** 系统态使用率 % */
    sys: number;
    /** 空闲率 % */
    idle: number;
    /** IO 等待率 % */
    wait: number;
  };
  mem: {
    total: number;
    used: number;
    free: number;
    /** 使用率 % */
    usage: number;
  };
  jvm: {
    name: string;
    version: string;
    vendor: string;
    home: string;
    startTime: string;
    uptimeMillis: number;
    inputArgs: string;
    heapInit: number;
    heapUsed: number;
    heapCommitted: number;
    heapMax: number;
    nonHeapUsed: number;
    /** 平台线程数（JMX 不含虚拟线程） */
    threadCount: number;
    peakThreadCount: number;
    daemonThreadCount: number;
  };
  /** 虚拟线程调度器指标（JDK 21+，不支持时 supported=false） */
  virtualThreads: {
    supported: boolean;
    parallelism: number;
    poolSize: number;
    mounted: number;
    queued: number;
  };
  sys: {
    hostName: string;
    ip: string;
    osName: string;
    osVersion: string;
    osArch: string;
  };
  sysFiles: Array<{
    dirName: string;
    sysTypeName: string;
    typeName: string;
    total: number;
    used: number;
    free: number;
    usage: number;
  }>;
}

/** ES 节点明细（对齐 SearchHealthSnapshot.NodeInfo） */
export interface EsNodeInfo {
  name: string | null;
  ip: string | null;
  version: string | null;
  /** ES 7.x 为短码（di/mdi），8.x/9.x 为长码（cdfhilmrstw）——原样展示不解析 */
  roles: string | null;
  master: boolean;
  heapPercent: number;
  ramPercent: number;
  cpu: number;
  load1m: number;
}

/** ES 索引明细（对齐 SearchHealthSnapshot.IndexInfo） */
export interface EsIndexInfo {
  index: string;
  health: string | null;
  status: string | null;
  docsCount: string | number;
  storeSizeBytes: string | number;
  storeSizeHuman: string | null;
  pri: number;
  rep: number;
}

/**
 * ES 监控快照（对齐 SearchHealthSnapshot / monitor 侧 EsInfoVO）。
 * 降级口径：simple / 未启用 / 连接不可达时 available=false + reason 文案，接口仍返回 code=0。
 */
export interface EsInfoVO {
  available: boolean;
  /** 当前生效实现：simple / es-java / easy-es */
  implementation: string | null;
  /** 配置值 pivotos.search.type */
  configuredType: string | null;
  /** 发生过回落（配置的实现未生效，实际走 simple） */
  fallback: boolean;
  reasonCode: string | null;
  reason: string | null;
  serverVersion: string | null;
  clusterName: string | null;
  /** green / yellow / red */
  status: string | null;
  nodeCount: number;
  indexCount: number;
  docCount: string | number;
  storeSizeBytes: string | number;
  storeSizeHuman: string | null;
  jvmHeapUsedBytes: string | number;
  jvmHeapMaxBytes: string | number;
  jvmHeapUsedPercent: number;
  shardsActive: number;
  shardsActivePrimary: number;
  shardsRelocating: number;
  shardsInitializing: number;
  shardsUnassigned: number;
  nodes: EsNodeInfo[];
  indices: EsIndexInfo[];
  collectedAt: string | null;
}

/* ==================== S130 通用数据监控（DB / ES / Redis） ==================== */

/** 数据监控组件类型（后端 DataSourceType） */
export type DataComponentType =
  | 'mysql'
  | 'es'
  | 'redis'
  | 'neo4j'
  | 'clickhouse'
  | 'mongodb'
  | 'kafka'
  | 'mq';

/** 组件能力集（后端 Capability） */
export type DataCapability = 'LIST_SCHEMAS' | 'LIST_TABLES' | 'PREVIEW' | 'QUERY' | 'STATS';

/** 组件快照：不可用时 available=false + reason 有值（后端绝不抛异常、绝不 500） */
export interface DataComponentSnapshot {
  type: DataComponentType;
  name: string;
  available: boolean;
  reasonCode: string | null;
  reason: string | null;
  detail: string | null;
  /** 后端回传 Set<Capability>，序列化为字符串数组 */
  capabilities: DataCapability[] | null;
}

/** 库 / 索引分组 / Redis db */
export interface DataSchemaItem {
  name: string;
  label: string;
  itemCount: string | number;
}

/** 表 / 索引 / Redis key */
export interface DataTableItem {
  schema: string;
  name: string;
  /** table / view / index / string / hash / list / set / zset */
  type: string;
  comment: string;
  rowCount: string | number;
  ttl: string | number;
}

/** 结果列 */
export interface DataColumnItem {
  name: string;
  type: string | null;
  /** 命中敏感列名规则，取值已脱敏 */
  masked: boolean;
}

/**
 * 统一查询结果。
 * 降级口径：available=false 时 rows 为空、reason 有值，接口仍返回 code=0。
 */
export interface DataQueryResult {
  columns: DataColumnItem[];
  rows: Array<Record<string, unknown>>;
  /** 总条数；-1 表示未知 */
  total: string | number;
  truncated: boolean;
  durationMs: string | number;
  /** 透明化提示：已注入 LIMIT / 已按租户改写 / 已脱敏 N 个单元格 */
  warnings: string[];
  available: boolean;
  reasonCode: string | null;
  reason: string | null;
}

/** 预览请求：内部固定语句，不接受用户语句 */
export interface DataPreviewRequest {
  component: string;
  schema: string;
  table: string;
  pageNum?: number;
  pageSize?: number;
}

/** 自由查询请求（高危，需 monitor:data:query） */
export interface DataQueryRequest {
  component: string;
  schema?: string;
  /** 自由语句（MySQL 为 SQL；ES 为 DSL；Redis 不支持） */
  statement: string;
  maxRows?: number;
}

/** 表 / 索引 / key 统计 */
export interface DataStatsItem {
  schema: string;
  table: string;
  rowCount: string | number;
  sizeBytes: string | number;
  engine: string | null;
  extra: Record<string, unknown> | null;
}

/** 缓存监控快照 */
export interface CacheInfoVO {
  redisVersion: string;
  redisMode: string;
  os: string;
  archBits: string;
  processId: string;
  tcpPort: string;
  uptimeInSeconds: number;
  connectedClients: number;
  blockedClients: number;
  usedMemoryHuman: string;
  usedMemoryPeakHuman: string;
  maxmemoryHuman: string;
  memFragmentationRatio: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  /** 命中率 % */
  hitRate: number;
  dbSize: number;
  keyspace: Array<{
    db: string;
    keys: number;
    expires: number;
    avgTtl: number;
  }>;
  commandStats: Array<{
    name: string;
    calls: number;
    usecPerCall: number;
  }>;
}
