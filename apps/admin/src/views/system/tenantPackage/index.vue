<script setup lang="ts">
defineOptions({ name: 'SystemTenantPackage' });
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn, ElTree } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import type { MenuVO, TenantPackageQuery, TenantPackageSaveRequest, TenantPackageVO } from '@pivotos/types';
import {
  createTenantPackage,
  deleteTenantPackage,
  getTenantPackage,
  listTenantPackages,
  updateTenantPackage,
} from '@/api/system/tenantPackage';
import { treeMenus } from '@/api/system/menu';
import { useDict } from '@/hooks';

const { sys_common_status } = useDict('sys_common_status');

// ---------- 列表 ----------
const loading = ref(false);
const rows = ref<TenantPackageVO[]>([]);
const params = reactive<TenantPackageQuery>({ packageName: '', status: '' });

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = (await listTenantPackages(params)) ?? [];
  } finally {
    loading.value = false;
  }
}

function search(): void {
  void load();
}

function reset(): void {
  params.packageName = '';
  params.status = '';
  void load();
}

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'packageName', label: '套餐名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'status', label: '状态', component: 'select', placeholder: '全部', options: statusOptions.value },
]);

const columns: YTableColumn<TenantPackageVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'packageName', label: '套餐名称', minWidth: 140 },
  { prop: 'menuIds', label: '菜单范围', minWidth: 120, slot: 'menuScope' },
  { prop: 'tenantCount', label: '绑定租户数', width: 100, align: 'center' },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'status' },
  { prop: 'remark', label: '备注', minWidth: 140 },
  { prop: 'createTime', label: '创建时间', width: 170 },
];

// ---------- 菜单范围树 ----------
interface MenuTreeNode {
  id: string;
  label: string;
  children?: MenuTreeNode[];
}

const menuTree = ref<MenuTreeNode[]>([]);
const menuTreeRef = ref<InstanceType<typeof ElTree>>();

function toMenuNode(menu: MenuVO): MenuTreeNode {
  return { id: menu.id, label: menu.menuName, children: menu.children?.map(toMenuNode) };
}

function leafIds(nodes: MenuTreeNode[], into = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (n.children?.length) leafIds(n.children, into);
    else into.add(String(n.id));
  }
  return into;
}

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);

const formSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'packageName',
    label: '套餐名称',
    component: 'input',
    placeholder: '请输入套餐名称',
    rules: [
      { required: true, message: '套餐名称不能为空', trigger: 'blur' },
      { max: 64, message: '套餐名称长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
  { field: 'remark', label: '备注', component: 'textarea', props: { maxlength: 500 } },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { status: 0 });
  dialogVisible.value = true;
  window.setTimeout(() => menuTreeRef.value?.setCheckedKeys([]));
}

async function openEdit(row: TenantPackageVO): Promise<void> {
  const detail = await getTenantPackage(String(row.id));
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    id: detail.id,
    packageName: detail.packageName,
    status: detail.status ?? 0,
    remark: detail.remark,
  });
  dialogVisible.value = true;
  // 等弹窗渲染后回显勾选（只 set 叶子，避免父级联动成全选）
  const leaves = leafIds(menuTree.value);
  const checked = (detail.menuIds ?? []).map(String).filter((id) => leaves.has(id));
  window.setTimeout(() => menuTreeRef.value?.setCheckedKeys(checked));
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const checked = (menuTreeRef.value?.getCheckedKeys() ?? []).map(String);
    const half = (menuTreeRef.value?.getHalfCheckedKeys() ?? []).map(String);
    const menuIds = [...new Set([...half, ...checked])];
    const body: TenantPackageSaveRequest = {
      id: formModel.id as string | undefined,
      packageName: formModel.packageName as string,
      // 空数组语义 = 不限制（后端存 NULL）
      menuIds,
      status: formModel.status as number | undefined,
      remark: formModel.remark as string | undefined,
    };
    if (isEdit.value) {
      await updateTenantPackage(body);
    } else {
      await createTenantPackage(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

// ---------- 删除 ----------
async function handleDelete(row: TenantPackageVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除套餐「${row.packageName}」吗？`, '提示', { type: 'warning' });
  await deleteTenantPackage(String(row.id));
  ElMessage.success('删除成功');
  await load();
}

onMounted(async () => {
  void load();
  menuTree.value = (await treeMenus()).map(toMenuNode);
});
</script>

<template>
  <div class="page-card tenant-package-page">
    <YSearchForm v-model="params" :schemas="searchSchemas" @search="search" @reset="reset" />

    <div class="tenant-package-page__bar">
      <ElButton v-hasPermi="'system:tenant-package:add'" type="primary" :icon="Plus" @click="openAdd">
        新增套餐
      </ElButton>
    </div>

    <YTable :loading="loading" :data="rows" :columns="columns" row-key="id" hide-pagination @refresh="load">
      <template #menuScope="{ row }">
        <span v-if="!(row as TenantPackageVO).menuIds?.length">不限制</span>
        <span v-else>{{ (row as TenantPackageVO).menuIds!.length }} 项菜单</span>
      </template>
      <template #status="{ row }">
        <DictTag :value="(row as TenantPackageVO).status" :options="sys_common_status" />
      </template>
      <ElTableColumn label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-hasPermi="'system:tenant-package:edit'"
            link
            type="primary"
            @click="openEdit(row as TenantPackageVO)"
          >
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:tenant-package:remove'"
            link
            type="danger"
            @click="handleDelete(row as TenantPackageVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑套餐' : '新增套餐'"
      width="560px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="90px" />
      <div class="tenant-package-page__menus">
        <div class="tenant-package-page__menus-label">菜单范围（不勾选 = 不限制）</div>
        <ElTree
          ref="menuTreeRef"
          :data="menuTree"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          show-checkbox
          default-expand-all
          class="tenant-package-page__tree"
        />
      </div>
    </YDialog>
  </div>
</template>

<style scoped>
.tenant-package-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.tenant-package-page__menus-label {
  margin: 4px 0 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.tenant-package-page__tree {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 8px;
}
</style>
