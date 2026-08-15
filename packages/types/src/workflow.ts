import type { Emptyable, PageQuery } from './common';

/* ================= 流程定义 ================= */

/** 流程定义视图对象（对齐 FlowDefinitionVO） */
export interface FlowDefinitionVO {
  id: string;
  flowCode: string;
  flowName: string;
  /** 设计器模型（CLASSICS / MIMIC） */
  modelValue?: string;
  category?: string;
  version?: string;
  /** 0未发布 1已发布 9失效 */
  isPublish: number;
  /** 0挂起 1激活 */
  activityStatus: number;
  createTime?: string;
  updateTime?: string;
}

/** 流程定义分页查询（对齐 FlowDefinitionQuery） */
export interface FlowDefinitionQuery extends PageQuery {
  flowName?: string;
  flowCode?: string;
  category?: string;
  isPublish?: Emptyable<number>;
}

/* ================= 流程实例 ================= */

/** 流程实例视图对象（对齐 WorkflowInstanceVO） */
export interface WorkflowInstanceVO {
  id: string;
  definitionId: string;
  flowName: string;
  businessId?: string;
  nodeCode?: string;
  nodeName?: string;
  flowStatus?: string;
  activityStatus?: number;
  createTime?: string;
  updateTime?: string;
}

/** 实例分页查询 */
export interface WorkflowInstanceQuery extends PageQuery {
  flowName?: string;
}

/* ================= 审批任务 ================= */

/** 待办任务视图对象（对齐 WorkflowTaskVO） */
export interface WorkflowTaskVO {
  id: string;
  definitionId: string;
  instanceId: string;
  flowName: string;
  businessId?: string;
  businessName?: string;
  nodeCode?: string;
  nodeName?: string;
  nodeType?: number;
  flowStatus?: string;
  createTime?: string;
  updateTime?: string;
}

/** 任务分页查询 */
export interface WorkflowTaskQuery extends PageQuery {
  flowName?: string;
}

/** 审批历史视图对象（对齐 WorkflowHisTaskVO） */
export interface WorkflowHisTaskVO {
  id: string;
  instanceId: string;
  taskId: string;
  nodeCode?: string;
  nodeName?: string;
  targetNodeCode?: string;
  targetNodeName?: string;
  approver?: string;
  skipType?: string;
  flowStatus?: string;
  message?: string;
  createTime?: string;
}

/** 审批操作命令（通过/驳回/转办/委派通用） */
export interface TaskActionCmd {
  taskId: string;
  message?: string;
  variable?: Record<string, unknown>;
  targetUserId?: string;
}

/** 加签命令（S78 F2，对齐 AddSignatureCmd） */
export interface AddSignatureCmd {
  taskId: string;
  /** 被加签人用户 ID 集合（雪花 string） */
  userIds: string[];
  message?: string;
}

/** 发起流程实例命令 */
export interface StartInstanceCmd {
  flowCode: string;
  businessId?: string;
  /** 业务名称（展示用） */
  businessName?: string;
  variable?: Record<string, unknown>;
  /** 抄送收件人用户 ID 集合（S78 F1，雪花 string） */
  ccUserIds?: string[];
}

/* ================= 流程抄送（S78 F1） ================= */

/** 抄送记录视图对象（对齐 WorkflowCcVO） */
export interface WorkflowCcVO {
  id: string;
  instanceId: string;
  flowName?: string;
  creatorName?: string;
  /** 实例当前状态（warm-flow flowStatus 口径） */
  flowStatus?: string;
  /** 实例当前节点 */
  nodeName?: string;
  /** 0 未读 1 已读 */
  readFlag: number;
  readTime?: string;
  createTime?: string;
}

/** 抄送我的分页查询 */
export interface WorkflowCcQuery extends PageQuery {
  flowName?: string;
  readFlag?: Emptyable<number>;
}
