<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElForm, ElFormItem, ElInput } from 'element-plus';
import type { FormInstance, FormItemRule } from 'element-plus';
import { Lock, User } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({
  username: 'admin',
  password: '',
});

const rules: Record<string, FormItemRule[]> = {
  username: [{ required: true, message: () => t('login.usernameRequired'), trigger: 'blur' }],
  password: [{ required: true, message: () => t('login.passwordRequired'), trigger: 'blur' }],
};

async function handleLogin(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    await userStore.login(form.username.trim(), form.password);
    // 动态路由由全局守卫在跳转时装配；落点为 redirect 或首页
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch {
    // 错误提示由请求层统一弹出
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card__brand">
        <span class="login-card__logo">PivotOS</span>
        <span class="login-card__slogan">{{ t('login.slogan') }}</span>
      </div>
      <!-- 验证码：后端开关 sys.account.captchaEnabled=false（P1 接入），当前仅账密 -->
      <ElForm ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleLogin">
        <ElFormItem prop="username">
          <ElInput
            v-model="form.username"
            :prefix-icon="User"
            :placeholder="t('login.username')"
            autocomplete="username"
          />
        </ElFormItem>
        <ElFormItem prop="password">
          <ElInput
            v-model="form.password"
            type="password"
            :prefix-icon="Lock"
            :placeholder="t('login.password')"
            autocomplete="current-password"
            show-password
            @keyup.enter="handleLogin"
          />
        </ElFormItem>
        <ElButton class="login-card__submit" type="primary" :loading="loading" native-type="submit">
          {{ t('login.submit') }}
        </ElButton>
      </ElForm>
      <p class="login-card__tip">{{ t('login.tip') }}</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(1000px 500px at 20% 10%, rgba(64, 158, 255, 0.18), transparent),
    radial-gradient(800px 400px at 90% 90%, rgba(64, 158, 255, 0.12), transparent),
    var(--y-page-bg);
}

.login-card {
  width: 380px;
  padding: 36px 32px 28px;
  background: var(--y-card-bg);
  border-radius: var(--y-border-radius);
  box-shadow: var(--el-box-shadow-light);
}

.login-card__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 28px;
}

.login-card__logo {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
  letter-spacing: 1px;
}

.login-card__slogan {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.login-card__submit {
  width: 100%;
  margin-top: 4px;
}

.login-card__tip {
  margin: 16px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
