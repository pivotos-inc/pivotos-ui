import * as XLSX from 'xlsx';
import type {
  HeaderMapping,
  ImportPreviewColumn,
  ImportPreviewRow,
  ImportPreviewSummary,
} from './types';

/**
 * 预览前的纯计算层（解析 + 表头映射 + 校验去重）。
 *
 * 之所以与 .vue 分离：这段逻辑是**没有 UI 副作用**的确定性计算，抽出来才能在 Node / 单测里直接跑，
 * 不必为了验证「第 3 行是否标红」先起一个浏览器。
 */

/** 读取工作簿首个工作表为二维数组（raw:false —— 一律取展示字符串，避免 JS 日期漂移与时区问题） */
export function readSheet(data: ArrayBuffer | Uint8Array): string[][] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, raw: false, defval: '' });
}

/** 表头归一化：去空白、去星号标记、转小写、去下划线与连字符 */
function normalizeHeader(raw: string): string {
  return String(raw ?? '')
    .replace(/[*＊]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
}

/** 表头 → 字段映射：label → aliases → key 三级匹配，三级都命中不了才算未知列 */
export function mapHeaders(headers: string[], columns: ImportPreviewColumn[]): HeaderMapping {
  const indexMap: Record<string, number> = {};
  const unknownHeaders: string[] = [];

  const normalizedHeaderList = headers.map(normalizeHeader);

  for (const col of columns) {
    const candidates = [col.label, ...(col.aliases ?? []), col.key].map(normalizeHeader);
    const hit = normalizedHeaderList.findIndex((h, i) => {
      if (!h) return false;
      // 已被占用的列不重复匹配，避免两列都叫 label 的退化情形
      return candidates.includes(h) && !Object.values(indexMap).includes(i);
    });
    if (hit >= 0) indexMap[col.key] = hit;
  }

  const used = new Set(Object.values(indexMap));
  normalizedHeaderList.forEach((h, i) => {
    if (h && !used.has(i)) unknownHeaders.push(String(headers[i] ?? '').trim());
  });

  const missingColumns = columns.filter((c) => c.required && indexMap[c.key] === undefined).map((c) => c.label);

  return { indexMap, unknownHeaders, missingColumns };
}

function cellValue(row: string[], index: number | undefined): string {
  if (index === undefined) return '';
  return String(row[index] ?? '').trim();
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** 行级校验：类型收敛 → 必填 → 自定义校验 */
function validateRow(
  row: string[],
  columns: ImportPreviewColumn[],
  indexMap: Record<string, number>,
): { data: Record<string, unknown>; errors: ImportPreviewRow['errors'] } {
  const data: Record<string, unknown> = {};
  const errors: ImportPreviewRow['errors'] = [];

  for (const col of columns) {
    const rawValue = cellValue(row, indexMap[col.key]);

    let value: unknown = rawValue;
    if (col.type === 'number' && rawValue !== '') {
      const num = Number(rawValue);
      if (Number.isNaN(num)) {
        errors.push({ key: col.key, message: `${col.label}「${rawValue}」不是合法数字` });
        data[col.key] = rawValue;
        continue;
      }
      value = num;
    }
    if (col.type === 'date' && rawValue !== '') {
      // 只做「能不能解析成日期」的收敛，不改写原格式（落库口径由业务侧决定）
      if (Number.isNaN(new Date(rawValue).getTime())) {
        errors.push({ key: col.key, message: `${col.label}「${rawValue}」不是合法日期` });
        data[col.key] = rawValue;
        continue;
      }
      value = rawValue;
    }
    data[col.key] = value;

    if (col.required && isBlank(value)) {
      errors.push({ key: col.key, message: `${col.label}不能为空` });
      continue;
    }
    if (col.validator && !isBlank(value)) {
      const message = col.validator(value, data);
      if (message) errors.push({ key: col.key, message });
    }
  }

  return { data, errors };
}

/**
 * 构造预览行，并完成去重。
 *
 * 去重口径（重要）：以 uniqueKeys 组合键为准，**保留首次出现的行**，后续重复行标记为
 * duplicate 错误；同时把首个重复行的来源行号写进文案，方便用户直接回去改。
 */
export function buildPreviewRows(
  rows: string[][],
  columns: ImportPreviewColumn[],
  indexMap: Record<string, number>,
  uniqueKeys?: string[],
): ImportPreviewRow[] {
  const seen = new Map<string, number>();
  const result: ImportPreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { data, errors } = validateRow(rows[i], columns, indexMap);

    if (uniqueKeys?.length) {
      const composite = uniqueKeys.map((k) => String(data[k] ?? '')).join('\u0000');
      // 空组合键不参与去重：全空的「必须列」会让所有行互相判定重复
      if (composite.replace(/\u0000/g, '') !== '') {
        const first = seen.get(composite);
        if (first !== undefined) {
          errors.push({ key: uniqueKeys[0], message: `重复数据（与第 ${first} 行重复）` });
        } else {
          seen.set(composite, i + 1);
        }
      }
    }

    result.push({
      rowNum: i + 1,
      // +2：表头占第 1 行，故数据首行在 Excel 里是第 2 行
      sheetRowNum: i + 2,
      data,
      errors,
      valid: errors.length === 0,
    });
  }

  return result;
}

export function summarize(rows: ImportPreviewRow[]): ImportPreviewSummary {
  const total = rows.length;
  const errorRows = rows.filter((r) => !r.valid);
  return {
    total,
    valid: total - errorRows.length,
    error: errorRows.length,
    duplicate: errorRows.filter((r) => r.errors.some((e) => e.message.startsWith('重复数据'))).length,
  };
}

/** 用列定义生成导入模板并触发浏览器下载（无需后端接口） */
export function buildWorkbook(
  columns: ImportPreviewColumn[],
  rows?: Record<string, unknown>[],
): ArrayBuffer {
  const data: unknown[][] = [columns.map((c) => c.label)];
  for (const row of rows ?? []) {
    data.push(
      columns.map((c) => {
        const value = row[c.key];
        return value === undefined || value === null ? '' : String(value);
      }),
    );
  }
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export function downloadTemplate(columns: ImportPreviewColumn[], filename = '导入模板'): void {
  const blob = buildWorkbook(columns);
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 行数据 → File（把「预览通过的行」回写成一份干净的 xlsx 再交给后端）。
 *
 * 存在的理由：后端既有导入端点（`POST /system/user/import`）收的是 MultipartFile，
 * 有了这个函数，业务侧可以把「用户修正过的预览行」直接喂给原端点，不必为预览链路另开 API。
 */
export function rowsToFile(
  rows: Record<string, unknown>[],
  columns: ImportPreviewColumn[],
  filename = 'preview-rows.xlsx',
): File {
  const blob = buildWorkbook(columns, rows);
  return new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
