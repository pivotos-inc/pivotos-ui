<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElScrollbar,
  ElTag,
} from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { useTagsViewStore, type TagView } from '@/stores/tagsView';
import { translateMenuTitle } from '@/locales';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const tagsViewStore = useTagsViewStore();

watch(
  () => route.fullPath,
  () => tagsViewStore.addView(route),
  { immediate: true },
);

function isActive(view: TagView): boolean {
  return view.fullPath === route.fullPath;
}

function open(view: TagView): void {
  if (!isActive(view)) void router.push(view.fullPath);
}

/** 关闭标签：若关闭的是当前页，跳到最后一个剩余标签 */
function close(view: TagView): void {
  const remaining = tagsViewStore.delView(view.fullPath);
  if (isActive(view)) {
    const last = remaining[remaining.length - 1];
    void router.push(last ? last.fullPath : '/');
  }
}

/**
 * 批量关闭后兜底跳转：目标页可能被保留但当前激活页被关掉，
 * 此时统一跳到目标页（closeAll 跳到剩余最后一个）。
 */
function ensureActive(target?: TagView): void {
  const stillOpen = tagsViewStore.visitedViews.some((v) => v.fullPath === route.fullPath);
  if (stillOpen) return;
  const fallback =
    target ?? tagsViewStore.visitedViews[tagsViewStore.visitedViews.length - 1];
  void router.push(fallback ? fallback.fullPath : '/');
}

function closeOthers(view: TagView): void {
  tagsViewStore.delOthers(view.fullPath);
  ensureActive(view);
}

function closeLeft(view: TagView): void {
  tagsViewStore.delLeftViews(view.fullPath);
  ensureActive(view);
}

function closeRight(view: TagView): void {
  tagsViewStore.delRightViews(view.fullPath);
  ensureActive(view);
}

function closeAll(): void {
  tagsViewStore.delAll();
  ensureActive();
}

/** 刷新页面：剔除 keep-alive 缓存 + 变更组件 key，强制重挂载（全量刷新，重置页面状态） */
async function refresh(view: TagView): Promise<void> {
  tagsViewStore.excludeCachedName(view.name);
  tagsViewStore.bumpRefreshKey(view.fullPath);
  await nextTick();
  tagsViewStore.includeCachedName(view.name);
}

// ---------- 右键菜单 ----------
const menuRef = ref<HTMLElement>();

const menu = reactive({
  visible: false,
  left: 0,
  top: 0,
  view: null as TagView | null,
});

function openMenu(event: MouseEvent, view: TagView): void {
  // 阻止事件继续冒泡到 window：window 上的 contextmenu 关菜单监听器
  // 会在菜单已打开时把同一次右键（或其后续派发）误判为"右键别处"而立即收起菜单
  event.stopPropagation();
  menu.visible = true;
  menu.view = view;
  // 菜单从光标处向下展开，但不能盖住标签栏本身：
  // 否则再次右键相邻标签会点到浮在上层的菜单上
  const bar = (event.currentTarget as HTMLElement | null)?.closest('.tags-view');
  const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
  menu.left = event.clientX;
  menu.top = Math.max(event.clientY, barBottom + 2);
  void nextTick(() => {
    const el = menuRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (event.clientX + rect.width > window.innerWidth) {
      menu.left = Math.max(0, window.innerWidth - rect.width - 8);
    }
    if (event.clientY + rect.height > window.innerHeight) {
      menu.top = Math.max(0, window.innerHeight - rect.height - 8);
    }
  });
}

function closeMenu(): void {
  menu.visible = false;
}

/** 右键标签本身不关闭菜单（交给 openMenu 换目标），右键其余区域才收起 */
function onWindowContextmenu(event: Event): void {
  if ((event.target as HTMLElement | null)?.closest?.('.tags-view__tag')) return;
  closeMenu();
}

watch(
  () => menu.visible,
  (visible) => {
    if (visible) {
      window.addEventListener('click', closeMenu);
      window.addEventListener('contextmenu', onWindowContextmenu);
      window.addEventListener('scroll', closeMenu, true);
      window.addEventListener('resize', closeMenu);
    } else {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', onWindowContextmenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    }
  },
);
// 切换路由时收起菜单
watch(() => route.fullPath, closeMenu);
onBeforeUnmount(() => {
  window.removeEventListener('click', closeMenu);
  window.removeEventListener('contextmenu', onWindowContextmenu);
  window.removeEventListener('scroll', closeMenu, true);
  window.removeEventListener('resize', closeMenu);
});

const menuViewIndex = computed(() =>
  menu.view ? tagsViewStore.visitedViews.findIndex((v) => v.fullPath === menu.view!.fullPath) : -1,
);

/** 菜单项禁用规则（基于右键的目标标签） */
const menuDisabled = computed(() => {
  const views = tagsViewStore.visitedViews;
  const idx = menuViewIndex.value;
  const view = menu.view;
  const closable = views.filter((v) => !v.affix);
  return {
    closeCurrent: !view || !!view.affix,
    closeOthers: idx < 0 || !closable.some((v) => v.fullPath !== view!.fullPath),
    closeLeft: idx < 0 || !views.slice(0, idx).some((v) => !v.affix),
    closeRight: idx < 0 || !views.slice(idx + 1).some((v) => !v.affix),
    closeAll: closable.length === 0,
    moveFirst: idx <= 0,
    moveLast: idx < 0 || idx === views.length - 1,
  };
});

interface MenuItem {
  key: string;
  label: string;
  disabled?: boolean;
  divided?: boolean;
  onClick: (view: TagView) => void;
}

const menuItems = computed<MenuItem[]>(() => {
  const d = menuDisabled.value;
  return [
    { key: 'refresh', label: t('layout.refresh'), onClick: (v) => void refresh(v) },
    {
      key: 'closeCurrent',
      label: t('layout.closeCurrent'),
      disabled: d.closeCurrent,
      divided: true,
      onClick: close,
    },
    { key: 'closeOthers', label: t('layout.closeOthers'), disabled: d.closeOthers, onClick: closeOthers },
    { key: 'closeLeft', label: t('layout.closeLeft'), disabled: d.closeLeft, onClick: closeLeft },
    { key: 'closeRight', label: t('layout.closeRight'), disabled: d.closeRight, onClick: closeRight },
    { key: 'closeAll', label: t('layout.closeAll'), disabled: d.closeAll, divided: true, onClick: closeAll },
    {
      key: 'moveFirst',
      label: t('layout.moveToFirst'),
      disabled: d.moveFirst,
      onClick: (v) => tagsViewStore.moveViewTo(v.fullPath, 'first'),
    },
    {
      key: 'moveLast',
      label: t('layout.moveToLast'),
      disabled: d.moveLast,
      onClick: (v) => tagsViewStore.moveViewTo(v.fullPath, 'last'),
    },
    {
      key: 'affix',
      label: menu.view?.affix ? t('layout.unaffix') : t('layout.affix'),
      divided: true,
      onClick: (v) => tagsViewStore.toggleAffix(v.fullPath),
    },
  ];
});

function onMenuItemClick(item: MenuItem): void {
  if (item.disabled || !menu.view) return;
  closeMenu();
  item.onClick(menu.view);
}

// ---------- 拖拽排序 ----------
const dragState = reactive({ from: '', over: '' });

function onDragStart(event: DragEvent, view: TagView): void {
  dragState.from = view.fullPath;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', view.fullPath);
  }
}

function onDragOver(event: DragEvent, view: TagView): void {
  // preventDefault 才允许 drop
  event.preventDefault();
  if (!dragState.from || dragState.from === view.fullPath) return;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dragState.over = view.fullPath;
}

function onDrop(event: DragEvent, view: TagView): void {
  event.preventDefault();
  if (dragState.from && dragState.from !== view.fullPath) {
    tagsViewStore.moveView(dragState.from, view.fullPath);
  }
  onDragEnd();
}

function onDragEnd(): void {
  dragState.from = '';
  dragState.over = '';
}

/** 当前路由对应的标签（右上角下拉用） */
const currentView = computed<TagView>(() => ({
  fullPath: route.fullPath,
  path: route.path,
  title: String(route.meta?.title ?? ''),
  name: route.name ? String(route.name) : undefined,
  affix: !!route.meta?.affix,
}));
</script>

<template>
  <div class="tags-view">
    <ElScrollbar class="tags-view__scroll">
      <div class="tags-view__list">
        <ElTag
          v-for="view in tagsViewStore.visitedViews"
          :key="view.fullPath"
          :effect="isActive(view) ? 'dark' : 'plain'"
          :closable="!view.affix"
          class="tags-view__tag"
          :class="{
            'is-dragging': dragState.from === view.fullPath,
            'is-drag-over': dragState.over === view.fullPath && dragState.from !== view.fullPath,
          }"
          draggable="true"
          @click="open(view)"
          @close="close(view)"
          @contextmenu.prevent="openMenu($event, view)"
          @mousedown.middle.prevent="close(view)"
          @dragstart="onDragStart($event, view)"
          @dragover="onDragOver($event, view)"
          @drop="onDrop($event, view)"
          @dragend="onDragEnd"
        >
          {{ translateMenuTitle(view.title) }}
        </ElTag>
      </div>
    </ElScrollbar>

    <ElDropdown trigger="click" class="tags-view__actions">
      <ElIcon class="tags-view__actions-icon"><ArrowDown /></ElIcon>
      <template #dropdown>
        <ElDropdownMenu>
          <ElDropdownItem @click="refresh(currentView)">{{ t('layout.refresh') }}</ElDropdownItem>
          <ElDropdownItem divided @click="closeOthers(currentView)">
            {{ t('layout.closeOthers') }}
          </ElDropdownItem>
          <ElDropdownItem @click="closeLeft(currentView)">{{ t('layout.closeLeft') }}</ElDropdownItem>
          <ElDropdownItem @click="closeRight(currentView)">{{ t('layout.closeRight') }}</ElDropdownItem>
          <ElDropdownItem divided @click="closeAll">{{ t('layout.closeAll') }}</ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>

    <Teleport to="body">
      <ul
        v-show="menu.visible"
        ref="menuRef"
        class="tags-view__context-menu"
        :style="{ left: `${menu.left}px`, top: `${menu.top}px` }"
        @contextmenu.prevent
      >
        <li
          v-for="item in menuItems"
          :key="item.key"
          class="tags-view__context-menu-item"
          :class="{ 'is-disabled': item.disabled, 'is-divided': item.divided }"
          @click="onMenuItemClick(item)"
        >
          {{ item.label }}
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.tags-view {
  height: 40px;
  display: flex;
  align-items: center;
  background: var(--y-card-bg);
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 0 var(--y-content-padding);
}

.tags-view__scroll {
  flex: 1;
}

.tags-view__list {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.tags-view__tag {
  cursor: pointer;
}

/* 拖拽中的标签半透明，落点目标左侧高亮指示 */
.tags-view__tag.is-dragging {
  opacity: 0.4;
  cursor: move;
}

.tags-view__tag.is-drag-over {
  box-shadow: inset 2px 0 0 var(--el-color-primary);
}

.tags-view__actions {
  margin-left: 8px;
}

.tags-view__actions-icon {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

/* 右键菜单（Teleport 到 body，fixed 定位） */
.tags-view__context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 140px;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: var(--el-box-shadow-light);
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.tags-view__context-menu-item {
  padding: 6px 16px;
  cursor: pointer;
  line-height: 1.4;
}

.tags-view__context-menu-item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.tags-view__context-menu-item.is-disabled {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
}

.tags-view__context-menu-item.is-disabled:hover {
  background: transparent;
  color: var(--el-text-color-disabled);
}

.tags-view__context-menu-item.is-divided {
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 4px;
  padding-top: 10px;
}
</style>
