<script setup lang="ts">
defineOptions({ name: 'DemoImportPreview' });
import { ref } from 'vue';
import { ElAlert, ElButton, ElMessage, ElSwitch, ElTag } from 'element-plus';
import { YImportPreview, buildWorkbook, rowsToFile } from '@pivotos/components';
import type { ImportPreviewColumn } from '@pivotos/components';
import { importUsers } from '@/api/system/user';

/**
 * 导入预览演示（FE-3）。
 *
 * 演示要点：
 * - 解析在浏览器本地完成（预览阶段零网络请求），选中文件即可看到「哪一行、哪一列、为什么错」；
 * - 错误行标红 + 重复行去重标红可现场验证：点「下载示例数据（含错误行）」拿到一份脏数据再上传；
 * - 默认**只预览不落库**；打开「真实写入用户」后才经既有 `POST /system/user/import` 写库
 *   （需要 system:user:import 权限，会在 dev 库真实创建用户，请谨慎）。
 */

const columns: ImportPreviewColumn[] = [
  { key: 'username', label: '用户名', required: true, width: 140, aliases: ['UserName', 'user_name'] },
  { key: 'nickname', label: '昵称', required: true, width: 140, aliases: ['NickName', 'nick_name'] },
  { key: 'email', label: '邮箱', width: 200, validator: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value)) ? null : '邮箱格式不正确') },
  { key: 'phonenumber', label: '手机号', width: 140, validator: (value) => (/^1[3-9]\d{9}$/.test(String(value)) ? null : '手机号需为 11 位有效号码') },
  {
    key: 'status',
    label: '状态',
    width: 100,
    validator: (value) => (['0', '1'].includes(String(value)) ? null : '状态仅允许 0（启用）/ 1（停用）'),
  },
  { key: 'deptName', label: '部门', width: 140 },
];

/** 一份「脏数据」样本：故意留必填缺失、格式错误与重复用户名，用来看标红效果 */
const SAMPLE_ROWS: Record<string, unknown>[] = [
  { username: 'preview_ok_1', nickname: '正常用户一', email: 'ok1@pivotos.dev', phonenumber: '13800000001', status: '0', deptName: '研发中心' },
  { username: 'preview_ok_2', nickname: '正常用户二', email: 'ok2@pivotos.dev', phonenumber: '13800000002', status: '0', deptName: '市场部' },
  { username: 'preview_bad_1', nickname: '', email: 'bad-email', phonenumber: '123', status: '9', deptName: '财务部' },
  { username: 'preview_ok_1', nickname: '重复用户名', email: 'dup@pivotos.dev', phonenumber: '13800000003', status: '1', deptName: '研发中心' },
  { username: '', nickname: '缺失用户名', email: 'nouser@pivotos.dev', phonenumber: '13800000004', status: '0', deptName: '人力资源部' },
];

const previewRef = ref<InstanceType<typeof YImportPreview>>();
const realCommit = ref(false);
const lastResult = ref('');

function handleSampleDownload(): void {
  const blob = buildWorkbook(columns, SAMPLE_ROWS);
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '导入预览-示例数据（含错误行）.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 不落库：只把「会通过的行」打到页面上 */
function handleConfirm(rows: Record<string, unknown>[]): void {
  lastResult.value = JSON.stringify(rows, null, 2);
  ElMessage.success(`预览确认：${rows.length} 行通过校验（未落库）`);
}

/** 真落库：把修正后的行回写成 xlsx，交给既有的用户导入端点（组件自身已带 committing 态与回执提示） */
function commitFn(rows: Record<string, unknown>[]): Promise<unknown> {
  const file = rowsToFile(rows, columns, 'preview-users.xlsx');
  return importUsers(file).then((result) => {
    lastResult.value = JSON.stringify(result, null, 2);
    return result;
  });
}

function handleReset(): void {
  previewRef.value?.reset();
  lastResult.value = '';
}
</script>

<template>
  <div class="demo-import">
    <ElAlert
      type="warning"
      show-icon
      :closable="false"
      title="FE-3 导入预览：先预览确认，再决定是否落库"
      description="下载示例数据（含错误行）→ 上传即可看到错误行标红、重复用户名标红与错误明细；默认只预览，打开「真实写入用户」后才会经 POST /system/user/import 写库（会真实创建用户并在操作日志留痕）。"
      class="demo-import__alert"
    />

    <div class="page-card">
      <div class="demo-import__bar">
        <ElButton @click="handleSampleDownload">下载示例数据（含错误行）</ElButton>
        <ElButton @click="handleReset">清空预览</ElButton>
        <ElSwitch v-model="realCommit" active-text="真实写入用户" inactive-text="仅预览" />
        <ElTag :type="realCommit ? 'danger' : 'success'" size="small" effect="plain">
          {{ realCommit ? '确认后会真实创建用户（需 system:user:import）' : '当前为只读预览，不写库' }}
        </ElTag>
      </div>

      <YImportPreview
        ref="previewRef"
        :columns="columns"
        :unique-keys="['username']"
        :commit-fn="realCommit ? commitFn : undefined"
        template-filename="用户导入模板"
        @confirm="handleConfirm"
      />

      <div v-if="lastResult" class="demo-import__result">
        <div class="demo-import__title">最近一次确认的数据（{{
          realCommit ? '已提交后端，以下为后端回执' : '仅预览，未落库'
        }}）</div>
        <pre class="demo-import__pre">{{ lastResult }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-import__alert {
  margin-bottom: 12px;
}

.demo-import__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.demo-import__title {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 500;
}

.demo-import__pre {
  max-height: 260px;
  margin: 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 12px;
  line-height: 1.6;
}
</style>
