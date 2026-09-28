<script setup lang="ts">
defineOptions({ name: 'TenantWizardDialog' });
import { computed, reactive, ref, watch } from 'vue';
import { ElButton, ElMessage, ElStep, ElSteps } from 'element-plus';
import { YDialog, YForm } from '@pivotos/ui';
import type { YFormOption, YFormSchema } from '@pivotos/ui';
import type { RoleVO, TenantInitRequest, TenantPackageVO } from '@pivotos/types';
import { initTenant } from '@/api/system/tenant';
import { listAllRoles } from '@/api/system/role';

const props = defineProps<{
  modelValue: boolean;
  /** 可选套餐（正常状态） */
  packages: TenantPackageVO[];
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const active = ref(0);
const confirmLoading = ref(false);
const step1Ref = ref<InstanceType<typeof YForm>>();
const step2Ref = ref<InstanceType<typeof YForm>>();
const step3Ref = ref<InstanceType<typeof YForm>>();
const roleOptions = ref<YFormOption[]>([]);

const model = reactive<Record<string, unknown>>({});

const packageOptions = computed<YFormOption[]>(() =>
  props.packages.map((p) => ({
    label: `${p.packageName}（${p.menuIds?.length ? `${p.menuIds.length} 项菜单` : '不限菜单'}）`,
    value: p.id,
  })),
);

const step1Schemas = computed<YFormSchema[]>(() => [
  {
    field: 'tenantCode',
    label: '租户编码',
    component: 'input',
    placeholder: '如 acme（全局唯一）',
    rules: [
      { required: true, message: '租户编码不能为空', trigger: 'blur' },
      { max: 64, message: '租户编码长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  {
    field: 'tenantName',
    label: '租户名称',
    component: 'input',
    placeholder: '请输入租户名称',
    rules: [
      { required: true, message: '租户名称不能为空', trigger: 'blur' },
      { max: 64, message: '租户名称长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  {
    field: 'accountLimit',
    label: '账号数上限',
    component: 'number',
    placeholder: '0 = 不限',
    props: { min: 0, style: { width: '100%' } },
  },
  {
    field: 'expireTime',
    label: '过期时间',
    component: 'date',
    placeholder: '留空 = 永不过期',
    props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', style: { width: '100%' } },
  },
  { field: 'remark', label: '备注', component: 'textarea', props: { maxlength: 500 } },
]);

const step2Schemas = computed<YFormSchema[]>(() => [
  {
    field: 'packageId',
    label: '租户套餐',
    component: 'select',
    placeholder: '请选择套餐',
    options: packageOptions.value,
    emptyOption: false,
    rules: [{ required: true, message: '请选择套餐', trigger: 'change' }],
  },
]);

const step3Schemas = computed<YFormSchema[]>(() => [
  {
    field: 'adminUsername',
    label: '管理员账号',
    component: 'input',
    placeholder: '登录用户名（全局唯一）',
    rules: [
      { required: true, message: '管理员账号不能为空', trigger: 'blur' },
      { max: 64, message: '管理员账号长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  {
    field: 'adminNickname',
    label: '管理员昵称',
    component: 'input',
    placeholder: '请输入昵称',
    rules: [
      { required: true, message: '管理员昵称不能为空', trigger: 'blur' },
      { max: 64, message: '管理员昵称长度不能超过64个字符', trigger: 'blur' },
    ],
  },
  {
    field: 'adminPassword',
    label: '初始密码',
    component: 'input',
    placeholder: '留空使用系统初始密码',
    props: { type: 'password', showPassword: true },
  },
  {
    field: 'adminRoleIds',
    label: '分配角色',
    component: 'select',
    placeholder: '平台既有角色，可多选（可空）',
    options: roleOptions.value,
    props: { multiple: true, collapseTags: true },
  },
]);

async function validateCurrent(): Promise<boolean> {
  const refMap = [step1Ref, step2Ref, step3Ref];
  const current = refMap[active.value]?.value;
  return (await current?.validate()?.catch(() => false)) ?? false;
}

async function next(): Promise<void> {
  if (!(await validateCurrent())) return;
  active.value += 1;
}

function prev(): void {
  active.value -= 1;
}

async function finish(): Promise<void> {
  if (!(await validateCurrent())) return;
  confirmLoading.value = true;
  try {
    const body: TenantInitRequest = {
      tenantCode: model.tenantCode as string,
      tenantName: model.tenantName as string,
      packageId: model.packageId as string,
      accountLimit: (model.accountLimit as number) ?? 0,
      expireTime: (model.expireTime as string) || undefined,
      remark: (model.remark as string) || undefined,
      adminUsername: model.adminUsername as string,
      adminNickname: model.adminNickname as string,
      adminPassword: (model.adminPassword as string) || undefined,
      adminRoleIds: (model.adminRoleIds as string[]) ?? [],
    };
    await initTenant(body);
    ElMessage.success('租户初始化成功');
    visible.value = false;
    emit('success');
  } finally {
    confirmLoading.value = false;
  }
}

watch(visible, async (v) => {
  if (!v) return;
  active.value = 0;
  Object.keys(model).forEach((k) => delete model[k]);
  Object.assign(model, { accountLimit: 0, adminRoleIds: [] });
  if (!roleOptions.value.length) {
    const roles: RoleVO[] = (await listAllRoles()) ?? [];
    roleOptions.value = roles.map((r) => ({ label: r.roleName, value: r.id }));
  }
});
</script>

<template>
  <YDialog v-model="visible" title="租户初始化向导" width="560px" :show-footer="false">
    <ElSteps :active="active" align-center finish-status="success" class="tenant-wizard__steps">
      <ElStep title="建租户" />
      <ElStep title="配套餐" />
      <ElStep title="建管理员" />
    </ElSteps>

    <YForm v-show="active === 0" ref="step1Ref" v-model="model" :schemas="step1Schemas" label-width="100px" />
    <YForm v-show="active === 1" ref="step2Ref" v-model="model" :schemas="step2Schemas" label-width="100px" />
    <YForm v-show="active === 2" ref="step3Ref" v-model="model" :schemas="step3Schemas" label-width="100px" />

    <div class="tenant-wizard__footer">
      <ElButton v-if="active > 0" @click="prev">上一步</ElButton>
      <ElButton v-if="active < 2" type="primary" @click="next">下一步</ElButton>
      <ElButton v-else type="primary" :loading="confirmLoading" @click="finish">完成初始化</ElButton>
    </div>
  </YDialog>
</template>

<style scoped>
.tenant-wizard__steps {
  margin-bottom: 24px;
}

.tenant-wizard__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
