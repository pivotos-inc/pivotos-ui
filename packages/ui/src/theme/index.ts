import { ref } from 'vue';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pivotos-theme';

const mode = ref<ThemeMode>('light');

function applyTheme(next: ThemeMode): void {
  mode.value = next;
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 隐私模式等场景下 localStorage 不可用，忽略持久化失败
  }
}

/** 应用启动时调用：读取持久化主题，缺省跟随系统 */
export function initTheme(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  const initial: ThemeMode =
    saved === 'dark' || saved === 'light'
      ? saved
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  applyTheme(initial);
}

/** 暗色模式开关（布局框架的暗色切换按钮使用） */
export function useDarkMode() {
  function toggle(): void {
    applyTheme(mode.value === 'dark' ? 'light' : 'dark');
  }
  function set(value: ThemeMode): void {
    applyTheme(value);
  }
  return { mode, toggle, set };
}
