import { defineStore } from 'pinia';

const LOCALE_KEY = 'pivotos-locale';

function readLocale(): 'zh-CN' | 'en' {
  try {
    return localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

interface AppState {
  /** 侧边栏折叠 */
  sidebarCollapsed: boolean;
  /** 界面语言（与 vue-i18n locale 同步，见 App 初始化） */
  locale: 'zh-CN' | 'en';
}

/** 应用级 UI 状态 store（侧边栏 / 语言） */
export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    sidebarCollapsed: false,
    locale: readLocale(),
  }),
  actions: {
    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    setLocale(locale: 'zh-CN' | 'en'): void {
      this.locale = locale;
      try {
        localStorage.setItem(LOCALE_KEY, locale);
      } catch {
        // 忽略持久化失败
      }
    },
  },
});
