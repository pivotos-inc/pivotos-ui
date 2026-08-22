<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  ElButton,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElTabPane,
  ElTabs,
} from 'element-plus';

interface Props {
  modelValue?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

type FieldMode = 'every' | 'interval' | 'specified';

interface FieldConfig {
  mode: FieldMode;
  interval: number;
  specified: number[];
}

/** 字段定义：秒 分 时 日 月 周 */
const FIELDS = [
  { key: 'second', label: '秒', min: 0, max: 59 },
  { key: 'minute', label: '分', min: 0, max: 59 },
  { key: 'hour', label: '时', min: 0, max: 23 },
  { key: 'day', label: '日', min: 1, max: 31 },
  { key: 'month', label: '月', min: 1, max: 12 },
  { key: 'week', label: '周', min: 0, max: 6 },
] as const;

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEK_NAME_TO_NUM: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

const activeTab = ref('second');

function createDefaultConfig(min: number): FieldConfig {
  return { mode: 'every', interval: 1, specified: [min] };
}

const configs = ref<Record<string, FieldConfig>>({
  second: createDefaultConfig(0),
  minute: createDefaultConfig(0),
  hour: createDefaultConfig(0),
  day: createDefaultConfig(1),
  month: createDefaultConfig(1),
  week: createDefaultConfig(0),
});

/** 生成普通字段值 */
function fieldValue(key: string): string {
  const cfg = configs.value[key];
  switch (cfg.mode) {
    case 'every':
      return '*';
    case 'interval':
      return `*/${cfg.interval}`;
    case 'specified':
      if (cfg.specified.length === 0) return '*';
      return [...new Set(cfg.specified)].sort((a, b) => a - b).join(',');
  }
}

/** 生成周字段值（英文字母格式，与 XXL-Job 对齐） */
function weekFieldValue(): string {
  const cfg = configs.value.week;
  switch (cfg.mode) {
    case 'every':
      return '*';
    case 'interval':
      return `*/${cfg.interval}`;
    case 'specified':
      if (cfg.specified.length === 0) return '*';
      return [...new Set(cfg.specified)]
        .sort((a, b) => a - b)
        .map((n) => WEEK_CODES[n])
        .join(',');
  }
}

/** 生成最终 Cron 表达式（处理日/周互斥） */
const cronValue = computed(() => {
  const dayIsEvery = configs.value.day.mode === 'every';
  const weekIsEvery = configs.value.week.mode === 'every';

  let dayPart = fieldValue('day');
  let weekPart = weekFieldValue();

  if (dayIsEvery && weekIsEvery) {
    dayPart = '*';
    weekPart = '?';
  } else if (!dayIsEvery) {
    weekPart = '?';
  } else {
    dayPart = '?';
  }

  return [
    fieldValue('second'),
    fieldValue('minute'),
    fieldValue('hour'),
    dayPart,
    fieldValue('month'),
    weekPart,
  ].join(' ');
});

watch(
  cronValue,
  (val) => {
    if (val !== props.modelValue) {
      emit('update:modelValue', val);
    }
  },
  { immediate: true },
);

/** 解析外部 Cron 字符串到内部配置 */
function parseCron(cron: string) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 6) return;

  const keys = ['second', 'minute', 'hour', 'day', 'month', 'week'];

  keys.forEach((key, i) => {
    const part = parts[i];
    const cfg = configs.value[key];

    if (part === '*' || part === '?') {
      cfg.mode = 'every';
      return;
    }

    if (part.startsWith('*/')) {
      const n = parseInt(part.slice(2), 10);
      if (!isNaN(n) && n > 0) {
        cfg.mode = 'interval';
        cfg.interval = n;
      }
      return;
    }

    // 逗号分隔或范围
    const items = part.split(',');
    const nums: number[] = [];
    items.forEach((item) => {
      if (item.includes('-')) {
        const [start, end] = item.split('-').map((s) => parseInt(s, 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let j = start; j <= end; j++) nums.push(j);
        }
      } else if (key === 'week' && isNaN(parseInt(item, 10))) {
        const num = WEEK_NAME_TO_NUM[item.toUpperCase()];
        if (num !== undefined) nums.push(num);
      } else {
        const n = parseInt(item, 10);
        if (!isNaN(n)) nums.push(n);
      }
    });

    if (nums.length > 0) {
      cfg.mode = 'specified';
      cfg.specified = nums;
    }
  });
}

watch(
  () => props.modelValue,
  (val) => {
    if (val && val !== cronValue.value) {
      parseCron(val);
    }
  },
  { immediate: true },
);

/** 预设 Cron 表达式 */
const PRESETS = [
  { label: '每分钟', cron: '0 * * * * ?' },
  { label: '每小时', cron: '0 0 * * * ?' },
  { label: '每天0点', cron: '0 0 0 * * ?' },
  { label: '每周一', cron: '0 0 0 ? * MON' },
  { label: '每月1号', cron: '0 0 0 1 * ?' },
];

function applyPreset(cron: string) {
  parseCron(cron);
}

/** 生成字段选项列表 */
function fieldOptions(key: string): { value: number; label: string }[] {
  const field = FIELDS.find((f) => f.key === key)!;
  const options: { value: number; label: string }[] = [];
  for (let i = field.min; i <= field.max; i++) {
    if (key === 'week') {
      options.push({ value: i, label: `周${WEEK_CN[i]}` });
    } else {
      options.push({ value: i, label: String(i) });
    }
  }
  return options;
}
</script>

<template>
  <div class="cron-picker">
    <!-- 预设按钮 -->
    <div class="cron-picker__presets">
      <ElButton
        v-for="p in PRESETS"
        :key="p.cron"
        size="small"
        @click="applyPreset(p.cron)"
      >
        {{ p.label }}
      </ElButton>
    </div>

    <!-- 字段配置 Tab -->
    <ElTabs v-model="activeTab" type="card" class="cron-picker__tabs">
      <ElTabPane
        v-for="field in FIELDS"
        :key="field.key"
        :label="field.label"
        :name="field.key"
      >
        <ElRadioGroup v-model="configs[field.key].mode" size="small">
          <ElRadioButton value="every">每{{ field.label }}</ElRadioButton>
          <ElRadioButton value="interval">每 N {{ field.label }}</ElRadioButton>
          <ElRadioButton value="specified">指定</ElRadioButton>
        </ElRadioGroup>

        <!-- interval 模式 -->
        <div v-if="configs[field.key].mode === 'interval'" class="cron-picker__row">
          <ElInputNumber
            v-model="configs[field.key].interval"
            :min="1"
            :max="field.max"
            size="small"
          />
          <span class="cron-picker__hint">每 {{ configs[field.key].interval }} {{ field.label }}执行一次</span>
        </div>

        <!-- specified 模式 -->
        <div v-if="configs[field.key].mode === 'specified'" class="cron-picker__row">
          <ElSelect
            v-model="configs[field.key].specified"
            multiple
            collapse-tags
            collapse-tags-tooltip
            size="small"
            style="width: 100%"
            placeholder="选择指定值"
          >
            <ElOption
              v-for="opt in fieldOptions(field.key)"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
          </ElSelect>
        </div>
      </ElTabPane>
    </ElTabs>

    <!-- 预览 -->
    <div class="cron-picker__preview">
      <ElInput :model-value="cronValue" readonly size="small">
        <template #prepend>Cron</template>
      </ElInput>
    </div>
  </div>
</template>

<style scoped>
.cron-picker {
  width: 100%;
}

.cron-picker__presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.cron-picker__tabs {
  margin-bottom: 12px;
}

.cron-picker__row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.cron-picker__hint {
  font-size: 13px;
  color: #909399;
}

.cron-picker__preview {
  margin-top: 8px;
}
</style>
