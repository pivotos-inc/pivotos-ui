import type { BaseVO, Emptyable, PageQuery } from './common';

/* ================= 消息模板 ================= */

/** 消息模板视图对象（对齐 TemplateVO） */
export interface TemplateVO extends BaseVO {
  templateCode: string;
  templateName: string;
  titleTpl: string;
  contentTpl: string;
  msgType?: number;
  channel?: string;
  status?: number;
  remark?: string;
}

/** 模板分页查询（对齐 TemplateQuery） */
export interface TemplateQuery extends PageQuery {
  templateName?: string;
  templateCode?: string;
  status?: Emptyable<number>;
}

/** 模板新增/修改请求（对齐 TemplateSaveRequest；id 为空为新增） */
export interface TemplateSaveRequest {
  id?: string;
  templateCode: string;
  templateName: string;
  titleTpl: string;
  contentTpl: string;
  msgType?: number;
  channel?: string;
  status?: number;
  remark?: string;
}

/* ================= 消息管理 ================= */

/** 后台消息视图对象（对齐 MessageManageVO） */
export interface MessageManageVO {
  id: string;
  title: string;
  content: string;
  msgType?: number;
  bizType?: string;
  bizId?: string;
  receiverCount?: number;
  createTime?: string;
}

/** 后台消息分页查询（对齐 MessageManageQuery） */
export interface MessageManageQuery extends PageQuery {
  title?: string;
  msgType?: Emptyable<number>;
  bizType?: string;
}

/** 后台消息发送请求（对齐 MessageSendRequest；templateCode 与 title/content 二选一） */
export interface MessageSendRequest {
  templateCode?: string;
  title?: string;
  content?: string;
  msgType?: number;
  channel?: string;
  bizType?: string;
  bizId?: string;
  receiverIds: string[];
}

/* ================= 我的消息 ================= */

/** 用户消息视图对象（对齐 MessageDTO） */
export interface UserMessageVO {
  /** 消息 ID */
  id: string;
  /** 用户消息 ID（已读操作主键） */
  userMessageId: string;
  title: string;
  content: string;
  msgType?: number;
  bizType?: string;
  bizId?: string;
  readStatus?: number;
  readTime?: string;
  createTime?: string;
}

/** 我的消息分页查询（对齐 MessagePageQuery） */
export interface UserMessageQuery extends PageQuery {
  readStatus?: Emptyable<number>;
  msgType?: Emptyable<number>;
}
