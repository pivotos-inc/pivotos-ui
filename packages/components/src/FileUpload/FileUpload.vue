<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElButton, ElMessage, ElUpload } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import type { UploadFile, UploadFiles, UploadRequestOptions, UploadUserFile } from 'element-plus';

interface Props {
  /** 已上传文件 URL（v-model）；多选为数组 */
  modelValue?: string | string[];
  /**
   * 上传执行器（业务侧注入，对接 file Starter 签名直传）。
   * 入参为原始 File，返回可访问的 URL。
   */
  upload: (file: File) => Promise<string>;
  multiple?: boolean;
  /** 最大文件数，默认 1（多选时默认 5） */
  limit?: number;
  /** 单文件大小上限（MB），默认 10 */
  maxSizeMb?: number;
  /** 接受的文件类型，如 'image/*' 或 '.png,.jpg' */
  accept?: string;
  /** 提示文案 */
  tip?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  multiple: false,
  limit: undefined,
  maxSizeMb: 10,
  accept: undefined,
  tip: undefined,
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | undefined];
}>();

const limitCount = computed(() => props.limit ?? (props.multiple ? 5 : 1));

const fileList = ref<UploadUserFile[]>([]);

/** modelValue → fileList 同步（外部回显场景） */
watch(
  () => props.modelValue,
  (val) => {
    const urls = Array.isArray(val) ? val : val ? [val] : [];
    if (urls.join() === fileList.value.map((f) => f.url).join()) return;
    fileList.value = urls.map((url) => ({ name: url.split('/').pop() ?? url, url }));
  },
  { immediate: true },
);

function syncModel(list: UploadFiles): void {
  const urls = list.filter((f) => f.status === 'success' && f.url).map((f) => f.url as string);
  emit('update:modelValue', props.multiple ? urls : urls[0]);
}

async function customRequest(options: UploadRequestOptions): Promise<void> {
  try {
    const url = await props.upload(options.file);
    const target = fileList.value.find((f) => f.uid === options.file.uid);
    if (target) {
      target.url = url;
      target.status = 'success';
    }
    syncModel(fileList.value as UploadFiles);
  } catch (err) {
    const target = fileList.value.find((f) => f.uid === options.file.uid);
    if (target) target.status = 'fail';
    ElMessage.error(`上传失败：${err instanceof Error ? err.message : '未知错误'}`);
  }
}

function beforeUpload(file: File): boolean {
  if (props.maxSizeMb && file.size / 1024 / 1024 > props.maxSizeMb) {
    ElMessage.warning(`文件大小不能超过 ${props.maxSizeMb}MB`);
    return false;
  }
  return true;
}

function handleChange(_file: UploadFile, list: UploadFiles): void {
  fileList.value = list;
  syncModel(list);
}

function handleRemove(_file: UploadFile, list: UploadFiles): void {
  fileList.value = list;
  syncModel(list);
}
</script>

<template>
  <div class="file-upload">
    <ElUpload
      v-model:file-list="fileList"
      :http-request="customRequest"
      :before-upload="beforeUpload"
      :on-change="handleChange"
      :on-remove="handleRemove"
      :limit="limitCount"
      :accept="accept"
      :disabled="disabled"
      :multiple="multiple"
      list-type="text"
    >
      <ElButton :icon="Plus" :disabled="disabled">点击上传</ElButton>
      <template v-if="tip" #tip>
        <div class="file-upload__tip">{{ tip }}</div>
      </template>
    </ElUpload>
  </div>
</template>

<style scoped>
.file-upload__tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}
</style>
