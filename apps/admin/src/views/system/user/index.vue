<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DeptTree, DictTag } from '@pivotos/components';
import type { DeptTreeNode } from '@pivotos/components';
import type { DeptVO, RoleVO, UserQuery, UserSaveRequest, UserVO } from '@pivotos/types';
import { treeDepts } from '@/api/system/dept';
import { listAllRoles } from '@/api/system/role';
import {
  createUser,
  deleteUser,
  getUser,
  resetUserPassword,
  updateUser,
} from '@/api/system/user';
import { useDict, useTablePage } from '@/hooks';

const { sys_common_status, sys_user_gender } = useDict('sys_common_status', 'sys_user_gender');

// ---------- 左侧部门树 ----------
const deptLoading = ref(false);
const deptTree = ref<DeptTreeNode[]>([]);
const deptNameMap = new Map<string, string>();

function toTreeNode(dept: DeptVO): DeptTreeNode {
  deptNameMap.set(dept.id, dept.deptName);
  return { id: dept.id, name: dept.deptName, children: dept.children?.map(toTreeNode) };
}

async function loadDeptTree(): Promise<void> {
  deptLoading.value = true;
  try {
    deptNameMap.clear();
    deptTree.value = (await treeDepts()).map(toTreeNode);
  } finally {
    deptLoading.value = false;
  }
}

onMounted(loadDeptTree);

// ---------- 列表（分页 + 查询） ----------
const { loading, rows, total, params, load, search, reset } = useTablePage<UserVO, UserQuery>({
  url: '/system/user/page',
  query: { username: '', nickname: '', mobile: '', status: '' },
});

function handleDeptClick(node: DeptTreeNode): void {
  params.deptId = params.deptId === node.id ? undefined : node.id;
  void search();
}

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);
const genderOptions = computed<YFormOption[]>(() =>
  sys_user_gender.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'username', label: '用户名', component: 'input', placeholder: '按用户名模糊查询' },
  { field: 'nickname', label: '昵称', component: 'input', placeholder: '按昵称模糊查询' },
  { field: 'mobile', label: '手机号', component: 'input', placeholder: '按手机号模糊查询' },
  {
    field: 'status',
    label: '状态',
    component: 'select',
    placeholder: '全部',
    options: statusOptions.value,
  },
]);

const columns: YTableColumn<UserVO>[] = [
  { type: 'index', label: '#', width: 56, align: 'center' },
  { prop: 'username', label: '用户名', minWidth: 120 },
  { prop: 'nickname', label: '昵称', minWidth: 120 },
  {
    prop: 'deptId',
    label: '部门',
    minWidth: 140,
    formatter: (row) => (row.deptId ? (deptNameMap.get(row.deptId) ?? '-') : '-'),
  },
  { prop: 'mobile', label: '手机号', width: 130 },
  { prop: 'status', label: '状态', width: 90, align: 'center', slot: 'status' },
  { prop: 'createTime', label: '创建时间', width: 170 },
];

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);

const roleOptions = ref<YFormOption[]>([]);
onMounted(async () => {
  const roles: RoleVO[] = await listAllRoles();
  roleOptions.value = roles.map((r) => ({ label: r.roleName, value: r.id }));
});

/** 部门下拉选项（树拍平 + 缩进） */
const deptOptions = computed<YFormOption[]>(() => {
  const result: YFormOption[] = [];
  const walk = (nodes: DeptTreeNode[], depth: number): void => {
    nodes.forEach((n) => {
      result.push({ label: `${'　'.repeat(depth)}${n.name}`, value: n.id });
      if (n.children) walk(n.children, depth + 1);
    });
  };
  walk(deptTree.value, 0);
  return result;
});

const formSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'username',
    label: '用户名',
    component: 'input',
    placeholder: '请输入用户名',
    props: { disabled: isEdit.value },
    rules: [{ required: true, message: '用户名不能为空', trigger: 'blur' }],
  },
  {
    field: 'nickname',
    label: '昵称',
    component: 'input',
    placeholder: '请输入昵称',
    rules: [{ required: true, message: '昵称不能为空', trigger: 'blur' }],
  },
  ...(isEdit.value
    ? []
    : [
        {
          field: 'password',
          label: '初始密码',
          component: 'input',
          placeholder: '请输入初始密码',
          props: { type: 'password', showPassword: true },
          rules: [{ required: true, message: '初始密码不能为空', trigger: 'blur' }],
        } satisfies YFormSchema,
      ]),
  {
    field: 'deptId',
    label: '部门',
    component: 'select',
    placeholder: '请选择部门',
    options: deptOptions.value,
  },
  { field: 'email', label: '邮箱', component: 'input', placeholder: '请输入邮箱' },
  { field: 'mobile', label: '手机号', component: 'input', placeholder: '请输入手机号' },
  { field: 'gender', label: '性别', component: 'radio', options: genderOptions.value },
  { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
  {
    field: 'roleIds',
    label: '角色',
    component: 'select',
    placeholder: '请选择角色',
    options: roleOptions.value,
    props: { multiple: true },
  },
  { field: 'remark', label: '备注', component: 'textarea' },
]);

function openAdd(): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, { status: 0, gender: 0, roleIds: [] });
  dialogVisible.value = true;
}

async function openEdit(row: UserVO): Promise<void> {
  const detail = await getUser(row.id);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    id: detail.id,
    username: detail.username,
    nickname: detail.nickname,
    deptId: detail.deptId,
    email: detail.email,
    mobile: detail.mobile,
    gender: detail.gender ?? 0,
    status: detail.status ?? 0,
    remark: detail.remark,
    roleIds: [],
  });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: UserSaveRequest = {
      id: formModel.id as string | undefined,
      username: formModel.username as string,
      nickname: formModel.nickname as string,
      password: formModel.password as string | undefined,
      deptId: formModel.deptId as string | undefined,
      email: formModel.email as string | undefined,
      mobile: formModel.mobile as string | undefined,
      gender: formModel.gender as number | undefined,
      status: formModel.status as number | undefined,
      remark: formModel.remark as string | undefined,
      roleIds: (formModel.roleIds as string[] | undefined) ?? [],
    };
    if (isEdit.value) {
      await updateUser(body);
    } else {
      await createUser(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

// ---------- 删除 / 重置密码 ----------
async function handleDelete(row: UserVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除用户「${row.nickname}」吗？`, '提示', { type: 'warning' });
  await deleteUser(row.id);
  ElMessage.success('删除成功');
  await load();
}

const resetVisible = ref(false);
const resetLoading = ref(false);
const resetTarget = ref<UserVO>();
const resetModel = reactive({ password: '' });

function openResetPwd(row: UserVO): void {
  resetTarget.value = row;
  resetModel.password = '';
  resetVisible.value = true;
}

async function handleResetPwd(): Promise<void> {
  if (!resetModel.password) {
    ElMessage.warning('请输入新密码');
    return;
  }
  resetLoading.value = true;
  try {
    await resetUserPassword({ userId: resetTarget.value!.id, password: resetModel.password });
    ElMessage.success('密码已重置');
    resetVisible.value = false;
  } finally {
    resetLoading.value = false;
  }
}
</script>

<template>
  <div class="user-page">
    <div class="page-card user-page__dept">
      <DeptTree :data="deptTree" :loading="deptLoading" @node-click="handleDeptClick" />
    </div>

    <div class="page-card user-page__main">
      <div class="user-page__bar">
        <ElButton v-hasPermi="'system:user:add'" type="primary" :icon="Plus" @click="openAdd">
          新增用户
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
          <DictTag :value="(row as UserVO).status" :options="sys_common_status" />
        </template>
        <ElTableColumn label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <ElButton
              v-hasPermi="'system:user:edit'"
              link
              type="primary"
              @click="openEdit(row as UserVO)"
            >
              编辑
            </ElButton>
            <ElButton
              v-hasPermi="'system:user:resetPwd'"
              link
              type="warning"
              @click="openResetPwd(row as UserVO)"
            >
              重置密码
            </ElButton>
            <ElButton
              v-hasPermi="'system:user:remove'"
              link
              type="danger"
              @click="handleDelete(row as UserVO)"
            >
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </YTable>

      <YDialog
        v-model="dialogVisible"
        :title="isEdit ? '编辑用户' : '新增用户'"
        width="560px"
        :confirm-loading="confirmLoading"
        @confirm="handleSubmit"
      >
        <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="90px" />
      </YDialog>

      <YDialog
        v-model="resetVisible"
        :title="`重置密码 - ${resetTarget?.nickname ?? ''}`"
        width="420px"
        :confirm-loading="resetLoading"
        @confirm="handleResetPwd"
      >
        <YForm
          v-model="resetModel"
          :schemas="[
            {
              field: 'password',
              label: '新密码',
              component: 'input',
              placeholder: '请输入新密码',
              props: { type: 'password', showPassword: true },
              rules: [{ required: true, message: '新密码不能为空', trigger: 'blur' }],
            },
          ]"
          label-width="80px"
        />
      </YDialog>
    </div>
  </div>
</template>

<style scoped>
.user-page {
  display: flex;
  gap: var(--y-content-padding);
  align-items: flex-start;
}

.user-page__dept {
  width: 240px;
  flex-shrink: 0;
}

.user-page__main {
  flex: 1;
  min-width: 0;
}

.user-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
