/**
 * @wangeditor/editor-for-vue 的 package.json exports 未声明 types，
 * vue-tsc 按 exports 解析不到包内置 d.ts，这里全局声明兜底（S26）。
 * 注意：本文件必须保持非模块（无顶层 import/export），否则 declare module
 * 会退化为 augmentation 而不生效。
 */
declare module '@wangeditor/editor-for-vue' {
  export const Editor: import('vue').DefineComponent<Record<string, unknown>>;
  export const Toolbar: import('vue').DefineComponent<Record<string, unknown>>;
}
