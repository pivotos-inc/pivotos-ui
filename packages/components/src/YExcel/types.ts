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

/** 流式导入单行事件（SSE row 事件格式） */
export interface ImportStreamRow {
  rowNum: number;
  status: 'success' | 'error';
  username: string;
  message: string;
}

/** 流式导入完成事件 */
export interface ImportStreamDone {
  totalRows: number;
  successCount: number;
  errorCount: number;
}

/** 流式导入回调 */
export interface ImportStreamCallbacks {
  onRow: (row: ImportStreamRow) => void;
  onDone: (result: ImportStreamDone) => void;
  onError: (message: string) => void;
}

/**
 * 流式导入函数签名：业务侧注入此函数，YExcel 负责展示实时结果。
 * @param file 上传的 Excel 文件
 * @param callbacks 逐行/完成/异常回调
 * @param signal 用于前端取消操作
 */
export type ImportStreamFn = (
  file: File,
  callbacks: ImportStreamCallbacks,
  signal: AbortSignal,
) => Promise<void>;
