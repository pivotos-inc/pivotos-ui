import { createI18n } from 'vue-i18n';
import zhCN from './lang/zh-CN';
import en from './lang/en';

/** 界面语言包（菜单多语言接入在 S12 完成） */
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    'zh-CN': zhCN,
    en,
  },
});

export default i18n;
