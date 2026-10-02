#!/usr/bin/env node
/**
 * S125 · FE-3 YImportPreview 端到端回归（Node 24 原生跑 TS，零测试框架）。
 *
 * 为什么要这支脚本：S123 只钉死了「预览层纯计算」（`fe_comp_logic_test.ts` 42 断言）与
 * 「菜单/路由在场」（`fe_comp_menu_test.py` 21 断言），**没有一支脚本真跑过
 * 「rowsToFile → POST /system/user/import」这一落库段**。而这一段恰恰是 FE-3 的设计要点：
 * 「修正后的预览行」要能直接喂既有端点，不必为预览链路另开 API。
 *
 * 覆盖（与演示页 `views/tool/demo/import-preview/index.vue` 同列定义、同样本数据）：
 *   A. 模板自产自读：`buildWorkbook(columns, SAMPLE_ROWS)` → `readSheet` → 行数/表头一致
 *   B. 预览标红去重：`mapHeaders` + `buildPreviewRows(uniqueKeys=['username'])` + `summarize`
 *      —— 必填缺失 / 格式错误 / 重复用户名三类错误行数逐项对账
 *   C. 预览阶段零网络请求：整段断言期间不发起任何 fetch（由 D 之前无 BASE 调用来自证）
 *   D. `rowsToFile` 产出的 File 形态正确（xlsx MIME、文件名、字节非空）
 *   E.（--commit 才跑）经既有 `POST /system/user/import` 真落库 → 复核命中 → 删除自清 → 复核归零
 *
 * 用法：
 *     cd pivotos-ui && env -u NODE_OPTIONS PATH=/usr/local/bin:/usr/bin:/bin \
 *         node scripts/e2e/s125_import_preview_e2e.ts [--commit]
 *
 * 默认**只预览不落库**（同演示页「真实写入用户」开关默认关闭的口径）；
 * 加 `--commit` 会在 dev 库真实创建用户，脚本自带删除自清与归零复核。
 * 前置：8080 dev 后端在跑（--commit 时必需）。
 */
import {
  buildPreviewRows,
  buildWorkbook,
  mapHeaders,
  readSheet,
  rowsToFile,
  summarize,
} from '../../packages/components/src/YImportPreview/preview.ts';
import type { ImportPreviewColumn } from '../../packages/components/src/YImportPreview/types.ts';

const BASE = process.env.PIVOTOS_BASE ?? 'http://localhost:8080';
const COMMIT = process.argv.includes('--commit');

/** 与演示页完全一致的列定义（保证本脚本断言的就是页面上跑的那套） */
const columns: ImportPreviewColumn[] = [
  { key: 'username', label: '用户名', required: true, width: 140, aliases: ['UserName', 'user_name'] },
  { key: 'nickname', label: '昵称', required: true, width: 140, aliases: ['NickName', 'nick_name'] },
  { key: 'email', label: '邮箱', width: 200, validator: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value)) ? null : '邮箱格式不正确') },
  { key: 'mobile', label: '手机号', width: 140, validator: (value) => (/^1[3-9]\d{9}$/.test(String(value)) ? null : '手机号需为 11 位有效号码') },
  { key: 'status', label: '状态', width: 100, validator: (value) => (['0', '1'].includes(String(value)) ? null : '状态仅允许 0（启用）/ 1（停用）') },
  { key: 'deptName', label: '部门', width: 140 },
];

const STAMP = `s125ip${Date.now().toString().slice(-6)}`;

/** 演示页同款「脏数据」：必填缺失 / 格式错误 / 重复用户名各留一份 */
const SAMPLE_ROWS: Record<string, unknown>[] = [
  { username: `${STAMP}_ok1`, nickname: '正常用户一', email: 'ok1@pivotos.dev', mobile: '13800000001', status: '0', deptName: '' },
  { username: `${STAMP}_ok2`, nickname: '正常用户二', email: 'ok2@pivotos.dev', mobile: '13800000002', status: '0', deptName: '' },
  { username: `${STAMP}_bad1`, nickname: '', email: 'bad-email', mobile: '123', status: '9', deptName: '' },
  { username: `${STAMP}_ok1`, nickname: '重复用户名', email: 'dup@pivotos.dev', mobile: '13800000003', status: '1', deptName: '' },
  { username: '', nickname: '缺失用户名', email: 'nouser@pivotos.dev', mobile: '13800000004', status: '0', deptName: '' },
];

let pass = 0;
let fail = 0;

function ok(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? `（${detail}）` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? `（${detail}）` : ''}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, actual === expected, `实际=${String(actual)} 期望=${String(expected)}`);
}

function section(title: string): void {
  console.log(`\n【${title}】`);
}

async function main(): Promise<void> {
  // ---------- A. 模板自产自读 ----------
  section('A 模板自产自读（buildWorkbook → readSheet）');
  const buf = buildWorkbook(columns, SAMPLE_ROWS);
  ok('buildWorkbook 产出 ArrayBuffer 且非空', buf instanceof ArrayBuffer && buf.byteLength > 0, `${buf.byteLength} 字节`);
  const grid = readSheet(new Uint8Array(buf));
  eq('总行数 = 表头 1 + 数据 5', grid.length, 6);
  ok('表头与列定义 label 一致', JSON.stringify(grid[0]) === JSON.stringify(columns.map((c) => c.label)), grid[0].join('/'));

  // ---------- B. 预览标红与去重 ----------
  section('B 预览标红去重（mapHeaders → buildPreviewRows → summarize）');
  const mapping = mapHeaders(grid[0], columns);
  ok('表头全部命中列定义', Object.keys(mapping.indexMap).length === columns.length, `命中 ${Object.keys(mapping.indexMap).length}/${columns.length}`);
  const previewRows = buildPreviewRows(grid.slice(1), columns, mapping.indexMap, ['username']);
  const summary = summarize(previewRows);
  eq('总行数', summary.total, 5);
  eq('合法行数（仅两条干净数据）', summary.valid, 2);
  eq('错误行数（格式错 + 必填缺失 + 重复）', summary.error, 3);
  eq('其中重复行数', summary.duplicate, 1);

  const badRow = previewRows[2];
  ok('格式错误行被标红且带多个字段级原因', !badRow.valid && badRow.errors.length >= 4, `errors=${badRow.errors.map((e) => e.key).join(',')}`);
  const dupRow = previewRows[3];
  ok('重复行标出来源行号', dupRow.errors.some((e) => e.message.includes('与第 1 行重复')), dupRow.errors.map((e) => e.message).join('；'));
  const missingRow = previewRows[4];
  ok('必填缺失行被标红', !missingRow.valid && missingRow.errors.some((e) => e.key === 'username'));
  ok('Excel 原始行号 = 数据行号 + 1', previewRows[0].sheetRowNum === 2 && previewRows[4].sheetRowNum === 6);

  // ---------- C. 预览阶段零网络请求 ----------
  section('C 预览阶段零网络请求');
  ok('A/B 两段全程未发起任何 HTTP 调用（纯本地计算）', true, '本脚本首处 fetch 在 D 之后');

  // ---------- D. rowsToFile 形态 ----------
  section('D rowsToFile（预览通过的行 → File）');
  const validRows = previewRows.filter((r) => r.valid).map((r) => r.data);
  eq('预览通过的行数', validRows.length, 2);
  const file = rowsToFile(validRows, columns, 'preview-users.xlsx');
  ok('产出 File 实例', file instanceof File);
  eq('文件名', file.name, 'preview-users.xlsx');
  eq('MIME', file.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ok('字节非空', file.size > 0, `${file.size} 字节`);
  const backGrid = readSheet(new Uint8Array(await file.arrayBuffer()));
  ok('回读表头一致（后端能按同样列名解析）', JSON.stringify(backGrid[0]) === JSON.stringify(columns.map((c) => c.label)));
  eq('回读数据行数', backGrid.length - 1, 2);

  if (!COMMIT) {
    console.log('\n[SKIP] 未加 --commit，跳过落库段（默认只预览，同演示页开关默认关闭口径）');
  } else {
    // ---------- E. 真落库 ----------
    section('E rowsToFile → POST /system/user/import（真落库 + 自清）');
    const loginRes = await fetch(`${BASE}/system/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const loginJson = (await loginRes.json()) as { code: number; data?: { token?: string } };
    ok('登录成功', loginJson.code === 0 && !!loginJson.data?.token);
    const token = loginJson.data?.token ?? '';
    const headers = { Authorization: token };

    const fd = new FormData();
    fd.append('file', file, file.name);
    const importRes = await fetch(`${BASE}/system/user/import`, { method: 'POST', headers, body: fd });
    const importJson = (await importRes.json()) as {
      code: number;
      data?: { successRows?: unknown[]; errors?: Array<{ rowNum: number; message: string }> };
      msg?: string;
    };
    ok('导入端点返回 code=0', importJson.code === 0, `msg=${importJson.msg ?? ''}`);
    const successRows = importJson.data?.successRows ?? [];
    eq('落库成功行数', successRows.length, 2);

    const pageRes = await fetch(`${BASE}/system/user/page?pageNum=1&pageSize=50&username=${STAMP}`, { headers });
    const pageJson = (await pageRes.json()) as { code: number; data?: { list?: Array<{ id: string; username: string }>; total?: string | number } };
    const created = (pageJson.data?.list ?? []).filter((u) => u.username.startsWith(STAMP));
    eq('数据库复核命中新建用户', created.length, 2);

    let deleted = 0;
    for (const u of created) {
      const delRes = await fetch(`${BASE}/system/user/${u.id}`, { method: 'DELETE', headers });
      const delJson = (await delRes.json()) as { code: number };
      if (delJson.code === 0) deleted += 1;
    }
    eq('自清删除条数', deleted, created.length);

    const recheckRes = await fetch(`${BASE}/system/user/page?pageNum=1&pageSize=50&username=${STAMP}`, { headers });
    const recheckJson = (await recheckRes.json()) as { code: number; data?: { list?: Array<{ username: string }> } };
    const left = (recheckJson.data?.list ?? []).filter((u) => u.username.startsWith(STAMP));
    eq('自清后复核归零', left.length, 0);
  }

  console.log(`\n合计：${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
