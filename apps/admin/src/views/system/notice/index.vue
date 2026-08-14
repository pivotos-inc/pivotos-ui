<script setup lang="ts">
defineOptions({ name: 'SystemNotice' });
import { computed, onBeforeUnmount, reactive, ref, shallowRef } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn, ElTag } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import type { NoticeQuery, NoticeSaveRequest, NoticeVO } from '@pivotos/types';
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue';
import type { IDomEditor } from '@wangeditor/editor';
import {
  createNotice,
  deleteNotice,
  getNotice,
  publishNotice,
  revokeNotice,
  updateNotice,
} from '@/api/system/notice';
import { useTablePage } from '@/hooks';

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<NoticeVO, NoticeQuery>({
  url: '/system/notice/page',
  query: { title: '', noticeType: '', status: '' },
});

const TYPE_OPTIONS: YFormOption[] = [
  { label: '通知', value: 1 },
  { label: '公告', value: 2 },
];

const STATUS_OPTIONS: YFormOption[] = [
  { label: '草稿', value: 0 },
  { label: '已发布', value: 1 },
  { label: '已撤回', value: 2 },
];

const STATUS_TAG: Record<number, { label: string; type: 'info' | 'success' | 'warning' }> = {
  0: { label: '草稿', type: 'info' },
  1: { label: '已发布', type: 'success' },
  2: { label: '已撤回', type: 'warning' },
};

const searchSchemas: YFormSchema[] = [
  { field: 'title', label: '标题', component: 'input', placeholder: '按标题模糊查询' },
  {
    field: 'noticeType',
    label: '类型',
    component: 'select',
    placeholder: '全部',
    options: TYPE_OPTIONS,
  },
  {
    field: 'status',
    label: '状态',
    component: 'select',
    placeholder: '全部',
    options: STATUS_OPTIONS,
  },
];

const columns: YTableColumn<NoticeVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'title', label: '标题', minWidth: 200 },
  { prop: 'noticeType', label: '类型', width: 90, align: 'center', slot: 'noticeType' },
  { prop: 'status', label: '状态', width: 100, align: 'center', slot: 'status' },
  { prop: 'publishTime', label: '发布时间', width: 170 },
  { prop: 'updateTime', label: '更新时间', width: 170 },
];

// ---------- 新增 / 编辑（富文本用 wangeditor 简洁模式） ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);
const contentHtml = ref('');

const editorRef = shallowRef<IDomEditor>();
const toolbarConfig = { excludeKeys: ['group-video', 'fullScreen'] };
const editorConfig = { placeholder: '请输入公告内容…', MENU_CONF: {} };

function handleEditorCreated(editor: IDomEditor): void {
  editorRef.value = editor;
}

onBeforeUnmount(() => {
  editorRef.value?.destroy();
});

const formSchemas: YFormSchema[] = [
  {
    field: 'title',
    label: '标题',
    component: 'input',
    placeholder: '请输入公告标题',
    rules: [{ required: true, message: '公告标题不能为空', trigger: 'blur' }],
  },
  {
    field: 'noticeType',
    label: '类型',
    component: 'radio',
    options: TYPE_OPTIONS,
    rules: [{ required: true, message: '公告类型不能为空', trigger: 'change' }],
  },
  { field: 'content', label: '内容', component: 'slot' },
  { field: 'remark', label: '备注', component: 'textarea' },
];

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { noticeType: 1 });
  contentHtml.value = '';
  dialogVisible.value = true;
}

async function openEdit(row: NoticeVO): Promise<void> {
  const detail = await getNotice(row.id);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { ...detail });
  contentHtml.value = detail.content ?? '';
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: NoticeSaveRequest = {
      id: formModel.id as string | undefined,
      title: formModel.title as string,
      noticeType: formModel.noticeType as number,
      content: contentHtml.value,
      remark: formModel.remark as string | undefined,
    };
    if (isEdit.value) {
      await updateNotice(body);
    } else {
      await createNotice(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功（草稿）');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

// ---------- 发布 / 撤回 / 删除 ----------
async function handlePublish(row: NoticeVO): Promise<void> {
  await ElMessageBox.confirm(`确定发布「${row.title}」吗？`, '提示', { type: 'warning' });
  await publishNotice(row.id);
  ElMessage.success('发布成功');
  await load();
}

async function handleRevoke(row: NoticeVO): Promise<void> {
  await ElMessageBox.confirm(`确定撤回「${row.title}」吗？`, '提示', { type: 'warning' });
  await revokeNotice(row.id);
  ElMessage.success('撤回成功');
  await load();
}

async function handleDelete(row: NoticeVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除「${row.title}」吗？`, '提示', { type: 'warning' });
  await deleteNotice(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="notice-page__bar">
      <ElButton v-hasPermi="'system:notice:add'" type="primary" :icon="Plus" @click="openAdd">
        新增公告
      </ElButton>
    </div>

    <YSearchForm v-model="params" :schemas="searchSchemas" @search="search" @reset="reset" />

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
      <template #noticeType="{ row }">
        <ElTag :type="(row as NoticeVO).noticeType === 1 ? 'primary' : 'warning'" disable-transitions>
          {{ (row as NoticeVO).noticeType === 1 ? '通知' : '公告' }}
        </ElTag>
      </template>
      <template #status="{ row }">
        <ElTag :type="STATUS_TAG[(row as NoticeVO).status]?.type ?? 'info'" disable-transitions>
          {{ STATUS_TAG[(row as NoticeVO).status]?.label ?? (row as NoticeVO).status }}
        </ElTag>
      </template>
      <ElTableColumn label="操作" width="210" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="(row as NoticeVO).status !== 1"
            v-hasPermi="'system:notice:edit'"
            link
            type="primary"
            @click="openEdit(row as NoticeVO)"
          >
            编辑
          </ElButton>
          <ElButton
            v-if="(row as NoticeVO).status !== 1"
            v-hasPermi="'system:notice:publish'"
            link
            type="success"
            @click="handlePublish(row as NoticeVO)"
          >
            发布
          </ElButton>
          <ElButton
            v-if="(row as NoticeVO).status === 1"
            v-hasPermi="'system:notice:publish'"
            link
            type="warning"
            @click="handleRevoke(row as NoticeVO)"
          >
            撤回
          </ElButton>
          <ElButton
            v-hasPermi="'system:notice:remove'"
            link
            type="danger"
            @click="handleDelete(row as NoticeVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑公告' : '新增公告'"
      width="760px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="80px">
        <template #content>
          <div class="notice-editor">
            <Toolbar
              class="notice-editor__toolbar"
              :editor="editorRef"
              :default-config="toolbarConfig"
              mode="simple"
            />
            <Editor
              v-model="contentHtml"
              class="notice-editor__body"
              :default-config="editorConfig"
              mode="simple"
              @on-created="handleEditorCreated"
            />
          </div>
        </template>
      </YForm>
    </YDialog>
  </div>
</template>

<style scoped>
.notice-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.notice-editor {
  width: 100%;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.notice-editor__toolbar {
  border-bottom: 1px solid var(--el-border-color);
}

.notice-editor__body {
  height: 260px !important;
  overflow-y: hidden;
}
</style>
