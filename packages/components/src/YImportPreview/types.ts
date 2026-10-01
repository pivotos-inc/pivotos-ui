/**
 * YImportPreview —— 导入前预览（FE-3）。
 *
 * 与 YExcel 的分工：
 * - YExcel =「上传 → 后端落库 → 回执」的直通链路（含流式 SSE），适合小批量、服务端校验的场景；
 * - YImportPreview =「本地读 Excel → 表格预览 + 错误行标红去重 → 用户确认 → 才落库」，
 *   适合「错了要改数据」的批量导入：**错误信息必须在落库前让用户看见**。
 *
 * 青铜法则：**预览阶段不发任何网络请求**（解析全在浏览器本地完成），确认动作才由业务侧注入的
 * commitFn 落库；这样「选错文件」「改一列重新看」零副作用。
 */

/** 列定义：目标字段 + 校验约束 */
export interface ImportPreviewColumn {
  /** 目标字段名（落库时的 key） */
  key: string;
  /** 表头文案（同时作为模板列名与预览列名） */
  label: string;
  /** 必填：空值即视为错误行 */
  required?: boolean;
  /** 表头别名：允许UserName/user_name/userName 等多种写法映射到同一字段 */
  aliases?: string[];
  /** 值的收敛类型（预览阶段同时做类型转换与校验） */
  type?: 'string' | 'number' | 'date';
  /** 行级自定义校验：返回错误信息（中文短句），通过返回 null */
  validator?: (value: unknown, row: Record<string, unknown>) => string | null;
  /** 预览列宽（缺省 140） */
  width?: number;
  /** 该列的取值提示（用于模板与错误文案） */
  hint?: string;
}

/** 单个单元格级错误 */
export interface ImportPreviewError {
  /** 出错字段（表头缺失类错误为空） */
  key?: string;
  message: string;
}

/** 预览行 */
export interface ImportPreviewRow {
  /** Excel 行号（从表头下一行计 1，便于用户对着表格改） */
  rowNum: number;
  /** Excel 原始行号（含表头行，用于「请修改第 N 行」这类提示） */
  sheetRowNum: number;
  /** 按 ImportPreviewColumn.key 归集后的数据 */
  data: Record<string, unknown>;
  errors: ImportPreviewError[];
  /** 是否有错（含重复） */
  valid: boolean;
}

/** 预览统计 */
export interface ImportPreviewSummary {
  total: number;
  valid: number;
  error: number;
  duplicate: number;
}

/** 表头匹配结果 */
export interface HeaderMapping {
  /** key → Excel 列下标 */
  indexMap: Record<string, number>;
  /** 未被识别的表头（仅提示，不影响导入） */
  unknownHeaders: string[];
  /** 缺失的必填列（一旦非空，整份文件不可用） */
  missingColumns: string[];
}
