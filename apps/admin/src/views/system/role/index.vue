<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn, ElTree } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import type { DeptVO, MenuVO, RoleQuery, RoleSaveRequest, RoleVO } from '@pivotos/types';
import { treeMenus } from '@/api/system/menu';
import { treeDepts } from '@/api/system/dept';
import {
  createRole,
  deleteRole,
  getRole,
  listRoleMenuIds,
  updateRole,
} from '@/api/system/role';
import { useDict, useTablePage } from '@/hooks';

const { sys_common_status } = useDict('sys_common_status');

/** 数据范围选项 */
const dataScopeOptions: YFormOption[] = [
  { label: '全部数据权限', value: 1 },
  { label: '本部门', value: 2 },
  { label: '本部门及以下', value: 3 },
  { label: '仅本人', value: 4 },
  { label: '自定义部门', value: 5 },
];

// ---------- 列表 ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<RoleVO, RoleQuery>({
  url: '/system/role/page',
  query: { roleName: '', roleCode: '', status: '' },
});

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'roleName', label: '角色名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'roleCode', label: '角色编码', component: 'input', placeholder: '按编码模糊查询' },
  { field: 'status', label: '状态', component: 'select', placeholder: '全部', options: statusOptions.value },
]);

const columns: YTableColumn<RoleVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'roleName', label: '角色名称', minWidth: 140 },
  { prop: 'roleCode', label: '角色编码', minWidth: 140 },
  { prop: 'sort', label: '排序', width: 80, align: 'center' },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'status' },
  { prop: 'remark', label: '备注', minWidth: 160 },
  { prop: 'createTime', label: '创建时间', width: 170 },
];

// ---------- 菜单授权树 ----------
interface MenuTreeNode {
  id: string;
  label: string;
  children?: MenuTreeNode[];
}

const menuTree = ref<MenuTreeNode[]>([]);
const menuTreeRef = ref<InstanceType<typeof ElTree>>();

/** 部门树（自定义数据范围） */
const deptTreeData = ref<MenuTreeNode[]>([]);
const deptTreeRef = ref<InstanceType<typeof ElTree>>();

function toMenuNode(menu: MenuVO): MenuTreeNode {
  return {
    id: menu.id,
    label: menu.menuName,
    children: menu.children?.map(toMenuNode),
  };
}

function toDeptNode(dept: DeptVO): MenuTreeNode {
  return {
    id: dept.id,
    label: dept.deptName,
    children: dept.children?.map(toDeptNode),
  };
}

onMounted(async () => {
  menuTree.value = (await treeMenus()).map(toMenuNode);
  deptTreeData.value = (await treeDepts({ status: 0 })).map(toDeptNode);
});

/** 叶子节点 ID 集合（回显时只 set 叶子，父级由半选态自动推导） */
function leafIds(nodes: MenuTreeNode[], into = new Set<string>()): Set<string> {
  nodes.forEach((n) => {
    if (n.children?.length) {
      leafIds(n.children, into);
    } else {
      into.add(n.id);
    }
  });
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
    field: 'roleName',
    label: '角色名称',
    component: 'input',
    placeholder: '请输入角色名称',
    rules: [{ required: true, message: '角色名称不能为空', trigger: 'blur' }],
  },
  {
    field: 'roleCode',
    label: '角色编码',
    component: 'input',
    placeholder: '如 common_admin',
    props: { disabled: isEdit.value },
    rules: [{ required: true, message: '角色编码不能为空', trigger: 'blur' }],
  },
  { field: 'sort', label: '显示顺序', component: 'number', props: { min: 0 } },
  { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { status: 0, sort: 0, dataScope: 1 });
  dialogVisible.value = true;
  window.setTimeout(() => deptTreeRef.value?.setCheckedKeys([]));
}

async function openEdit(row: RoleVO): Promise<void> {
  const [detail, menuIds] = await Promise.all([getRole(row.id), listRoleMenuIds(row.id)]);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    id: detail.id,
    roleName: detail.roleName,
    roleCode: detail.roleCode,
    sort: detail.sort ?? 0,
    status: detail.status ?? 0,
    dataScope: detail.dataScope ?? 1,
    customDeptIds: detail.customDeptIds ?? '',
    remark: detail.remark,
  });
  dialogVisible.value = true;
  // 等弹窗渲染后回显勾选（只 set 叶子，避免父级联动成全选）
  const leaves = leafIds(menuTree.value);
  const checked = menuIds.filter((id) => leaves.has(String(id)));
  window.setTimeout(() => menuTreeRef.value?.setCheckedKeys(checked));
  // 回显自定义部门勾选
  if (detail.customDeptIds) {
    const deptIds = detail.customDeptIds.split(',').filter(Boolean);
    window.setTimeout(() => deptTreeRef.value?.setCheckedKeys(deptIds));
  } else {
    window.setTimeout(() => deptTreeRef.value?.setCheckedKeys([]));
  }
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const checked = (menuTreeRef.value?.getCheckedKeys() ?? []).map(String);
    const half = (menuTreeRef.value?.getHalfCheckedKeys() ?? []).map(String);
    // 自定义部门：叶子节点 + 半选父节点
    const deptChecked = (deptTreeRef.value?.getCheckedKeys() ?? []).map(String);
    const deptHalf = (deptTreeRef.value?.getHalfCheckedKeys() ?? []).map(String);
    const allDeptIds = [...new Set([...deptHalf, ...deptChecked])].join(',');
    const body: RoleSaveRequest = {
      id: formModel.id as string | undefined,
      roleName: formModel.roleName as string,
      roleCode: formModel.roleCode as string,
      sort: formModel.sort as number | undefined,
      status: formModel.status as number | undefined,
      dataScope: (formModel.dataScope as number) ?? 1,
      customDeptIds: (formModel.dataScope as number) === 5 ? allDeptIds : undefined,
      remark: formModel.remark as string | undefined,
      menuIds: [...half, ...checked],
    };
    if (isEdit.value) {
      await updateRole(body);
    } else {
      await createRole(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

async function handleDelete(row: RoleVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除角色「${row.roleName}」吗？`, '提示', { type: 'warning' });
  await deleteRole(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="role-page__bar">
      <ElButton v-hasPermi="'system:role:add'" type="primary" :icon="Plus" @click="openAdd">
        新增角色
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
      <template #status="{ row }">
        <DictTag :value="(row as RoleVO).status" :options="sys_common_status" />
      </template>
      <ElTableColumn label="操作" width="140" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton v-hasPermi="'system:role:edit'" link type="primary" @click="openEdit(row as RoleVO)">
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:role:remove'"
            link
            type="danger"
            @click="handleDelete(row as RoleVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑角色' : '新增角色'"
      width="560px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="90px" />
      <!-- 数据范围配置 -->
      <div class="role-page__scope">
        <div class="role-page__scope-label">数据范围</div>
        <YForm
          v-model="formModel"
          :schemas="[
            {
              field: 'dataScope',
              component: 'radio',
              options: dataScopeOptions,
              rules: [{ required: true, message: '请选择数据范围', trigger: 'change' }],
            } as YFormSchema,
          ]"
          label-width="0"
        />
      </div>
      <div v-if="formModel.dataScope === 5" class="role-page__dept-section">
        <div class="role-page__menus-label">自定义部门</div>
        <ElTree
          ref="deptTreeRef"
          :data="deptTreeData"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          show-checkbox
          default-expand-all
          class="role-page__tree"
        />
      </div>
      <div class="role-page__menus">
        <div class="role-page__menus-label">菜单权限</div>
        <ElTree
          ref="menuTreeRef"
          :data="menuTree"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          show-checkbox
          default-expand-all
          class="role-page__tree"
        />
      </div>
    </YDialog>
  </div>
</template>

<style scoped>
.role-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.role-page__scope {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.role-page__scope-label {
  width: 90px;
  text-align: right;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 32px;
  flex-shrink: 0;
}

.role-page__menus {
  display: flex;
  gap: 12px;
}

.role-page__menus-label {
  width: 90px;
  text-align: right;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 32px;
  flex-shrink: 0;
}

.role-page__dept-section {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.role-page__tree {
  flex: 1;
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--y-border-radius);
  padding: 8px;
}
</style>
