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
