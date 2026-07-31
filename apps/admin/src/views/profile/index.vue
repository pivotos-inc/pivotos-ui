<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElAvatar, ElButton, ElDescriptions, ElDescriptionsItem, ElMessage, ElTag } from 'element-plus';
import { Lock, User } from '@element-plus/icons-vue';
import { YDialog, YForm } from '@pivotos/ui';
import type { YFormSchema } from '@pivotos/ui';
import { DictTag } from '@pivotos/components';
import { resetUserPassword } from '@/api/system/user';
import { useDict } from '@/hooks';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const { sys_user_gender } = useDict('sys_user_gender');

const info = computed(() => userStore.info);

// ---------- 修改密码 ----------
// 说明：后端专用"修改本人密码（校验原密码）"接口为 P1 项（对接 web Starter 接口加密）。
// 当前复用 PUT /system/user/reset-password（需 system:user:resetPwd 权限，超管可用）。
const pwdVisible = ref(false);
const pwdLoading = ref(false);
const pwdFormRef = ref<InstanceType<typeof YForm>>();
const pwdModel = reactive<Record<string, unknown>>({ password: '', confirm: '' });

const pwdSchemas = computed<YFormSchema[]>(() => [
  {
    field: 'password',
    label: '新密码',
    component: 'input',
    placeholder: '请输入新密码',
    props: { type: 'password', showPassword: true },
    rules: [
      { required: true, message: '新密码不能为空', trigger: 'blur' },
      { min: 6, message: '密码长度不少于 6 位', trigger: 'blur' },
    ],
  },
  {
    field: 'confirm',
    label: '确认密码',
    component: 'input',
    placeholder: '请再次输入新密码',
    props: { type: 'password', showPassword: true },
    rules: [
      { required: true, message: '请再次输入新密码', trigger: 'blur' },
      {
        validator: (_rule, value, callback) => {
          if (value !== pwdModel.password) {
            callback(new Error('两次输入的密码不一致'));
          } else {
            callback();
          }
        },
        trigger: 'blur',
      },
    ],
  },
]);

function openPwdDialog(): void {
  pwdModel.password = '';
  pwdModel.confirm = '';
  pwdVisible.value = true;
}

async function handlePwdSubmit(): Promise<void> {
  const valid = await pwdFormRef.value?.validate()?.catch(() => false);
  if (!valid || !info.value) return;
  pwdLoading.value = true;
  try {
    await resetUserPassword({ userId: info.value.id, password: pwdModel.password as string });
    ElMessage.success('密码修改成功');
    pwdVisible.value = false;
  } finally {
    pwdLoading.value = false;
  }
}
</script>

<template>
  <div class="profile-page">
    <div class="page-card profile-page__card">
      <div class="profile-page__head">
        <ElAvatar :size="72" :src="userStore.avatar" :icon="User" />
        <div class="profile-page__identity">
          <h2 class="profile-page__nickname">{{ info?.nickname }}</h2>
          <div class="profile-page__roles">
            <ElTag v-for="role in userStore.roles" :key="role" size="small" effect="plain">
              {{ role }}
            </ElTag>
          </div>
        </div>
        <ElButton :icon="Lock" @click="openPwdDialog">修改密码</ElButton>
      </div>

      <ElDescriptions :column="2" border class="profile-page__desc">
        <ElDescriptionsItem label="用户名">{{ info?.username }}</ElDescriptionsItem>
        <ElDescriptionsItem label="邮箱">{{ info?.email || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="手机号">{{ info?.mobile || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="性别">
          <DictTag :value="info?.gender" :options="sys_user_gender" />
        </ElDescriptionsItem>
        <ElDescriptionsItem label="创建时间">{{ info?.createTime || '-' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="备注">{{ info?.remark || '-' }}</ElDescriptionsItem>
      </ElDescriptions>

      <p class="profile-page__tip">
        资料编辑与头像上传待后端个人中心接口（P1）开放后接入。
      </p>
    </div>

    <YDialog
      v-model="pwdVisible"
      title="修改密码"
      width="420px"
      :confirm-loading="pwdLoading"
      @confirm="handlePwdSubmit"
    >
      <YForm ref="pwdFormRef" v-model="pwdModel" :schemas="pwdSchemas" label-width="90px" />
    </YDialog>
  </div>
</template>

<style scoped>
.profile-page__card {
  max-width: 860px;
}

.profile-page__head {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.profile-page__identity {
  flex: 1;
}

.profile-page__nickname {
  margin: 0 0 8px;
  font-size: 20px;
}

.profile-page__roles {
  display: flex;
  gap: 6px;
}

.profile-page__tip {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
