import type { Component } from 'vue';
import {
  Avatar,
  Collection,
  Edit,
  Grid,
  Menu as MenuIcon,
  OfficeBuilding,
  Setting,
  Suitcase,
  Tools,
  User,
  UserFilled,
} from '@element-plus/icons-vue';

/**
 * 菜单图标映射：后端 sys_menu.icon 存若依风格图标名（如 setting / tree-table），
 * 前端统一映射到 @element-plus/icons-vue 组件，未登记的用 Menu 兜底。
 */
const ICON_MAP: Record<string, Component> = {
  setting: Setting,
  user: User,
  peoples: UserFilled,
  'tree-table': Grid,
  tree: OfficeBuilding,
  dict: Collection,
  tool: Suitcase,
  tools: Tools,
  edit: Edit,
  avatar: Avatar,
};

export function menuIcon(name?: string): Component {
  return (name && ICON_MAP[name]) || MenuIcon;
}
