import { createApp } from 'vue';
import { createPinia } from 'pinia';
import {
  registerPermSource,
  registerTokenGetter,
  registerUnauthorizedHandler,
  setupPermissionDirectives,
} from '@pivotos/core';
import { initTheme } from '@pivotos/ui';
import '@pivotos/ui/styles';
import 'uno.css';
import App from './App.vue';
import router from './router';
import { resetSession, setupGuard } from './router/guard';
import i18n from './locales';
import { useAppStore } from './stores/app';
import { useUserStore } from './stores/user';
import './styles/index.css';

// 主题初始化需在挂载前完成，避免暗色闪烁
initTheme();

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// 用户会话与 @pivotos/core 打通：Token 读取 / 权限数据源 / 401 处理
const userStore = useUserStore(pinia);
registerTokenGetter(() => userStore.token);
registerPermSource({
  perms: () => userStore.perms,
  roles: () => userStore.roles,
});
registerUnauthorizedHandler(() => {
  resetSession();
  // 避免在登录页重复跳转
  if (router.currentRoute.value.path !== '/login') {
    void router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } });
  }
});

// 界面语言持久化 → vue-i18n
const appStore = useAppStore(pinia);
i18n.global.locale.value = appStore.locale;

setupGuard(router);
setupPermissionDirectives(app);
app.use(router);
app.use(i18n);
app.mount('#app');
