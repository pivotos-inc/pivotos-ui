import { createI18n } from 'vue-i18n';
import zhCN from './lang/zh-CN';
import en from './lang/en';

/**
 * 界面语言包。
 * - locale 初始值由 main.ts 按 app store 持久化值覆盖；
 * - 菜单标题多语言：后端下发中文菜单名，经 menu.* 键翻译（见 translateMenuTitle）。
 */
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
  },
});

/**
 * 菜单标题翻译：menu.{后端菜单名} 命中则译，否则原样返回。
 * 新增菜单时如需多语言，在两个语言包的 menu 节点各补一条同名键即可。
 */
export function translateMenuTitle(title?: string): string {
  if (!title) return '';
  const key = `menu.${title}`;
  return i18n.global.te(key) ? i18n.global.t(key) : title;
}

export default i18n;
