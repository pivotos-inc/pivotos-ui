import type { Emptyable, PageQuery } from './common';

/* ================= 文件管理（S25 sys_file） ================= */

/** 预签名直传结果（对齐 PresignResult） */
export interface PresignResult {
  objectKey: string;
  uploadUrl: string;
  fileUrl: string;
  expireSeconds: number;
}

/** 文件元数据视图对象（对齐 SysFileVO） */
export interface SysFileVO {
  id: string;
  objectKey: string;
  originalName: string;
  fileSize?: number;
  md5?: string;
  contentType?: string;
  storageType?: string;
  bucket?: string;
  createBy?: string;
  createTime?: string;
}

/** 文件元数据分页查询（对齐 FilePageQuery） */
export interface FilePageQuery extends PageQuery {
  originalName?: string;
  storageType?: Emptyable<string>;
}

/** 直传完成回调登记请求（对齐 FileRegisterRequest） */
export interface FileRegisterRequest {
  objectKey: string;
  originalName?: string;
  fileSize?: number;
  md5?: string;
  contentType?: string;
}
