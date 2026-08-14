<script setup lang="ts">
defineOptions({ name: 'AiChat' });
import { computed, nextTick, onMounted, ref } from 'vue';
import { ElButton, ElDialog, ElEmpty, ElIcon, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect } from 'element-plus';
import { ChatDotRound, Delete, EditPen, Plus, Promotion } from '@element-plus/icons-vue';
import type { AiChatMessageVO, AiChatReferenceVO, AiConversationVO, AiProviderOptionVO, KbSimpleOptionVO } from '@pivotos/types';
import { deleteConversation, listConversations, listKbOptions, listMessages, renameConversation, streamChat } from '@/api/ai/chat';
import { listDocChunks } from '@/api/ai/kb';
import { listProviderModels, listProviderOptions } from '@/api/ai/provider';
import MarkdownView from './MarkdownView.vue';

/** 本地消息（流式追加时 assistant 消息尚无落库 id） */
interface LocalMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  /** RAG 引用来源（done 事件回填） */
  references?: AiChatReferenceVO[];
  /** 查询改写后的实际检索词（meta 事件回填，仅流式当轮有值，S68） */
  rewrittenQuery?: string;
}

// ---------- 会话列表 ----------
const conversations = ref<AiConversationVO[]>([]);
/** 当前会话 id，空串 = 新会话（首条消息发出后由 meta 事件回填） */
const activeId = ref('');
const messages = ref<LocalMessage[]>([]);
const listLoading = ref(false);

async function loadConversations(): Promise<void> {
  conversations.value = await listConversations();
}

async function switchConversation(id: string): Promise<void> {
  if (streaming.value || id === activeId.value) return;
  activeId.value = id;
  listLoading.value = true;
  try {
    const rows: AiChatMessageVO[] = await listMessages(id);
    messages.value = rows.map((m) => ({
      id: m.id, role: m.role, content: m.content, references: m.references,
    }));
    scrollToBottom();
  } finally {
    listLoading.value = false;
  }
}

function newConversation(): void {
  if (streaming.value) return;
  activeId.value = '';
  messages.value = [];
}

async function handleDelete(row: AiConversationVO): Promise<void> {
  await ElMessageBox.confirm(`确定删除会话「${row.title}」吗？消息记录将一并删除。`, '提示', {
    type: 'warning',
  });
  await deleteConversation(row.id);
  ElMessage.success('会话已删除');
  if (row.id === activeId.value) newConversation();
  await loadConversations();
}

async function handleRename(row: AiConversationVO): Promise<void> {
  const { value } = await ElMessageBox.prompt('请输入新的会话标题', '重命名会话', {
    inputValue: row.title,
    inputValidator: (v: string) => {
      const title = v.trim();
      if (!title) return '会话标题不能为空';
      if (title.length > 128) return '会话标题最长 128 字符';
      return true;
    },
  });
  const title = value.trim();
  if (title === row.title) return;
  await renameConversation(row.id, title);
  row.title = title;
  ElMessage.success('会话已重命名');
}

// ---------- 供应商 / 模型选择 ----------
const providers = ref<AiProviderOptionVO[]>([]);
/** 选中供应商 id，空串 = 默认（后端：默认供应商 → 静态配置兜底） */
const providerId = ref('');
const models = ref<string[]>([]);
/** 选中模型，空串 = 供应商默认模型 */
const model = ref('');
const modelsLoading = ref(false);
/** 常用记录的响应式版本号：localStorage 写入不自知，记录后 +1 驱动 pinnedModels 重算 */
const recentVersion = ref(0);
/** 下拉展示序：原始列表 → 当前供应商最近使用置顶（computed 保证记录后即时重排，不用重选供应商） */
const pinnedModels = computed(() => {
  void recentVersion.value;
  return pinRecentModels(providerId.value, models.value);
});

async function loadProviders(): Promise<void> {
  try {
    providers.value = await listProviderOptions();
  } catch {
    /* 供应商未配置不阻塞对话（走静态兜底） */
  }
}

async function handleProviderChange(id: string): Promise<void> {
  model.value = '';
  models.value = [];
  if (!id) return;
  modelsLoading.value = true;
  try {
    models.value = await listProviderModels(id);
    // 供应商默认模型在列表内则预选，否则留空走后端默认
    const fallback = providers.value.find((p) => p.id === id)?.defaultModel ?? '';
    model.value = models.value.includes(fallback) ? fallback : '';
  } catch {
    /* 5023 等错误已由请求层统一提示，下拉留空可手动重试 */
  } finally {
    modelsLoading.value = false;
  }
}

// ---------- 常用模型置顶（localStorage 按供应商各记最近 5 个，S45 ④口径 A） ----------
const RECENT_MODELS_KEY = 'ai-chat-recent-models';
const RECENT_MODELS_MAX = 5;

type RecentModelsMap = Record<string, string[]>;

function loadRecentModels(): RecentModelsMap {
  try {
    return JSON.parse(localStorage.getItem(RECENT_MODELS_KEY) ?? '{}') as RecentModelsMap;
  } catch {
    return {};
  }
}

/** 本次对话实际使用的模型落记录（仅显式选择了供应商+模型才记，空模型=默认无置顶意义） */
function recordRecentModel(): void {
  if (!providerId.value || !model.value) return;
  const map = loadRecentModels();
  map[providerId.value] = [
    model.value,
    ...(map[providerId.value] ?? []).filter((m) => m !== model.value),
  ].slice(0, RECENT_MODELS_MAX);
  localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(map));
  recentVersion.value += 1;
}

/** 常用置顶：当前供应商最近使用的模型（按新近度）排前，其余保持原顺序 */
function pinRecentModels(providerKey: string, all: string[]): string[] {
  const recent = (loadRecentModels()[providerKey] ?? []).filter((m) => all.includes(m));
  return [...recent, ...all.filter((m) => !recent.includes(m))];
}

// ---------- 知识库选择（RAG） ----------
const kbOptions = ref<KbSimpleOptionVO[]>([]);
/** 选中的知识库 ID 列表（空 = 不使用知识库） */
const selectedKbIds = ref<string[]>([]);

async function loadKbOptions(): Promise<void> {
  try {
    kbOptions.value = await listKbOptions();
  } catch {
    /* 知识库插件未部署或接口异常，不阻塞对话 */
  }
}

// ---------- 引用原文下钻（S68：按 chunkId 定位完整分块） ----------
const chunkDialogVisible = ref(false);
const chunkDialogLoading = ref(false);
const chunkDialogMeta = ref('');
const chunkDialogContent = ref('');

async function openChunkSource(reference: AiChatReferenceVO): Promise<void> {
  if (!reference.docId || !reference.chunkId) return;
  chunkDialogVisible.value = true;
  chunkDialogLoading.value = true;
  chunkDialogContent.value = '';
  chunkDialogMeta.value = reference.fileName ?? '';
  try {
    const chunks = await listDocChunks(reference.docId);
    const hit = chunks.find((c) => c.id === reference.chunkId);
    if (hit) {
      chunkDialogContent.value = hit.content;
      chunkDialogMeta.value = `${reference.fileName ?? ''} · 第 ${hit.chunkIndex + 1} 块`;
    } else {
      chunkDialogContent.value = '未定位到对应分块（文档可能已重建索引）';
    }
  } catch {
    chunkDialogContent.value = '原文加载失败，请稍后重试';
  } finally {
    chunkDialogLoading.value = false;
  }
}

// ---------- 流式对话 ----------
const input = ref('');
const streaming = ref(false);
let abortController: AbortController | null = null;

async function handleSend(): Promise<void> {
  const content = input.value.trim();
  if (!content || streaming.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content });
  messages.value.push({ role: 'assistant', content: '' });
  // 必须从响应式数组取回代理对象再累加：直接改 push 前的原始对象不经过
  // reactive set 陷阱，delta 不触发重渲染，流结束才整段蹦出（S21 根因）
  const assistant = messages.value[messages.value.length - 1]!;
  scrollToBottom();

  streaming.value = true;
  abortController = new AbortController();
  await streamChat(
    {
      conversationId: activeId.value || undefined,
      content,
      providerId: providerId.value || undefined,
      model: model.value || undefined,
      kbIds: selectedKbIds.value.length > 0 ? selectedKbIds.value : undefined,
    },
    {
      onMeta(meta) {
        // 新会话：回填会话 id 并刷新左侧列表
        if (!activeId.value) {
          activeId.value = meta.conversationId;
          void loadConversations();
        }
        // S68：查询改写生效时透出实际检索词
        if (meta.rewrittenQuery) {
          assistant.rewrittenQuery = meta.rewrittenQuery;
        }
      },
      onDelta(delta) {
        assistant.content += delta;
        scrollToBottom();
      },
      onDone(done) {
        assistant.id = done.messageId;
        // RAG：回填引用来源
        if (done.references?.length) {
          assistant.references = done.references;
        }
        // 本次实际选用的模型计入「常用」（S45 ④）
        recordRecentModel();
        // 会话 updateTime 变化，刷新排序
        void loadConversations();
      },
      onError(msg) {
        ElMessage.error(msg);
        if (!assistant.content) {
          messages.value.splice(messages.value.indexOf(assistant), 1);
        }
      },
    },
    abortController.signal,
  );
  streaming.value = false;
  abortController = null;
}

function handleStop(): void {
  abortController?.abort();
}

/** 打字机光标：仅流式中的最后一条 assistant 消息显示（流结束 streaming=false 自动消除） */
function showCursor(msg: LocalMessage, index: number): boolean {
  return streaming.value && msg.role === 'assistant' && index === messages.value.length - 1;
}

function handleKeydown(e: Event | KeyboardEvent): void {
  // Enter 发送，Shift+Enter 换行（ElInput keydown 事件签名为 Event | KeyboardEvent）
  if (!(e instanceof KeyboardEvent)) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    void handleSend();
  }
}

// ---------- 滚动 ----------
const messageListEl = ref<HTMLElement>();

function scrollToBottom(): void {
  void nextTick(() => {
    messageListEl.value?.scrollTo({ top: messageListEl.value.scrollHeight });
  });
}

onMounted(() => {
  void loadConversations();
  void loadProviders();
  void loadKbOptions();
});
</script>

<template>
  <div class="page-card ai-chat">
    <!-- 左侧：会话列表 -->
    <aside class="ai-chat__aside">
      <ElButton class="ai-chat__new" type="primary" :icon="Plus" :disabled="streaming" @click="newConversation">
        新建会话
      </ElButton>
      <div class="ai-chat__conversations">
        <div
          v-for="item in conversations"
          :key="item.id"
          class="ai-chat__conversation"
          :class="{ 'is-active': item.id === activeId }"
          @click="switchConversation(item.id)"
        >
          <ElIcon class="ai-chat__conversation-icon"><ChatDotRound /></ElIcon>
          <span class="ai-chat__conversation-title" :title="item.title">{{ item.title }}</span>
          <ElButton
            class="ai-chat__conversation-action"
            link
            :icon="EditPen"
            @click.stop="handleRename(item)"
          />
          <ElButton
            class="ai-chat__conversation-action"
            link
            type="danger"
            :icon="Delete"
            @click.stop="handleDelete(item)"
          />
        </div>
        <div v-if="conversations.length === 0" class="ai-chat__conversations-empty">暂无会话</div>
      </div>
    </aside>

    <!-- 右侧：消息区 + 输入区 -->
    <section v-loading="listLoading" class="ai-chat__main">
      <div ref="messageListEl" class="ai-chat__messages">
        <ElEmpty v-if="messages.length === 0" description="开始新的对话吧" :image-size="120" />
        <div
          v-for="(msg, index) in messages"
          :key="msg.id ?? index"
          class="ai-chat__message"
          :class="`ai-chat__message--${msg.role}`"
        >
          <div class="ai-chat__body">
            <!-- S68：查询改写透明化提示（仅当轮流式有值） -->
            <div v-if="msg.role === 'assistant' && msg.rewrittenQuery" class="ai-chat__rewrite-hint">
              检索词已智能改写：{{ msg.rewrittenQuery }}
            </div>
            <div class="ai-chat__bubble">
              <span v-if="msg.role === 'assistant' && !msg.content && streaming" class="ai-chat__typing">
                正在思考…
              </span>
              <MarkdownView v-else-if="msg.role === 'assistant'" :content="msg.content" />
              <template v-else>{{ msg.content }}</template>
              <span v-if="showCursor(msg, index)" class="ai-chat__cursor" />
            </div>
            <!-- RAG 引用来源 -->
            <div v-if="msg.role === 'assistant' && msg.references?.length" class="ai-chat__references">
              <details>
                <summary class="ai-chat__references-summary">
                  引用来源（{{ msg.references.length }}）
                </summary>
                <div
                  v-for="(ref, refIdx) in msg.references"
                  :key="refIdx"
                  class="ai-chat__reference"
                >
                  <div class="ai-chat__reference-header">
                    <span class="ai-chat__reference-index">[{{ refIdx + 1 }}]</span>
                    <span v-if="ref.fileName" class="ai-chat__reference-file">{{ ref.fileName }}</span>
                    <span v-if="ref.kbName" class="ai-chat__reference-kb">{{ ref.kbName }}</span>
                    <span v-if="ref.score != null" class="ai-chat__reference-score">
                      相似度 {{ ref.score.toFixed(4) }}
                    </span>
                    <ElButton
                      v-if="ref.docId && ref.chunkId"
                      class="ai-chat__reference-source"
                      link
                      type="primary"
                      @click="openChunkSource(ref)"
                    >
                      查看原文
                    </ElButton>
                  </div>
                  <div class="ai-chat__reference-content">{{ ref.content }}</div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      <div class="ai-chat__input">
        <ElInput
          v-model="input"
          type="textarea"
          :rows="3"
          resize="none"
          maxlength="4000"
          placeholder="输入问题，Enter 发送，Shift+Enter 换行"
          @keydown="handleKeydown"
        />
        <div class="ai-chat__actions">
          <div class="ai-chat__selectors">
            <ElSelect
              v-model="providerId"
              class="ai-chat__selector"
              size="small"
              placeholder="默认供应商"
              clearable
              :disabled="streaming"
              @change="handleProviderChange"
            >
              <ElOption v-for="p in providers" :key="p.id" :label="p.name" :value="p.id" />
            </ElSelect>
            <ElSelect
              v-model="model"
              class="ai-chat__selector ai-chat__selector--model"
              size="small"
              placeholder="默认模型"
              clearable
              filterable
              :loading="modelsLoading"
              :disabled="streaming || !providerId"
            >
              <ElOption v-for="m in pinnedModels" :key="m" :label="m" :value="m" />
            </ElSelect>
            <ElSelect
              v-if="kbOptions.length > 0"
              v-model="selectedKbIds"
              class="ai-chat__selector ai-chat__selector--kb"
              size="small"
              placeholder="知识库（可选）"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              :disabled="streaming"
            >
              <ElOption v-for="kb in kbOptions" :key="kb.id" :label="kb.name" :value="kb.id" />
            </ElSelect>
          </div>
          <ElButton v-if="streaming" @click="handleStop">停止</ElButton>
          <ElButton type="primary" :icon="Promotion" :loading="streaming" :disabled="!input.trim()" @click="handleSend">
            发送
          </ElButton>
        </div>
      </div>
    </section>

    <!-- S68：引用原文下钻弹框（完整分块内容） -->
    <ElDialog v-model="chunkDialogVisible" title="引用原文" width="640px" destroy-on-close>
      <div v-loading="chunkDialogLoading" class="ai-chat__chunk-source">
        <div class="ai-chat__chunk-source-meta">{{ chunkDialogMeta }}</div>
        <div class="ai-chat__chunk-source-content">{{ chunkDialogContent }}</div>
      </div>
    </ElDialog>
  </div>
</template>

<style scoped>
.ai-chat {
  display: flex;
  gap: 16px;
  /* 撑满内容区：视口 - 顶栏 - 标签栏(40px) - app-main 上下 padding */
  height: calc(100vh - var(--y-header-height) - 40px - var(--y-content-padding) * 2);
  min-height: 420px;
}

/* ---------- 左侧会话列表 ---------- */
.ai-chat__aside {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 240px;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 16px;
}

.ai-chat__new {
  width: 100%;
  margin-bottom: 12px;
}

.ai-chat__conversations {
  flex: 1;
  overflow-y: auto;
}

.ai-chat__conversation {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--el-text-color-regular);
}

.ai-chat__conversation:hover {
  background: var(--el-fill-color-light);
}

.ai-chat__conversation.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.ai-chat__conversation-icon {
  flex-shrink: 0;
}

.ai-chat__conversation-title {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ai-chat__conversation-action {
  visibility: hidden;
  margin-left: 0;
}

.ai-chat__conversation:hover .ai-chat__conversation-action {
  visibility: visible;
}

.ai-chat__conversations-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

/* ---------- 右侧消息区 ---------- */
.ai-chat__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.ai-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.ai-chat__message {
  display: flex;
  margin-bottom: 16px;
}

.ai-chat__message--user {
  justify-content: flex-end;
}

.ai-chat__message--assistant {
  justify-content: flex-start;
}

/* S68：气泡+引用整体限宽，改写提示与引用随气泡同宽 */
.ai-chat__body {
  display: flex;
  flex-direction: column;
  max-width: 78%;
}

/* S68：查询改写提示（气泡上方小字） */
.ai-chat__rewrite-hint {
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ai-chat__bubble {
  max-width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  line-height: 1.6;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-chat__message--user .ai-chat__bubble {
  background: var(--el-color-primary);
  color: #fff;
  border-bottom-right-radius: 2px;
}

.ai-chat__message--assistant .ai-chat__bubble {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  border-bottom-left-radius: 2px;
}

.ai-chat__typing {
  color: var(--el-text-color-secondary);
}

/* 打字机光标：流式中闪烁，流结束随 streaming=false 移除 */
.ai-chat__cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background: var(--el-color-primary);
  vertical-align: text-bottom;
  animation: ai-chat-blink 1s step-end infinite;
}

@keyframes ai-chat-blink {
  50% {
    opacity: 0;
  }
}

/* ---------- 输入区 ---------- */
.ai-chat__input {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}

.ai-chat__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* 供应商/模型下拉靠左，与发送按钮分列两端 */
.ai-chat__selectors {
  display: flex;
  gap: 8px;
  margin-right: auto;
}

.ai-chat__selector {
  width: 150px;
}

.ai-chat__selector--model {
  width: 200px;
}

.ai-chat__selector--kb {
  min-width: 160px;
}

/* ---------- RAG 引用来源 ---------- */
.ai-chat__references {
  max-width: 100%;
  margin-top: 4px;
  font-size: 12px;
}

.ai-chat__references-summary {
  cursor: pointer;
  color: var(--el-text-color-secondary);
  user-select: none;
}

.ai-chat__references-summary:hover {
  color: var(--el-color-primary);
}

.ai-chat__reference {
  padding: 6px 8px;
  margin-top: 4px;
  border-left: 2px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  border-radius: 0 4px 4px 0;
}

.ai-chat__reference-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.ai-chat__reference-index {
  color: var(--el-color-primary);
  font-weight: 600;
}

.ai-chat__reference-file {
  color: var(--el-text-color-regular);
  font-weight: 500;
}

/* S68：知识库来源标签 */
.ai-chat__reference-kb {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 11px;
}

/* S68：查看原文按钮靠右 */
.ai-chat__reference-source {
  margin-left: auto;
  height: auto;
  font-size: 12px;
}

.ai-chat__reference-score {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.ai-chat__reference-content {
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ---------- S68 引用原文弹框 ---------- */
.ai-chat__chunk-source {
  min-height: 120px;
}

.ai-chat__chunk-source-meta {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.ai-chat__chunk-source-content {
  max-height: 480px;
  overflow-y: auto;
  padding: 12px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
