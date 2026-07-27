<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  ElAvatar,
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElMessageBox,
  ElTooltip,
} from 'element-plus';
import {
  Expand,
  Fold,
  FullScreen,
  Moon,
  Sunny,
  SwitchButton,
  User,
} from '@element-plus/icons-vue';
import { useDarkMode } from '@pivotos/ui';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { resetSession } from '@/router/guard';
import Breadcrumb from './Breadcrumb.vue';

const { t, locale } = useI18n();
const router = useRouter();
const appStore = useAppStore();
const userStore = useUserStore();
const { mode, toggle } = useDarkMode();

const isFullscreen = ref(false);

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
    isFullscreen.value = false;
  } else {
    void document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  }
}

function switchLocale(lang: 'zh-CN' | 'en'): void {
  appStore.setLocale(lang);
  locale.value = lang;
}

async function handleCommand(command: string): Promise<void> {
  if (command === 'profile') {
    await router.push('/profile');
    return;
  }
  if (command === 'logout') {
    await ElMessageBox.confirm(t('layout.logoutConfirm'), t('layout.tip'), {
      type: 'warning',
    });
    await userStore.logout();
    resetSession();
    await router.replace('/login');
  }
}
</script>

<template>
  <header class="navbar">
    <div class="navbar__left">
      <ElIcon class="navbar__hamburger" @click="appStore.toggleSidebar">
        <Fold v-if="!appStore.sidebarCollapsed" />
        <Expand v-else />
      </ElIcon>
      <Breadcrumb />
    </div>

    <div class="navbar__right">
      <ElTooltip :content="t('layout.fullscreen')">
        <ElButton :icon="FullScreen" circle text @click="toggleFullscreen" />
      </ElTooltip>

      <ElTooltip :content="t('layout.darkMode')">
        <ElButton :icon="mode === 'dark' ? Sunny : Moon" circle text @click="toggle" />
      </ElTooltip>

      <ElDropdown trigger="click" @command="switchLocale">
        <ElButton circle text>
          <span class="navbar__lang">{{ appStore.locale === 'en' ? 'EN' : '中' }}</span>
        </ElButton>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="zh-CN" :disabled="appStore.locale === 'zh-CN'">
              简体中文
            </ElDropdownItem>
            <ElDropdownItem command="en" :disabled="appStore.locale === 'en'">
              English
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>

      <ElDropdown trigger="click" @command="handleCommand">
        <div class="navbar__user">
          <ElAvatar :size="28" :src="userStore.avatar" :icon="User" />
          <span class="navbar__nickname">{{ userStore.nickname }}</span>
        </div>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem command="profile" :icon="User">
              {{ t('layout.profile') }}
            </ElDropdownItem>
            <ElDropdownItem command="logout" divided :icon="SwitchButton">
              {{ t('layout.logout') }}
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  height: var(--y-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--y-content-padding);
  background: var(--y-card-bg);
  border-bottom: 1px solid var(--el-border-color-light);
}

.navbar__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.navbar__hamburger {
  cursor: pointer;
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.navbar__hamburger:hover {
  color: var(--el-color-primary);
}

.navbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.navbar__lang {
  font-size: 13px;
  font-weight: 600;
}

.navbar__user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  cursor: pointer;
}

.navbar__nickname {
  font-size: 14px;
  color: var(--el-text-color-primary);
}
</style>
