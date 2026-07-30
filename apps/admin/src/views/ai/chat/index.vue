<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { ElButton, ElEmpty, ElIcon, ElInput, ElMessage, ElMessageBox } from 'element-plus';
import { ChatDotRound, Delete, Plus, Promotion } from '@element-plus/icons-vue';
import type { AiChatMessageVO, AiConversationVO } from '@pivotos/types';
import { deleteConversation, listConversations, listMessages, streamChat } from '@/api/ai/chat';

/** 本地消息（流式追加时 assistant 消息尚无落库 id） */
interface LocalMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
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
    messages.value = rows.map((m) => ({ id: m.id, role: m.role, content: m.content }));
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

// ---------- 流式对话 ----------
const input = ref('');
const streaming = ref(false);
let abortController: AbortController | null = null;

async function handleSend(): Promise<void> {
  const content = input.value.trim();
  if (!content || streaming.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content });
  const assistant: LocalMessage = { role: 'assistant', content: '' };
  messages.value.push(assistant);
  scrollToBottom();

  streaming.value = true;
  abortController = new AbortController();
  await streamChat(
    { conversationId: activeId.value || undefined, content },
    {
      onMeta(meta) {
        // 新会话：回填会话 id 并刷新左侧列表
        if (!activeId.value) {
          activeId.value = meta.conversationId;
          void loadConversations();
        }
      },
      onDelta(delta) {
        assistant.content += delta;
        scrollToBottom();
      },
      onDone(done) {
        assistant.id = done.messageId;
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

onMounted(loadConversations);
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
            class="ai-chat__conversation-delete"
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
          <div class="ai-chat__bubble">
            <span v-if="msg.role === 'assistant' && !msg.content && streaming" class="ai-chat__typing">
              正在思考…
            </span>
            <template v-else>{{ msg.content }}</template>
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
          <ElButton v-if="streaming" @click="handleStop">停止</ElButton>
          <ElButton type="primary" :icon="Promotion" :loading="streaming" :disabled="!input.trim()" @click="handleSend">
            发送
          </ElButton>
        </div>
      </div>
    </section>
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

.ai-chat__conversation-delete {
  visibility: hidden;
}

.ai-chat__conversation:hover .ai-chat__conversation-delete {
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

.ai-chat__bubble {
  max-width: 78%;
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

/* ---------- 输入区 ---------- */
.ai-chat__input {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}

.ai-chat__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
