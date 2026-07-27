import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerPermSource } from '@pivotos/core';
import { initTheme } from '@pivotos/ui';
import '@pivotos/ui/styles';
import 'uno.css';
import App from './App.vue';
import router from './router';
import i18n from './locales';
import { useUserStore } from './stores/user';
import './styles/index.css';

// 主题初始化需在挂载前完成，避免暗色闪烁
initTheme();

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// 权限数据源：打通 @pivotos/core 的 hasPermi / v-hasPermi 与用户 store
const userStore = useUserStore(pinia);
registerPermSource({
  perms: () => userStore.perms,
  roles: () => userStore.roles,
});

app.use(router);
app.use(i18n);
app.mount('#app');
