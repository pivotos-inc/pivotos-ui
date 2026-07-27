<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElIcon, ElMessage, ElMessageBox, ElTableColumn } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { YDialog, YForm, YSearchForm, YTable } from '@pivotos/ui';
import type { YFormOption, YFormSchema, YTableColumn } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import type { MenuQuery, MenuSaveRequest, MenuVO } from '@pivotos/types';
import { createMenu, deleteMenu, getMenu, treeMenus, updateMenu } from '@/api/system/menu';
import { useDict } from '@/hooks';
import { menuIcon } from '@/layout/icons';

const { sys_common_status, sys_show_hide } = useDict('sys_common_status', 'sys_show_hide');

// ---------- 树形列表（不分页） ----------
const loading = ref(false);
const tree = ref<MenuVO[]>([]);
const query = reactive<MenuQuery>({ menuName: '', status: '' });

async function load(): Promise<void> {
  loading.value = true;
  try {
    tree.value = await treeMenus(query);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function reset(): void {
  query.menuName = '';
  query.status = '';
  void load();
}

const statusOptions = computed<YFormOption[]>(() =>
  sys_common_status.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);
const visibleOptions = computed<YFormOption[]>(() =>
  sys_show_hide.value.map((d) => ({ label: d.dictLabel, value: Number(d.dictValue) })),
);

const searchSchemas = computed<YFormSchema[]>(() => [
  { field: 'menuName', label: '菜单名称', component: 'input', placeholder: '按名称模糊查询' },
  { field: 'status', label: '状态', component: 'select', placeholder: '全部', options: statusOptions.value },
]);

const MENU_TYPE_OPTIONS: YFormOption[] = [
  { label: '目录', value: 'M' },
  { label: '菜单', value: 'C' },
  { label: '按钮', value: 'F' },
];

const columns: YTableColumn<MenuVO>[] = [
  { prop: 'menuName', label: '菜单名称', minWidth: 180 },
  { prop: 'icon', label: '图标', width: 70, align: 'center', slot: 'icon' },
  { prop: 'menuType', label: '类型', width: 80, align: 'center', slot: 'menuType' },
  { prop: 'perms', label: '权限标识', minWidth: 160 },
  { prop: 'path', label: '路由地址', minWidth: 110 },
  { prop: 'component', label: '组件路径', minWidth: 150 },
  { prop: 'sort', label: '排序', width: 70, align: 'center' },
  { prop: 'visible', label: '可见', width: 80, align: 'center', slot: 'visible' },
  { prop: 'status', label: '状态', width: 80, align: 'center', slot: 'status' },
];

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<InstanceType<typeof YForm>>();
const formModel = reactive<Record<string, unknown>>({});
const isEdit = computed(() => !!formModel.id);
const menuType = computed(() => (formModel.menuType as 'M' | 'C' | 'F') ?? 'M');

/** 上级菜单选项：根目录 + 拍平的 M/C 节点（按钮不可作父级） */
const parentOptions = computed<YFormOption[]>(() => {
  const result: YFormOption[] = [{ label: '根目录', value: '0' }];
  const walk = (nodes: MenuVO[], depth: number): void => {
    nodes.forEach((n) => {
      if (n.menuType === 'F') return;
      // 编辑时不可选自己作父级
      if (n.id !== formModel.id) {
        result.push({ label: `${'　'.repeat(depth)}${n.menuName}`, value: n.id });
      }
      if (n.children) walk(n.children, depth + 1);
    });
  };
  walk(tree.value, 0);
  return result;
});

const formSchemas = computed<YFormSchema[]>(() => {
  const base: YFormSchema[] = [
    {
      field: 'parentId',
      label: '上级菜单',
      component: 'select',
      options: parentOptions.value,
      rules: [{ required: true, message: '上级菜单必选', trigger: 'change' }],
    },
    {
      field: 'menuName',
      label: '菜单名称',
      component: 'input',
      placeholder: '请输入菜单名称',
      rules: [{ required: true, message: '菜单名称不能为空', trigger: 'blur' }],
    },
    { field: 'menuType', label: '类型', component: 'radio', options: MENU_TYPE_OPTIONS },
  ];
  if (menuType.value !== 'F') {
    base.push(
      { field: 'path', label: '路由地址', component: 'input', placeholder: '目录以 / 开头，菜单为相对路径' },
      { field: 'icon', label: '图标', component: 'input', placeholder: '如 setting / user / dict' },
    );
  }
  if (menuType.value === 'C') {
    base.push({
      field: 'component',
      label: '组件路径',
      component: 'input',
      placeholder: '如 system/user/index',
    });
  }
  if (menuType.value !== 'M') {
    base.push({ field: 'perms', label: '权限标识', component: 'input', placeholder: '如 system:user:list' });
  }
  base.push(
    { field: 'sort', label: '显示顺序', component: 'number', props: { min: 0 } },
    { field: 'visible', label: '是否可见', component: 'radio', options: visibleOptions.value },
    { field: 'status', label: '状态', component: 'radio', options: statusOptions.value },
  );
  return base;
});

function openAdd(parent?: MenuVO): void {
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    parentId: parent?.id ?? '0',
    menuType: 'C',
    sort: 0,
    visible: 0,
    status: 0,
  });
  dialogVisible.value = true;
}

async function openEdit(row: MenuVO): Promise<void> {
  const detail = await getMenu(row.id);
  Object.keys(formModel).forEach((k) => delete formModel[k]);
  Object.assign(formModel, {
    id: detail.id,
    parentId: detail.parentId,
    menuName: detail.menuName,
    menuType: detail.menuType,
    path: detail.path,
    component: detail.component,
    perms: detail.perms,
    icon: detail.icon,
    sort: detail.sort ?? 0,
    visible: detail.visible ?? 0,
    status: detail.status ?? 0,
  });
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate()?.catch(() => false);
  if (!valid) return;
  confirmLoading.value = true;
  try {
    const body: MenuSaveRequest = {
      id: formModel.id as string | undefined,
      parentId: formModel.parentId as string,
      menuName: formModel.menuName as string,
      menuType: formModel.menuType as 'M' | 'C' | 'F',
      path: formModel.path as string | undefined,
      component: formModel.component as string | undefined,
      perms: formModel.perms as string | undefined,
      icon: formModel.icon as string | undefined,
      sort: formModel.sort as number | undefined,
      visible: formModel.visible as number | undefined,
      status: formModel.status as number | undefined,
    };
    if (isEdit.value) {
      await updateMenu(body);
    } else {
      await createMenu(body);
    }
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功（重新登录后动态路由生效）');
    dialogVisible.value = false;
    await load();
  } finally {
    confirmLoading.value = false;
  }
}

async function handleDelete(row: MenuVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除菜单「${row.menuName}」吗？`, '提示', { type: 'warning' });
  await deleteMenu(row.id);
  ElMessage.success('删除成功');
  await load();
}
</script>

<template>
  <div class="page-card">
    <div class="menu-page__bar">
      <ElButton v-hasPermi="'system:menu:add'" type="primary" :icon="Plus" @click="openAdd()">
        新增菜单
      </ElButton>
    </div>

    <YSearchForm v-model="query" :schemas="searchSchemas" @search="load" @reset="reset" />

    <YTable
      :loading="loading"
      :data="tree"
      :columns="columns"
      hide-pagination
      default-expand-all
      row-key="id"
      @refresh="load"
    >
      <template #icon="{ row }">
        <ElIcon v-if="(row as MenuVO).icon"><component :is="menuIcon((row as MenuVO).icon)" /></ElIcon>
        <span v-else>-</span>
      </template>
      <template #menuType="{ row }">
        <ElTag
          :type="(row as MenuVO).menuType === 'M' ? 'warning' : (row as MenuVO).menuType === 'C' ? 'primary' : 'info'"
        >
          {{ (row as MenuVO).menuType === 'M' ? '目录' : (row as MenuVO).menuType === 'C' ? '菜单' : '按钮' }}
        </ElTag>
      </template>
      <template #visible="{ row }">
        <DictTag :value="(row as MenuVO).visible" :options="sys_show_hide" />
      </template>
      <template #status="{ row }">
        <DictTag :value="(row as MenuVO).status" :options="sys_common_status" />
      </template>
      <ElTableColumn label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="(row as MenuVO).menuType !== 'F'"
            v-hasPermi="'system:menu:add'"
            link
            type="primary"
            @click="openAdd(row as MenuVO)"
          >
            新增
          </ElButton>
          <ElButton v-hasPermi="'system:menu:edit'" link type="primary" @click="openEdit(row as MenuVO)">
            编辑
          </ElButton>
          <ElButton
            v-hasPermi="'system:menu:remove'"
            link
            type="danger"
            @click="handleDelete(row as MenuVO)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </YTable>

    <YDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑菜单' : '新增菜单'"
      width="560px"
      :confirm-loading="confirmLoading"
      @confirm="handleSubmit"
    >
      <YForm ref="formRef" v-model="formModel" :schemas="formSchemas" label-width="90px" />
    </YDialog>
  </div>
</template>

<style scoped>
.menu-page__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
