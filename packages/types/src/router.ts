/** 动态路由元信息 */
export interface RouterMeta {
  title: string;
  icon?: string;
}

/** 动态路由（对齐 RouterVO，由菜单树 M/C 节点构建） */
export interface RouterVO {
  name: string;
  path: string;
  /** 组件路径，目录为 Layout */
  component: string;
  hidden?: boolean;
  meta: RouterMeta;
  children?: RouterVO[];
}
