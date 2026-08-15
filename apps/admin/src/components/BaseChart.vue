<script setup lang="ts">
/**
 * ECharts 通用图表容器（S71）：
 * props.option 变化时 setOption，ResizeObserver 自适应，unmount 时 dispose。
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

defineOptions({ name: 'BaseChart' });

const props = withDefaults(
  defineProps<{
    option: EChartsOption;
    /** 暗色主题（数据大屏用） */
    dark?: boolean;
  }>(),
  { dark: false },
);

const containerRef = ref<HTMLDivElement>();
const chartRef = shallowRef<echarts.ECharts>();
let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  if (!containerRef.value) {
    return;
  }
  chartRef.value = echarts.init(containerRef.value, props.dark ? 'dark' : undefined);
  chartRef.value.setOption(props.option);
  resizeObserver = new ResizeObserver(() => chartRef.value?.resize());
  resizeObserver.observe(containerRef.value);
});

watch(
  () => props.option,
  (option) => {
    // notMerge：区块降级（数据缺失）时能清除旧系列
    chartRef.value?.setOption(option, { notMerge: true });
  },
  { deep: true },
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  chartRef.value?.dispose();
});
</script>

<template>
  <div ref="containerRef" class="base-chart" />
</template>

<style scoped>
.base-chart {
  width: 100%;
  height: 100%;
}
</style>
