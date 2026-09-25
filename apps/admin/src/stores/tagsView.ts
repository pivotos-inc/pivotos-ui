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
  /**
   * 刷新标签页时临时剔除的 keep-alive 缓存名：
   * 从 include 移除再恢复，强制组件重挂载（全量刷新，重置页面状态）。
   */
  excludedCachedNames: string[];
  /**
   * 每个标签的刷新计数：并入 AppMain 的组件 key。
   * 激活中的标签仅靠剔除缓存不会重挂载（keep-alive 只管失活缓存），
   * 必须同时变更 key 强制重建；已失活的标签由缓存剔除负责。
   */
  refreshKeys: Record<string, number>;
}

/** 标签页布局持久化键（localStorage） */
const STORAGE_KEY = 'pivotos-tags-view';

/** 启动时恢复上次标签布局：逐条校验形状，坏数据整体丢弃 */
function loadPersisted(): TagView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (v): v is TagView =>
        !!v &&
        typeof (v as TagView).fullPath === 'string' &&
        typeof (v as TagView).title === 'string',
    );
  } catch {
    return [];
  }
}

/** 标签布局变化后落盘（增删 / 排序 / 固定切换都会触发） */
export function persistTagsView(views: TagView[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // 隐私模式 / 存储已满等写入失败场景静默降级为不持久化
  }
}

/** 多标签页 store（布局框架 TagsView 数据源） */
export const useTagsViewStore = defineStore('tagsView', {
  state: (): TagsViewState => ({
    visitedViews: loadPersisted(),
    excludedCachedNames: [],
    refreshKeys: {},
  }),
  getters: {
    /** keep-alive 缓存的组件名集合 */
    cachedViews(): string[] {
      return this.visitedViews
        .map((v) => v.name)
        .filter((n): n is string => !!n && !this.excludedCachedNames.includes(n));
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
    /** 关闭左侧标签（固定页保留） */
    delLeftViews(fullPath: string): TagView[] {
      const idx = this.visitedViews.findIndex((v) => v.fullPath === fullPath);
      if (idx < 0) return this.visitedViews;
      this.visitedViews = this.visitedViews.filter((v, i) => i >= idx || v.affix);
      return this.visitedViews;
    },
    /** 关闭右侧标签（固定页保留） */
    delRightViews(fullPath: string): TagView[] {
      const idx = this.visitedViews.findIndex((v) => v.fullPath === fullPath);
      if (idx < 0) return this.visitedViews;
      this.visitedViews = this.visitedViews.filter((v, i) => i <= idx || v.affix);
      return this.visitedViews;
    },
    delAll(): TagView[] {
      this.visitedViews = this.visitedViews.filter((v) => v.affix);
      return this.visitedViews;
    },
    /** 移动标签到最左 / 最右 */
    moveViewTo(fullPath: string, position: 'first' | 'last'): void {
      const idx = this.visitedViews.findIndex((v) => v.fullPath === fullPath);
      if (idx < 0) return;
      const [view] = this.visitedViews.splice(idx, 1);
      if (position === 'first') this.visitedViews.unshift(view);
      else this.visitedViews.push(view);
    },
    /** 拖拽排序：把 from 标签插入到 to 标签的位置（其左侧） */
    moveView(fromFullPath: string, toFullPath: string): void {
      const from = this.visitedViews.findIndex((v) => v.fullPath === fromFullPath);
      if (from < 0 || fromFullPath === toFullPath) return;
      const [view] = this.visitedViews.splice(from, 1);
      const to = this.visitedViews.findIndex((v) => v.fullPath === toFullPath);
      if (to < 0) {
        this.visitedViews.push(view);
        return;
      }
      this.visitedViews.splice(to, 0, view);
    },
    /** 固定 / 取消固定标签页 */
    toggleAffix(fullPath: string): void {
      const view = this.visitedViews.find((v) => v.fullPath === fullPath);
      if (view) view.affix = !view.affix;
    },
    /** 刷新前剔除缓存，触发 keep-alive 重挂载 */
    excludeCachedName(name?: string): void {
      if (name && !this.excludedCachedNames.includes(name)) this.excludedCachedNames.push(name);
    },
    /** 恢复缓存名，重挂载完成后重新纳入 keep-alive */
    includeCachedName(name?: string): void {
      if (!name) return;
      this.excludedCachedNames = this.excludedCachedNames.filter((n) => n !== name);
    },
    /** 刷新计数 +1：变更 AppMain 组件 key，强制激活中的标签重挂载 */
    bumpRefreshKey(fullPath: string): void {
      this.refreshKeys[fullPath] = (this.refreshKeys[fullPath] ?? 0) + 1;
    },
    reset(): void {
      this.visitedViews = [];
      this.excludedCachedNames = [];
      this.refreshKeys = {};
      // 登出 / 401 时同步清掉持久化的标签布局，避免串到下一个登录用户
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // 同上：静默降级
      }
    },
  },
});
