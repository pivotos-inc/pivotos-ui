import { defineStore } from 'pinia';
import type { RouteLocationNormalized } from 'vue-router';

/** 多标签页视图项 */
export interface TagView {
  /** 全路径（含 query，作为 key） */
  fullPath: string;
  path: string;
  title: string;
  /** 路由名（keep-alive include 用） */
  name?: string;
  /** 固定页不可关闭 */
  affix?: boolean;
}

interface TagsViewState {
  visitedViews: TagView[];
}

/** 多标签页 store（布局框架 TagsView 数据源） */
export const useTagsViewStore = defineStore('tagsView', {
  state: (): TagsViewState => ({
    visitedViews: [],
  }),
  getters: {
    /** keep-alive 缓存的组件名集合 */
    cachedViews(): string[] {
      return this.visitedViews.map((v) => v.name).filter((n): n is string => !!n);
    },
  },
  actions: {
    addView(route: RouteLocationNormalized): void {
      if (!route.meta?.title || route.meta?.hidden) return;
      if (this.visitedViews.some((v) => v.fullPath === route.fullPath)) return;
      this.visitedViews.push({
        fullPath: route.fullPath,
        path: route.path,
        title: String(route.meta.title),
        name: route.name ? String(route.name) : undefined,
        affix: !!route.meta?.affix,
      });
    },
    delView(fullPath: string): TagView[] {
      this.visitedViews = this.visitedViews.filter((v) => v.fullPath !== fullPath || v.affix);
      return this.visitedViews;
    },
    delOthers(fullPath: string): TagView[] {
      this.visitedViews = this.visitedViews.filter((v) => v.fullPath === fullPath || v.affix);
      return this.visitedViews;
    },
    delAll(): TagView[] {
      this.visitedViews = this.visitedViews.filter((v) => v.affix);
      return this.visitedViews;
    },
    reset(): void {
      this.visitedViews = [];
    },
  },
});
