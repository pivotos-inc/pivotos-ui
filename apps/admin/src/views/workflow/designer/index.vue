<script setup lang="ts">
defineOptions({ name: 'WorkflowDesigner' });
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { ElButton, ElDrawer, ElInput, ElMessage, ElMessageBox } from 'element-plus';
import Modeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import {
  SAMPLE_VETO_XML,
  bpmnXmlToDefJson,
  defJsonToBpmnXml,
  warmModdleDescriptor,
} from '@/utils/workflow/bpmnDefJson';
import { queryDefJson, saveDefJson } from '@/api/workflow/designer';
import { pageDefinitions, publishDefinition } from '@/api/workflow/definition';
import { warmPaletteModule } from './warmPalette';
import type { PanelElement } from './modelerProps';
import NodePanel from './properties/NodePanel.vue';
import EdgePanel from './properties/EdgePanel.vue';

// ---------- bpmn-js 画布 ----------
const route = useRoute();
const canvasRef = ref<HTMLElement | null>(null);
let modeler: Modeler | null = null;
/** 传给属性面板的响应式引用（面板挂载早于 modeler 创建完成） */
const modelerRef = shallowRef<Modeler | null>(null);

/** 当前选中图元（属性面板数据源）；canvas 空白处点击时为 null */
const selectedElement = ref<PanelElement | null>(null);
/** commandStack 变更计数器：属性写回后 bump，驱动面板重读值 */
const panelVersion = ref(0);

onMounted(async () => {
  modeler = new Modeler({
    container: canvasRef.value as HTMLElement,
    moddleExtensions: { warm: warmModdleDescriptor },
    additionalModules: [warmPaletteModule],
  });
  modelerRef.value = modeler;
  modeler.on('selection.changed', (e: unknown) => {
    const sel = (e as { newSelection?: unknown[] }).newSelection ?? [];
    selectedElement.value = (sel[0] as PanelElement | undefined) ?? null;
  });
  modeler.on('commandStack.changed', () => {
    panelVersion.value += 1;
  });
  // 「新版设计」入口带 id：回读既有定义重建画布；否则载入示例
  const id = typeof route.query.id === 'string' ? route.query.id : '';
  if (id) {
    await loadDefinition(id);
  } else {
    await loadSample();
  }
});

onBeforeUnmount(() => {
  modeler?.destroy();
  modeler = null;
  modelerRef.value = null;
});

async function loadSample(): Promise<void> {
  if (!modeler) return;
  await modeler.importXML(SAMPLE_VETO_XML);
  // importXML 完成后画布可能尚未完成布局，延迟一帧再 fit（否则首载偏移）
  requestAnimationFrame(() => fitViewport());
  ElMessage.success('已载入一票否决验证样例（开始→审批→互斥网关→双分支→结束）');
}

/** 「新版设计」入口：按定义 id 回读 DefJson 并重建画布（S103 已验证链路） */
async function loadDefinition(id: string): Promise<void> {
  if (!modeler) return;
  try {
    const def = await queryDefJson(id);
    await modeler.importXML(defJsonToBpmnXml(def));
    savedFlowCode.value = def.flowCode;
    requestAnimationFrame(() => fitViewport());
    ElMessage.success(`已载入定义：${def.flowName}（${def.flowCode}，id=${id}）`);
  } catch (e) {
    ElMessage.error(`载入定义失败：${(e as Error).message}`);
    await loadSample();
  }
}

function fitViewport(): void {
  const canvas = modeler?.get('canvas') as { zoom: (mode: string) => void } | undefined;
  canvas?.zoom('fit-viewport');
}

async function currentXml(): Promise<string> {
  if (!modeler) throw new Error('设计器未初始化');
  const { xml } = await modeler.saveXML({ format: true });
  return xml ?? '';
}

// ---------- DefJson 预览 ----------
const previewVisible = ref(false);
const previewJson = ref('');

async function handlePreview(): Promise<void> {
  try {
    const def = bpmnXmlToDefJson(await currentXml());
    previewJson.value = JSON.stringify(def, null, 2);
    previewVisible.value = true;
  } catch (e) {
    ElMessage.error(`映射失败：${(e as Error).message}`);
  }
}

// ---------- 保存 / 回读 / 发布 ----------
const saving = ref(false);
const savedFlowCode = ref('');

async function handleSave(): Promise<void> {
  const def = bpmnXmlToDefJson(await currentXml());
  if (!def.flowCode) {
    ElMessage.warning('流程编码（process id）为空，无法保存');
    return;
  }
  saving.value = true;
  try {
    await saveDefJson(def);
    savedFlowCode.value = def.flowCode;
    ElMessage.success(`保存成功：${def.flowName}（${def.flowCode}），已入库未发布`);
  } catch (e) {
    ElMessage.error(`保存失败：${(e as Error).message}`);
  } finally {
    saving.value = false;
  }
}

/** 按 flowCode 查最新定义 ID（save-json 不回传 id）；flowCode 取当前画布内容，避免组件状态丢失后误判 */
async function findLatestDefinitionId(): Promise<string | null> {
  const flowCode = bpmnXmlToDefJson(await currentXml()).flowCode || savedFlowCode.value;
  if (!flowCode) return null;
  const page = await pageDefinitions({ flowCode, pageNum: 1, pageSize: 20 });
  const latest = (page.list ?? [])
    .filter((d) => d.isPublish !== 9)
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  return latest ? String(latest.id) : null;
}

async function handleRoundtrip(): Promise<void> {
  try {
    const id = await findLatestDefinitionId();
    if (!id) {
      ElMessage.warning('未找到已保存定义，请先保存');
      return;
    }
    const def = await queryDefJson(id);
    // 回读 DefJson → BPMN XML 重新载入画布（验证回显链路）
    if (modeler) {
      await modeler.importXML(defJsonToBpmnXml(def));
      fitViewport();
    }
    previewJson.value = JSON.stringify(def, null, 2);
    previewVisible.value = true;
    ElMessage.success(`回读成功（id=${id}），画布已按服务端数据重建`);
  } catch (e) {
    ElMessage.error(`回读失败：${(e as Error).message}`);
  }
}

async function handlePublish(): Promise<void> {
  try {
    const id = await findLatestDefinitionId();
    if (!id) {
      ElMessage.warning('未找到已保存定义，请先保存');
      return;
    }
    await ElMessageBox.confirm(`确定发布流程定义（id=${id}）吗？`, '提示', { type: 'warning' });
    await publishDefinition(id);
    ElMessage.success('发布成功，可到「我发起的」发起实例验证走向');
  } catch (e) {
    if ((e as Error).message !== 'cancel') {
      ElMessage.error(`发布失败：${(e as Error).message}`);
    }
  }
}

// ---------- 导出 XML ----------
async function handleExportXml(): Promise<void> {
  const xml = await currentXml();
  const blob = new Blob([xml], { type: 'application/xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${savedFlowCode.value || 'flow'}.bpmn20.xml`;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>

<template>
  <div class="designer-page">
    <div class="designer-toolbar">
      <span class="designer-title">流程设计器（新版）</span>
      <ElButton @click="loadSample">载入示例</ElButton>
      <ElButton @click="handlePreview">生成 DefJson 预览</ElButton>
      <ElButton @click="handleExportXml">导出 XML</ElButton>
      <ElButton v-hasPermi="'workflow:designer:save'" type="primary" :loading="saving" @click="handleSave">
        保存到后端
      </ElButton>
      <ElButton @click="handleRoundtrip">回读重建画布</ElButton>
      <ElButton v-hasPermi="'workflow:definition:publish'" type="success" @click="handlePublish">
        发布
      </ElButton>
    </div>
    <div class="designer-body">
      <div ref="canvasRef" class="designer-canvas" />
      <div class="designer-props">
        <div class="designer-props-title">属性面板</div>
        <EdgePanel
          v-if="selectedElement && selectedElement.type === 'bpmn:SequenceFlow'"
          :key="selectedElement.id"
          :modeler="modelerRef"
          :element="selectedElement"
          :version="panelVersion"
        />
        <NodePanel
          v-else-if="selectedElement"
          :key="selectedElement.id"
          :modeler="modelerRef"
          :element="selectedElement"
          :version="panelVersion"
        />
        <div v-else class="designer-props-empty">点击画布中的节点或连线编辑属性</div>
      </div>
    </div>

    <ElDrawer v-model="previewVisible" title="DefJson（映射产物 / 服务端回读）" size="46%">
      <ElInput v-model="previewJson" type="textarea" :rows="30" readonly />
    </ElDrawer>
  </div>
</template>

<style scoped>
.designer-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.designer-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.designer-title {
  margin-right: auto;
  font-weight: 600;
  white-space: nowrap;
}

.designer-body {
  display: flex;
  flex: 1;
  gap: 12px;
  min-height: 0;
}

.designer-canvas {
  flex: 1;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: #fff;
}

.designer-props {
  width: 320px;
  flex-shrink: 0;
  padding: 12px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.designer-props-title {
  margin-bottom: 12px;
  font-weight: 600;
}

.designer-props-empty {
  padding: 24px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-align: center;
}
</style>
