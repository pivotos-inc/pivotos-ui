/**
 * YExcel 组件对外暴露的方法签名：由业务侧注入下载/上传逻辑。
 * 即 YExcel 组件不直接依赖 request 实例，所有数据操作由业务侧控制。
 */

/** 文件下载方法签名：接收 axios blob response，触发浏览器保存 */
export type BlobSaveFn = (blob: Blob, filename: string) => void;

/** 导入错误回执 */
export interface ImportError {
  rowNum: number;
  message: string;
}

/** 导入结果 */
export interface ImportResult<T = unknown> {
  successRows: T[];
  errors: ImportError[];
}
