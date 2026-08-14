<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

/**
 * AI 回答 markdown 渲染（S45）：
 * - markdown-it 关闭 html（原始 HTML 一律转义，不进入输出）；
 * - 渲染结果再过 DOMPurify 白名单消毒，双保险防 XSS 后 v-html；
 * - 纯渲染组件，输入变化即重算，天然兼容 SSE 增量追加（增量的是字符串，非 DOM diff）。
 *
 * S69 正文引用联动：[1][2] 标注渲染为可交互上标（点击定位引用面板 / 悬浮预览），
 * 事件经根节点委托向上 emit，由宿主 chat 页结合 references 数据联动。
 */
const props = defineProps<{ content: string }>();

const emit = defineEmits<{
  /** 点击引用标注 [n]（n 从 1 起，对应 references[n-1]） */
  (e: 'cite-click', index: number): void;
  /** 悬浮引用标注：携带标注元素位置，供宿主定位预览卡 */
  (e: 'cite-hover', index: number, rect: { x: number; y: number }): void;
  /** 移出引用标注 */
  (e: 'cite-leave'): void;
}>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

/** 渲染 + 消毒：ALLOWED_ATTR 收紧 href target，防 target=_blank 钓鱼；data-cite 供引用联动定位 */
const html = computed(() => {
  // html:false 会转义原始 HTML，故引用标注必须在 md.render 之后注入；
  // 按「标签 / 文本」分段替换，标签段原样跳过，避免误改 href 等属性内的 [n]
  const rendered = md.render(props.content);
  const withCites = rendered.replace(/<[^>]*>|\[(\d+)\](?!\()/g, (match, citeNum?: string) =>
    match.startsWith('<') || citeNum === undefined
      ? match
      : `<sup class="md-cite" data-cite="${citeNum}">[${citeNum}]</sup>`,
  );
  return DOMPurify.sanitize(withCites, {
    ADD_ATTR: ['target', 'rel', 'data-cite'],
  });
});

/** 事件委托：从命中元素提取引用序号与位置后 emit（v-html 内部节点无法直接绑事件） */
function citeTarget(el: EventTarget | null): { index: number; rect: { x: number; y: number } } | null {
  if (!(el instanceof HTMLElement)) return null;
  const cite = el.closest<HTMLElement>('.md-cite');
  if (!cite) return null;
  const index = Number(cite.dataset.cite);
  if (!Number.isInteger(index) || index < 1) return null;
  const box = cite.getBoundingClientRect();
  return { index, rect: { x: box.left + box.width / 2, y: box.top } };
}

function onClick(e: MouseEvent): void {
  const hit = citeTarget(e.target);
  if (hit) emit('cite-click', hit.index);
}

function onMouseOver(e: MouseEvent): void {
  const hit = citeTarget(e.target);
  if (hit) emit('cite-hover', hit.index, hit.rect);
}

function onMouseOut(e: MouseEvent): void {
  if (citeTarget(e.target)) emit('cite-leave');
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="md-view" v-html="html" @click="onClick" @mouseover="onMouseOver" @mouseout="onMouseOut" />
</template>

<style scoped>
.md-view {
  line-height: 1.6;
  word-break: break-word;
  /* 父级气泡沿用旧纯文本样式的 pre-wrap，markdown 排版需还原 */
  white-space: normal;
}

.md-view :deep(p) {
  margin: 0 0 8px;
}

.md-view :deep(p:last-child) {
  margin-bottom: 0;
}

.md-view :deep(h1),
.md-view :deep(h2),
.md-view :deep(h3),
.md-view :deep(h4) {
  margin: 12px 0 8px;
  line-height: 1.4;
}

.md-view :deep(h1) {
  font-size: 18px;
}

.md-view :deep(h2) {
  font-size: 16px;
}

.md-view :deep(h3),
.md-view :deep(h4) {
  font-size: 15px;
}

.md-view :deep(ul),
.md-view :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 22px;
}

.md-view :deep(li) {
  margin: 2px 0;
}

.md-view :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--el-fill-color);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
}

.md-view :deep(pre) {
  margin: 8px 0;
  padding: 12px;
  border-radius: 8px;
  background: #282c34;
  overflow-x: auto;
}

.md-view :deep(pre code) {
  padding: 0;
  background: transparent;
  color: #e5e7eb;
  font-size: 13px;
  line-height: 1.5;
}

.md-view :deep(table) {
  margin: 8px 0;
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

.md-view :deep(th),
.md-view :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: left;
}

.md-view :deep(th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.md-view :deep(blockquote) {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
}

.md-view :deep(a) {
  color: var(--el-color-primary);
}

.md-view :deep(hr) {
  margin: 12px 0;
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* ---------- 正文引用标注（S69：可点击定位引用面板，悬浮出预览卡） ---------- */
.md-view :deep(.md-cite) {
  padding: 0 3px;
  border-radius: 4px;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.md-view :deep(.md-cite:hover) {
  background: var(--el-color-primary-light-9);
}
</style>
