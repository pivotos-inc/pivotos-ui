<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import { YTable } from '@pivotos/ui';
import type { YTableColumn } from '@pivotos/ui';
import type { CodingSessionVO } from '@pivotos/types';
import { useTablePage } from '@/hooks';
import { applyCodingSession, getCodingSession, parseCoding } from '@/api/ai/coding';

const router = useRouter();

/* ================= 自然语言输入 ================= */
const description = ref('');
const parsing = ref(false);

const EXAMPLES = [
  '帮我给客户表生成增删改查，字段有姓名、手机号、备注',
  '生成一个商品管理功能，包含商品名称、价格、库存、上架状态',
  '帮我做合同管理，字段有合同编号、甲方、乙方、金额、签订日期',
];

const STATUS_MAP: Record<number, { label: string; type: 'info' | 'warning' | 'success' | 'danger' }> = {
  0: { label: '解析中', type: 'info' },
  1: { label: '待评审', type: 'warning' },
  2: { label: '已应用', type: 'success' },
  3: { label: '失败', type: 'danger' },
};

async function handleParse() {
  if (!description.value.trim()) {
    ElMessage.warning('请先输入业务描述');
    return;
  }
  parsing.value = true;
  try {
    const session = await parseCoding({ description: description.value.trim() });
    ElMessage.success('解析生成完成，请评审后确认应用');
    await loadSession(session.id);
    await search();
  } finally {
    parsing.value = false;
  }
}

/* ================= 会话详情 / 代码预览 ================= */
const current = ref<CodingSessionVO>();
const detailLoading = ref(false);
const activeFile = ref('');

const fileList = computed(() => Object.keys(current.value?.generatedFiles ?? {}));

async function loadSession(id: string) {
  detailLoading.value = true;
  try {
    current.value = await getCodingSession(id);
    activeFile.value = fileList.value[0] ?? '';
  } finally {
    detailLoading.value = false;
  }
}

const applying = ref(false);

async function handleApply() {
  if (!current.value?.id) return;
  await ElMessageBox.confirm(
    `确定将「${current.value.functionName || current.value.tableName}」的代码生成到工程吗？生成后需重启后端生效。`,
    '确认应用',
    { confirmButtonText: '确定生成', type: 'warning' },
  );
  applying.value = true;
  try {
    await applyCodingSession(current.value.id);
    current.value.status = 2;
    ElMessage.success('已生成到工程，可在代码生成页继续管理');
    await search();
  } finally {
    applying.value = false;
  }
}

function goGenerator() {
  router.push('/tool/generator');
}

/* ================= 历史会话 ================= */
const { loading, rows, total, params, load, search } = useTablePage<CodingSessionVO>({
  url: '/ai-coding/session/page',
});

const columns: YTableColumn<CodingSessionVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'description', label: '业务描述', minWidth: 240, showOverflowTooltip: true },
  { prop: 'tableName', label: '表名', width: 160 },
  { prop: 'functionName', label: '功能名称', width: 140 },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'status' },
  { prop: 'createTime', label: '创建时间', width: 170 },
];
</script>

<template>
  <div class="page-card">
    <!-- 输入区 -->
    <div class="coding-input">
      <div class="coding-input__title">用一句话描述你想要的业务功能，AI 帮你生成全套 CRUD 代码</div>
      <ElInput
        v-model="description"
        type="textarea"
        :rows="3"
        placeholder="例如：帮我给客户表生成增删改查，字段有姓名、手机号、备注"
      />
      <div class="coding-input__bar">
        <div class="coding-input__examples">
          <span class="coding-input__tip">试试：</span>
          <ElButton
            v-for="ex in EXAMPLES"
            :key="ex"
            size="small"
            round
            @click="description = ex"
          >
            {{ ex.length > 18 ? ex.slice(0, 18) + '…' : ex }}
          </ElButton>
        </div>
        <ElButton v-hasPermi="'ai:coding:parse'" type="primary" :loading="parsing" @click="handleParse">
          {{ parsing ? 'AI 解析生成中（约 30 秒）…' : '生成代码' }}
        </ElButton>
      </div>
    </div>

    <!-- 评审区 -->
    <div v-if="current" v-loading="detailLoading" class="coding-review">
      <div class="coding-review__head">
        <ElDescriptions :column="4" border size="small" style="flex: 1">
          <ElDescriptionsItem label="模块名">{{ current.moduleName || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="表名">{{ current.tableName || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="功能名称">{{ current.functionName || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag :type="STATUS_MAP[current.status ?? 0].type" disable-transitions>
              {{ STATUS_MAP[current.status ?? 0].label }}
            </ElTag>
          </ElDescriptionsItem>
        </ElDescriptions>
        <div class="coding-review__actions">
          <ElButton
            v-if="current.status === 1"
            v-hasPermi="'ai:coding:apply'"
            type="warning"
            :loading="applying"
            @click="handleApply"
          >
            确认生成到工程
          </ElButton>
          <ElButton v-if="current.status === 2" type="primary" @click="goGenerator">
            去代码生成页查看
          </ElButton>
        </div>
      </div>
      <div class="coding-preview">
        <div class="coding-preview__files">
          <div
            v-for="file in fileList"
            :key="file"
            class="coding-preview__file"
            :class="{ 'is-active': activeFile === file }"
            @click="activeFile = file"
          >
            {{ file.split('/').pop() }}
          </div>
        </div>
        <div class="coding-preview__code">
          <pre><code>{{ current.generatedFiles?.[activeFile] }}</code></pre>
        </div>
      </div>
    </div>

    <!-- 历史会话 -->
    <div class="coding-history">
      <div class="coding-history__title">历史会话</div>
      <YTable
        v-model:page-num="params.pageNum"
        v-model:page-size="params.pageSize"
        :loading="loading"
        :data="rows"
        :columns="columns"
        :total="total"
        row-key="id"
        @refresh="load"
      >
        <template #status="{ row }">
          <ElTag :type="STATUS_MAP[(row as CodingSessionVO).status ?? 0].type" disable-transitions>
            {{ STATUS_MAP[(row as CodingSessionVO).status ?? 0].label }}
          </ElTag>
        </template>
        <ElTableColumn label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <ElButton v-hasPermi="'ai:coding:list'" link type="primary" @click="loadSession((row as CodingSessionVO).id)">查看</ElButton>
          </template>
        </ElTableColumn>
      </YTable>
    </div>
  </div>
</template>

<style scoped>
.page-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 12px;
}

.coding-input__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.coding-input__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  gap: 12px;
  flex-wrap: wrap;
}

.coding-input__examples {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.coding-input__tip {
  color: #909399;
  font-size: 13px;
}

.coding-review {
  margin-top: 20px;
  border-top: 1px solid #ebeef5;
  padding-top: 16px;
}

.coding-review__head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.coding-review__actions {
  display: flex;
  gap: 8px;
}

.coding-preview {
  display: flex;
  height: 480px;
  margin-top: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.coding-preview__files {
  width: 220px;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
  padding: 8px;
}

.coding-preview__file {
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
}

.coding-preview__file.is-active {
  background: #ecf5ff;
  color: #165dff;
}

.coding-preview__code {
  flex: 1;
  overflow: auto;
  background: #fafafa;
}

.coding-preview__code pre {
  margin: 0;
  padding: 12px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.coding-history {
  margin-top: 20px;
  border-top: 1px solid #ebeef5;
  padding-top: 16px;
}

.coding-history__title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}
</style>
