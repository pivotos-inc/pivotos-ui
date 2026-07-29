/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

/** 路由元信息（动态路由/标签页/守卫共用） */
declare module 'vue-router' {
  interface RouteMeta {
    /** 菜单/页签标题（后端下发为菜单名，可经 menu.* 语言包翻译） */
    title?: string;
    /** 菜单图标（若依风格图标名，经 layout/icons 映射到 EP 图标） */
    icon?: string;
    /** 隐藏路由（不进侧边栏/标签页） */
    hidden?: boolean;
    /** 固定页签（不可关闭） */
    affix?: boolean;
    /** 页面级权限点（预留，后端路由已按权限过滤） */
    perms?: string;
  }
}

export {};
