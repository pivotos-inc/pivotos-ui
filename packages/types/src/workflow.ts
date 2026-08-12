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
