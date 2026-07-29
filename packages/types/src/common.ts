/** 统一响应体（对齐 com.pivotos.common.core.result.R） */
export interface R<T = unknown> {
  /** 业务错误码，0 表示成功 */
  code: number;
  /** 提示信息 */
  msg: string;
  /** 数据载荷 */
  data: T;
  /** 链路追踪 ID */
  traceId?: string;
}

/** 成功码 */
export const SUCCESS_CODE = 0;

/**
 * 查询条件可空类型：'' 表示查询表单"请选择"空值项（未选择），
 * useTablePage 发起请求前会将其与 undefined/null 一并剔除，不下发后端。
 */
export type Emptyable<T> = T | '';

/** 分页查询参数（GET 拼 query） */
export interface PageQuery {
  pageNum?: number;
  pageSize?: number;
  [key: string]: unknown;
}

/** 分页结果（对齐 com.pivotos.common.core.page.PageResult） */
export interface PageResult<T = unknown> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}

/**
 * 基础视图对象（对齐 BaseDTO）。
 * 注意：后端雪花 Long 已全局序列化为 String，前端一律用 string。
 */
export interface BaseVO {
  id: string;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}
