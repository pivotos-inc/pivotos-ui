import type { BaseVO } from './common';

/** 字典数据（对齐后端 DictDataVO；useDict 翻译仅用 dictLabel/dictValue） */
export interface DictDataVO extends BaseVO {
  dictType: string;
  dictLabel: string;
  dictValue: string;
  sort?: number;
  status?: number;
  remark?: string;
}
