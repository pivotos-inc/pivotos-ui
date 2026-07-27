<script setup lang="ts">
import { ElButton, ElDialog } from 'element-plus';

interface Props {
  /** 显隐（v-model） */
  modelValue: boolean;
  title?: string;
  width?: string | number;
  /** 确定按钮加载态 */
  confirmLoading?: boolean;
  showFooter?: boolean;
  confirmText?: string;
  cancelText?: string;
  /** 关闭时销毁内容，默认 true（表单弹窗推荐） */
  destroyOnClose?: boolean;
  /** 点击遮罩是否关闭，默认 false */
  closeOnClickModal?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: '',
  width: '50%',
  confirmLoading: false,
  showFooter: true,
  confirmText: '确 定',
  cancelText: '取 消',
  destroyOnClose: true,
  closeOnClickModal: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  /** 点击确定（业务侧自行校验后关闭） */
  confirm: [];
  /** 弹窗关闭后触发（适合清理表单状态） */
  closed: [];
}>();

function handleUpdate(value: boolean): void {
  emit('update:modelValue', value);
}

function handleConfirm(): void {
  emit('confirm');
}

function handleCancel(): void {
  emit('update:modelValue', false);
}
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    :destroy-on-close="destroyOnClose"
    :close-on-click-modal="closeOnClickModal"
    align-center
    append-to-body
    @update:model-value="handleUpdate"
    @closed="emit('closed')"
  >
    <slot />
    <template v-if="showFooter" #footer>
      <slot name="footer">
        <ElButton @click="handleCancel">{{ cancelText }}</ElButton>
        <ElButton type="primary" :loading="confirmLoading" @click="handleConfirm">
          {{ confirmText }}
        </ElButton>
      </slot>
    </template>
  </ElDialog>
</template>
