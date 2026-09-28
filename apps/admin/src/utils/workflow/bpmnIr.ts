/**
 * BPMN ↔ warm-flow 映射·IR 段（S105 拆分自 bpmnDefJson.ts）：
 * 中间图（FlowGraph）类型 + BPMN 图元 ↔ nodeType 映射表 + warm moddle 扩展描述。
 *
 * 映射口径（warm-flow 1.8.7 jar 反编译 + dev 库真实定义回读实证）：
 * - startEvent ↔ nodeType=0，userTask ↔ nodeType=1，endEvent ↔ nodeType=2
 * - exclusiveGateway ↔ nodeType=3（SERIAL，串行/互斥网关，条件挂出边）
 * - parallelGateway ↔ nodeType=4（PARALLEL），inclusiveGateway ↔ nodeType=5（INCLUSIVE）
 * - sequenceFlow ↔ SkipJson（skipType 默认 PASS；warm:skipType="REJECT" 表驳回边）
 * - sequenceFlow/conditionExpression ↔ SkipJson.skipCondition（格式 `le@@days|3`）
 * - userTask@warm:permissionFlag ↔ NodeJson.permissionFlag（用户 ID，多个 @@ 分隔）
 * - userTask@warm:nodeRatio ↔ NodeJson.nodeRatio（0 或签 / 100 会签 / 50 票签通过率 /
 *   passCount=n / rejectCount=n；S105 顺签出圈——引擎枚举死代码，面板不提供）
 * - BPMNShape Bounds ↔ coordinate "x,y"；BPMNEdge waypoints ↔ coordinate "x1,y1;x2,y2"
 */

/** warm-flow 自定义属性命名空间（moddle 扩展，保证 permissionFlag/nodeRatio/skipType 画布往返不丢） */
export const WARM_NS = 'http://pivotos/warm-flow';

/** bpmn-js Modeler 挂载用的 moddle 扩展描述 */
export const warmModdleDescriptor = {
  name: 'WarmFlow',
  uri: WARM_NS,
  prefix: 'warm',
  xml: { tagAlias: 'lowerCase' },
  types: [
    {
      name: 'WarmUserTask',
      extends: ['bpmn:UserTask'],
      properties: [
        { name: 'permissionFlag', isAttr: true, type: 'String' },
        { name: 'nodeRatio', isAttr: true, type: 'String' },
      ],
    },
    {
      name: 'WarmSequenceFlow',
      extends: ['bpmn:SequenceFlow'],
      properties: [{ name: 'skipType', isAttr: true, type: 'String' }],
    },
  ],
};

// ---------- 中间表示（IR） ----------

export type WarmNodeType = 0 | 1 | 2 | 3 | 4 | 5;

export interface FlowGraphNode {
  nodeCode: string;
  nodeName: string;
  nodeType: WarmNodeType;
  permissionFlag?: string;
  nodeRatio?: string;
  x: number;
  y: number;
}

export interface FlowGraphEdge {
  from: string;
  to: string;
  skipName: string;
  skipType: 'PASS' | 'REJECT' | 'NONE';
  skipCondition?: string;
  waypoints: Array<{ x: number; y: number }>;
}

export interface FlowGraph {
  flowCode: string;
  flowName: string;
  category?: string;
  modelValue?: string;
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
}

// ---------- BPMN 图元 ↔ nodeType ----------

export const BPMN_TAG_TO_TYPE: Record<string, WarmNodeType> = {
  startEvent: 0,
  userTask: 1,
  endEvent: 2,
  exclusiveGateway: 3,
  parallelGateway: 4,
  inclusiveGateway: 5,
};

export const TYPE_TO_BPMN_TAG: Record<WarmNodeType, string> = {
  0: 'startEvent',
  1: 'userTask',
  2: 'endEvent',
  3: 'exclusiveGateway',
  4: 'parallelGateway',
  5: 'inclusiveGateway',
};

/** 可被映射为节点的 BPMN 图元 localName 白名单（task 暂不支持，避免静默丢语义） */
export const KNOWN_NODE_TAGS = new Set(Object.keys(BPMN_TAG_TO_TYPE));
