<script setup lang="ts">
defineOptions({ name: 'WorkflowDesigner' });
import { onBeforeUnmount, onMounted, ref } from 'vue';
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

// ---------- bpmn-js 画布 ----------
const canvasRef = ref<HTMLElement | null>(null);
let modeler: Modeler | null = null;

onMounted(async () => {
  modeler = new Modeler({
    container: canvasRef.value as HTMLElement,
    moddleExtensions: { warm: warmModdleDescriptor },
  });
  await loadSample();
});

onBeforeUnmount(() => {
  modeler?.destroy();
  modeler = null;
});

async function loadSample(): Promise<void> {
  if (!modeler) return;
  await modeler.importXML(SAMPLE_VETO_XML);
  // importXML 完成后画布可能尚未完成布局，延迟一帧再 fit（否则首载偏移）
  requestAnimationFrame(() => fitViewport());
  ElMessage.success('已载入一票否决验证样例（开始→审批→互斥网关→双分支→结束）');
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
    <div ref="canvasRef" class="designer-canvas" />

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

.designer-canvas {
  flex: 1;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: #fff;
}
</style>
