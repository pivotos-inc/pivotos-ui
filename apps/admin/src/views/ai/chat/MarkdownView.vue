<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

/**
 * AI 回答 markdown 渲染（S45）：
 * - markdown-it 关闭 html（原始 HTML 一律转义，不进入输出）；
 * - 渲染结果再过 DOMPurify 白名单消毒，双保险防 XSS 后 v-html；
 * - 纯渲染组件，输入变化即重算，天然兼容 SSE 增量追加（增量的是字符串，非 DOM diff）。
 */
const props = defineProps<{ content: string }>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

/** 渲染 + 消毒：ALLOWED_ATTR 收紧 href target，防 target=_blank 钓鱼 */
const html = computed(() =>
  DOMPurify.sanitize(md.render(props.content), {
    ADD_ATTR: ['target', 'rel'],
  }),
);
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="md-view" v-html="html" />
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
</style>
