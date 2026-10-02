#!/usr/bin/env node
/**
 * FE-COMP 三件套「纯逻辑」断言脚本（node 直接跑 TS，无需测试框架）。
 *
 * 覆盖范围：**没有 UI 副作用**的确定性计算层——
 *   FE-2  packages/ui   src/components/YSchemaForm/schema.ts（widget 推导 / 校验规则推导 / 默认值）
 *   FE-3  packages/components src/YImportPreview/preview.ts（表头映射 / 行校验 / 去重 / 模板生成）
 *
 * 为什么不引入 vitest：这两个包目前没有任何测试框架依赖，为一个纯计算层拖进一条测试链 + 配置
 * 不划算；Node 24 原生支持 TS 类型擦除，直接用 node 跑即可，CI 里零额外依赖。
 *
 * 用法：cd pivotos-ui && node scripts/fe_comp_logic_test.ts
 */
import { applyDefaults, buildRules, resolveWidget } from '../packages/ui/src/components/YSchemaForm/schema.ts';
import type { JsonSchemaField } from '../packages/ui/src/components/YSchemaForm/types.ts';
import {
  buildPreviewRows,
  buildWorkbook,
  mapHeaders,
  readSheet,
  summarize,
} from '../packages/components/src/YImportPreview/preview.ts';
import type { ImportPreviewColumn } from '../packages/components/src/YImportPreview/types.ts';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` —— ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n【${title}】`);
}

/** 从规则里取出第一条规则的错误文案（模拟 ElForm 执行 validator） */
async function firstError(field: JsonSchemaField, value: unknown): Promise<string> {
  for (const rule of buildRules(field)) {
    if (typeof rule.validator === 'function') {
      let message = '';
      try {
        const result = rule.validator(rule, value, (e?: Error | string) => {
          if (e) message = typeof e === 'string' ? e : e.message;
        });
        if (result instanceof Promise) await result;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      if (message) return message;
    }
  }
  return '';
}

// ==================== FE-2：动态表单 ====================
section('FE-2 resolveWidget（控件推导优先级：显式 widget > format > type）');
check('string 无 options → input', resolveWidget({ key: 'a', title: 'A', type: 'string' }) === 'input');
check('string 带 options → select', resolveWidget({ key: 'a', title: 'A', type: 'string', options: [{ label: 'L', value: 'v' }] }) === 'select');
check('boolean → switch', resolveWidget({ key: 'a', title: 'A', type: 'boolean' }) === 'switch');
check('integer → number', resolveWidget({ key: 'a', title: 'A', type: 'integer' }) === 'number');
check('array → checkbox（多选组）', resolveWidget({ key: 'a', title: 'A', type: 'array' }) === 'checkbox');
check('format=upload 覆盖 type=string', resolveWidget({ key: 'a', title: 'A', type: 'string', format: 'upload' }) === 'upload');
check('显式 widget 优先级最高', resolveWidget({ key: 'a', title: 'A', type: 'string', options: [{ label: 'L', value: 'v' }], widget: 'radio' }) === 'radio');

section('FE-2 buildRules（校验规则由 schema 描述）');
check('必填 + input → 「请输入」', buildRules({ key: 'a', title: '客户名称', type: 'string', required: true })[0]?.message === '请输入客户名称');
check('必填 + select → 「请选择」', buildRules({ key: 'a', title: '客户类型', type: 'string', required: true, options: [{ label: 'L', value: 'v' }] })[0]?.message === '请选择客户类型');
check('必填 + array → 至少选择一项', buildRules({ key: 'a', title: '标签', type: 'array', required: true })[0]?.message === '请至少选择一项');
check('maxLength 落到 max', buildRules({ key: 'a', title: 'A', type: 'string', maxLength: 20 })[0]?.max === 20);
check('format=email 自动生成正则', buildRules({ key: 'a', title: 'A', type: 'string', format: 'email' })[0]?.pattern instanceof RegExp);
check('业务侧 rules 叠加在后', buildRules({ key: 'a', title: 'A', type: 'string', maxLength: 5, rules: [{ required: true, message: 'custom' }] }).some((r) => r.message === 'custom'));

const lengthField: JsonSchemaField = { key: 'a', title: '备注', type: 'string', minLength: 3 };
const rangeField: JsonSchemaField = { key: 'n', title: '星级', type: 'integer', minimum: 1, maximum: 5 };
const itemsField: JsonSchemaField = { key: 'tags', title: '标签', type: 'array', minItems: 2, maxItems: 3 };
await Promise.all([
  firstError(lengthField, 'ab').then((m) => check('minLength 命中', m.includes('至少 3'), m)),
  firstError(lengthField, '').then((m) => check('minLength：空值放行（非必填不该报格式错）', m === '', m)),
  firstError(rangeField, 9).then((m) => check('maximum 命中', m.includes('不能大于 5'), m)),
  firstError(rangeField, 2.5).then((m) => check('integer：小数被拒', m.includes('整数'), m)),
  firstError(rangeField, '').then((m) => check('数值字段：空值放行', m === '', m)),
  firstError(itemsField, ['a']).then((m) => check('minItems 命中', m.includes('至少选择 2 项'), m)),
  firstError(itemsField, ['a', 'b', 'c', 'd']).then((m) => check('maxItems 命中', m.includes('最多选择 3 项'), m)),
]);

section('FE-2 applyDefaults（只补缺失 key，数组/对象做浅拷贝）');
{
  const model: Record<string, unknown> = { name: '已给值' };
  applyDefaults(
    [
      { key: 'name', title: '名称', type: 'string', default: '默认名' },
      { key: 'level', title: '星级', type: 'integer', default: 3 },
      { key: 'tags', title: '标签', type: 'array', default: ['a'] },
    ],
    model,
  );
  check('已存在的 key 不被覆盖', model['name'] === '已给值');
  check('缺失 key 补默认值', model['level'] === 3);
  check('数组默认值是拷贝（改 model 不污染源 schema）', model['tags'] !== undefined && (model['tags'] as string[]).length === 1);
}

// ==================== FE-3：导入预览 ====================
section('FE-3 mapHeaders（表头三级匹配 + 缺失必填列识别）');
{
  const cols: ImportPreviewColumn[] = [
    { key: 'username', label: '用户名', required: true, aliases: ['UserName', 'user_name'] },
    { key: 'nickname', label: '昵称', required: true },
    { key: 'remark', label: '备注' },
  ];
  const mapping = mapHeaders(['User_Name', '昵称', '未知列'], cols);
  check('别名命中（忽略大小写与下划线）', mapping.indexMap['username'] === 0);
  check('label 命中', mapping.indexMap['nickname'] === 1);
  check('未知表头被识别出来但不阻断', mapping.unknownHeaders.includes('未知列'));
  check('缺失列列表为空', mapping.missingColumns.length === 0);

  const missing = mapHeaders(['备注'], cols);
  check('必填列缺失被检出', missing.missingColumns.join('、') === '用户名、昵称', missing.missingColumns.join('、'));
}

section('FE-3 buildPreviewRows（行校验 + 去重保留首行）');
{
  const cols: ImportPreviewColumn[] = [
    { key: 'username', label: '用户名', required: true },
    { key: 'age', label: '年龄', type: 'number' },
    { key: 'hiredAt', label: '入职日期', type: 'date' },
    { key: 'phone', label: '手机号', validator: (v) => (/^1[3-9]\d{9}$/.test(String(v)) ? null : '手机号格式不正确') },
  ];
  const table: string[][] = [
    ['用户名', '年龄', '入职日期', '手机号'],
    ['alice', '28', '2026-01-05', '13800000001'],
    ['bob', 'abc', '2026-01-05', '13800000002'],
    ['', '30', '2026-01-06', '13800000003'],
    ['alice', '31', '2026-01-07', '13800000004'],
    ['carl', '32', '2026-01-08', '123'],
  ];
  const mapping = mapHeaders(table[0], cols);
  const rows = buildPreviewRows(table.slice(1), cols, mapping.indexMap, ['username']);
  const summary = summarize(rows);

  check('行数 = 数据行数', summary.total === 5, JSON.stringify(summary));
  check('仅首行完全合法', summary.valid === 1, JSON.stringify(summary));
  check('错误行数 = 4', summary.error === 4, JSON.stringify(summary));
  check('重复行数 = 1', summary.duplicate === 1, JSON.stringify(summary));
  check('数字类型校验生效', rows[1].errors.some((e) => e.message.includes('不是合法数字')), JSON.stringify(rows[1].errors));
  check('必填校验生效', rows[2].errors.some((e) => e.message.includes('不能为空')), JSON.stringify(rows[2].errors));
  check('重复行标出来源行号', rows[3].errors.some((e) => e.message === '重复数据（与第 1 行重复）'), JSON.stringify(rows[3].errors));
  check('自定义 validator 生效', rows[4].errors.some((e) => e.message === '手机号格式不正确'), JSON.stringify(rows[4].errors));
  check('行号从 1 开始递增', rows.map((r) => r.rowNum).join(',') === '1,2,3,4,5');
  check('Excel 原始行号 = 数据行号 + 1（表头占第一行）', rows[0].sheetRowNum === 2);
  check('数值字段按 number 收敛', typeof rows[0].data['age'] === 'number' && rows[0].data['age'] === 28);
}

section('FE-3 buildWorkbook ↔ readSheet（模板可被自身解析）');
{
  const cols: ImportPreviewColumn[] = [
    { key: 'username', label: '用户名' },
    { key: 'nickname', label: '昵称' },
  ];
  const buffer = buildWorkbook(cols, [{ username: 'alice', nickname: '爱丽丝' }]);
  const table = readSheet(buffer);
  check('写出后可读回：表头一致', table[0]?.join(',') === '用户名,昵称', JSON.stringify(table[0]));
  check('写出后可读回：数据行一致', table[1]?.join(',') === 'alice,爱丽丝', JSON.stringify(table[1]));
  check('空工作簿安全返回空数组', readSheet(new ArrayBuffer(0)).length === 0);
}

console.log(`\n合计：${passed} PASS / ${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
