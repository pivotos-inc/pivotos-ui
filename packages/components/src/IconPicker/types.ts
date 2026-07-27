import type { Component } from 'vue';

/** 图标可选项（业务侧注入，如 apps/admin 的 MENU_ICON_OPTIONS） */
export interface IconPickerOption {
  /** 存库的图标名 */
  name: string;
  component: Component;
}
