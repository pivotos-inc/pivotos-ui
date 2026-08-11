/**
 * 监控运维类型（S48 2.3-F6/F7：对齐 monitor 插件 ServerInfoVO / CacheInfoVO）
 */

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
