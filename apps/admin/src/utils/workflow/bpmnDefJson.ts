/**
 * BPMN 2.0 XML ↔ warm-flow DefJson 双向映射（S103 C4 前置验证）。
 *
 * 映射口径（warm-flow 1.8.7 jar 反编译 + dev 库真实定义回读实证）：
 * - startEvent ↔ nodeType=0，userTask ↔ nodeType=1，endEvent ↔ nodeType=2
 * - exclusiveGateway ↔ nodeType=3（SERIAL，串行/互斥网关，条件挂出边）
 * - parallelGateway ↔ nodeType=4（PARALLEL），inclusiveGateway ↔ nodeType=5（INCLUSIVE）
 * - sequenceFlow ↔ SkipJson（skipType 默认 PASS；warm:skipType="REJECT" 表驳回边）
 * - sequenceFlow/conditionExpression ↔ SkipJson.skipCondition（格式 `le@@days|3`）
 * - userTask@warm:permissionFlag ↔ NodeJson.permissionFlag（用户 ID，多个 @@ 分隔）
 * - BPMNShape Bounds ↔ coordinate "x,y"；BPMNEdge waypoints ↔ coordinate "x1,y1;x2,y2"
 */

/** warm-flow 自定义属性命名空间（moddle 扩展，保证 permissionFlag/skipType 画布往返不丢） */
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

// ---------- warm-flow DefJson 结构（对齐 1.8.7 DTO） ----------

export interface WarmSkipJson {
  nowNodeCode: string;
  nextNodeCode: string;
  skipName: string;
  skipType: string;
  skipCondition?: string;
  coordinate?: string;
}

export interface WarmNodeJson {
  nodeType: number;
  nodeCode: string;
  nodeName: string;
  permissionFlag?: string;
  nodeRatio?: string;
  coordinate: string;
  skipList: WarmSkipJson[];
}

export interface WarmDefJson {
  id?: number | string;
  flowCode: string;
  flowName: string;
  modelValue: string;
  category?: string;
  nodeList: WarmNodeJson[];
}

// ---------- BPMN 图元 ↔ nodeType ----------

const BPMN_TAG_TO_TYPE: Record<string, WarmNodeType> = {
  startEvent: 0,
  userTask: 1,
  endEvent: 2,
  exclusiveGateway: 3,
  parallelGateway: 4,
  inclusiveGateway: 5,
};

const TYPE_TO_BPMN_TAG: Record<WarmNodeType, string> = {
  0: 'startEvent',
  1: 'userTask',
  2: 'endEvent',
  3: 'exclusiveGateway',
  4: 'parallelGateway',
  5: 'inclusiveGateway',
};

/** 可被映射为节点的 BPMN 图元 localName 白名单（task 暂不支持，避免静默丢语义） */
const KNOWN_NODE_TAGS = new Set(Object.keys(BPMN_TAG_TO_TYPE));

// ---------- BPMN XML → IR ----------

/** BPMN XML 解析为中间图；遇不支持的图元直接抛错（不静默丢语义） */
export function bpmnXmlToGraph(xml: string): FlowGraph {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('BPMN XML 解析失败：' + (parseError[0]?.textContent ?? '').slice(0, 200));
  }
  const byTag = (tag: string): Element[] => Array.from(doc.getElementsByTagNameNS('*', tag));

  const process = byTag('process')[0];
  if (!process) throw new Error('BPMN XML 缺少 process 元素');

  // DI 坐标索引：BPMNShape(bpmnElement) → bounds；BPMNEdge(bpmnElement) → waypoints
  const shapeBounds = new Map<string, { x: number; y: number }>();
  for (const shape of byTag('BPMNShape')) {
    const el = shape.getAttribute('bpmnElement');
    const bounds = Array.from(shape.getElementsByTagNameNS('*', 'Bounds'))[0];
    if (el && bounds) {
      shapeBounds.set(el, {
        x: Number(bounds.getAttribute('x') ?? 0),
        y: Number(bounds.getAttribute('y') ?? 0),
      });
    }
  }
  const edgeWaypoints = new Map<string, Array<{ x: number; y: number }>>();
  for (const edge of byTag('BPMNEdge')) {
    const el = edge.getAttribute('bpmnElement');
    if (!el) continue;
    edgeWaypoints.set(
      el,
      Array.from(edge.getElementsByTagNameNS('*', 'waypoint')).map((w) => ({
        x: Number(w.getAttribute('x') ?? 0),
        y: Number(w.getAttribute('y') ?? 0),
      })),
    );
  }

  const nodes: FlowGraphNode[] = [];
  for (const [tag, nodeType] of Object.entries(BPMN_TAG_TO_TYPE)) {
    for (const el of byTag(tag)) {
      // 只取当前 process 直属节点（防子流程嵌套误抓）
      if (el.parentElement !== process) continue;
      const id = el.getAttribute('id') ?? '';
      const bounds = shapeBounds.get(id) ?? { x: 0, y: 0 };
      nodes.push({
        nodeCode: id,
        nodeName: el.getAttribute('name') || id,
        nodeType,
        permissionFlag: el.getAttributeNS(WARM_NS, 'permissionFlag') ?? undefined,
        nodeRatio: el.getAttributeNS(WARM_NS, 'nodeRatio') ?? undefined,
        x: bounds.x,
        y: bounds.y,
      });
    }
  }

  // 不支持的图元显式报错
  for (const child of Array.from(process.children)) {
    const tag = child.localName;
    if (KNOWN_NODE_TAGS.has(tag) || tag === 'sequenceFlow') continue;
    throw new Error(`暂不支持的 BPMN 图元：${tag}（仅支持开始/用户任务/结束/三类网关/顺序流）`);
  }

  const edges: FlowGraphEdge[] = byTag('sequenceFlow')
    .filter((el) => el.parentElement === process)
    .map((el) => {
      const id = el.getAttribute('id') ?? '';
      const condEl = Array.from(el.getElementsByTagNameNS('*', 'conditionExpression'))[0];
      const skipTypeAttr = el.getAttributeNS(WARM_NS, 'skipType');
      return {
        from: el.getAttribute('sourceRef') ?? '',
        to: el.getAttribute('targetRef') ?? '',
        skipName: el.getAttribute('name') || '',
        skipType: skipTypeAttr === 'REJECT' || skipTypeAttr === 'NONE' ? skipTypeAttr : 'PASS',
        skipCondition: condEl?.textContent?.trim() || undefined,
        waypoints: edgeWaypoints.get(id) ?? [],
      };
    });

  return {
    flowCode: process.getAttribute('id') ?? '',
    flowName: process.getAttribute('name') || process.getAttribute('id') || '',
    nodes,
    edges,
  };
}

// ---------- IR ↔ DefJson ----------

/** IR → warm-flow DefJson（nodeList 内嵌 skipList，坐标格式对齐线上实证样例） */
export function graphToDefJson(graph: FlowGraph, opts?: { id?: number | string }): WarmDefJson {
  const nodeList: WarmNodeJson[] = graph.nodes.map((n) => ({
    nodeType: n.nodeType,
    nodeCode: n.nodeCode,
    nodeName: n.nodeName,
    ...(n.permissionFlag ? { permissionFlag: n.permissionFlag } : {}),
    nodeRatio: n.nodeRatio ?? '0.000',
    coordinate: `${Math.round(n.x)},${Math.round(n.y)}`,
    skipList: graph.edges
      .filter((e) => e.from === n.nodeCode)
      .map((e) => ({
        nowNodeCode: e.from,
        nextNodeCode: e.to,
        skipName: e.skipName,
        skipType: e.skipType,
        ...(e.skipCondition ? { skipCondition: e.skipCondition } : {}),
        ...(e.waypoints.length > 0
          ? { coordinate: e.waypoints.map((w) => `${Math.round(w.x)},${Math.round(w.y)}`).join(';') }
          : {}),
      })),
  }));
  return {
    ...(opts?.id ? { id: opts.id } : {}),
    flowCode: graph.flowCode,
    flowName: graph.flowName,
    modelValue: graph.modelValue ?? 'CLASSICS',
    ...(graph.category ? { category: graph.category } : {}),
    nodeList,
  };
}

/** warm-flow DefJson → IR（回显方向） */
export function defJsonToGraph(def: WarmDefJson): FlowGraph {
  const nodes: FlowGraphNode[] = def.nodeList.map((n) => {
    const [x, y] = (n.coordinate || '0,0').split(',').map(Number);
    return {
      nodeCode: n.nodeCode,
      nodeName: n.nodeName,
      nodeType: (n.nodeType ?? 1) as WarmNodeType,
      permissionFlag: n.permissionFlag,
      nodeRatio: n.nodeRatio,
      x: x || 0,
      y: y || 0,
    };
  });
  const edges: FlowGraphEdge[] = [];
  for (const n of def.nodeList) {
    for (const s of n.skipList ?? []) {
      edges.push({
        from: s.nowNodeCode,
        to: s.nextNodeCode,
        skipName: s.skipName || '',
        skipType: (s.skipType as FlowGraphEdge['skipType']) || 'PASS',
        skipCondition: s.skipCondition,
        waypoints: (s.coordinate || '')
          .split(';')
          .filter(Boolean)
          .map((p) => {
            const [x, y] = p.split(',').map(Number);
            return { x: x || 0, y: y || 0 };
          }),
      });
    }
  }
  return {
    flowCode: def.flowCode,
    flowName: def.flowName,
    category: def.category,
    modelValue: def.modelValue,
    nodes,
    edges,
  };
}

// ---------- IR → BPMN XML ----------

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** IR → BPMN 2.0 XML（含 DI 坐标与 warm 扩展属性，可直接被 bpmn-js import） */
export function graphToBpmnXml(graph: FlowGraph): string {
  const nodeXml = graph.nodes
    .map((n) => {
      const tag = TYPE_TO_BPMN_TAG[n.nodeType];
      const warmAttrs =
        (n.permissionFlag ? ` warm:permissionFlag="${esc(n.permissionFlag)}"` : '') +
        (n.nodeRatio && n.nodeRatio !== '0.000' ? ` warm:nodeRatio="${esc(n.nodeRatio)}"` : '');
      const outgoing = graph.edges.filter((e) => e.from === n.nodeCode);
      const incoming = graph.edges.filter((e) => e.to === n.nodeCode);
      const refs =
        incoming.map((e) => `      <bpmn:incoming>flow_${e.from}_${e.to}</bpmn:incoming>\n`).join('') +
        outgoing.map((e) => `      <bpmn:outgoing>flow_${e.from}_${e.to}</bpmn:outgoing>\n`).join('');
      if (!refs) return `    <bpmn:${tag} id="${esc(n.nodeCode)}" name="${esc(n.nodeName)}"${warmAttrs} />`;
      return `    <bpmn:${tag} id="${esc(n.nodeCode)}" name="${esc(n.nodeName)}"${warmAttrs}>\n${refs}    </bpmn:${tag}>`;
    })
    .join('\n');

  const flowXml = graph.edges
    .map((e) => {
      const warmAttr = e.skipType !== 'PASS' ? ` warm:skipType="${e.skipType}"` : '';
      const cond = e.skipCondition
        ? `\n      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${esc(e.skipCondition)}</bpmn:conditionExpression>\n    `
        : '';
      return `    <bpmn:sequenceFlow id="flow_${e.from}_${e.to}" sourceRef="${esc(e.from)}" targetRef="${esc(e.to)}" name="${esc(e.skipName)}"${warmAttr}>${cond}</bpmn:sequenceFlow>`;
    })
    .join('\n');

  const shapes = graph.nodes
    .map(
      (n) => `      <bpmndi:BPMNShape id="di_${esc(n.nodeCode)}" bpmnElement="${esc(n.nodeCode)}">
        <dc:Bounds x="${Math.round(n.x)}" y="${Math.round(n.y)}" width="${n.nodeType === 0 || n.nodeType === 2 ? 36 : n.nodeType >= 3 ? 50 : 100}" height="${n.nodeType === 0 || n.nodeType === 2 ? 36 : n.nodeType >= 3 ? 50 : 80}" />
      </bpmndi:BPMNShape>`,
    )
    .join('\n');

  const edgeDi = graph.edges
    .map((e) => {
      const pts = e.waypoints.length > 0 ? e.waypoints : [{ x: 0, y: 0 }, { x: 0, y: 0 }];
      const wp = pts.map((w) => `        <di:waypoint x="${Math.round(w.x)}" y="${Math.round(w.y)}" />`).join('\n');
      return `      <bpmndi:BPMNEdge id="di_flow_${e.from}_${e.to}" bpmnElement="flow_${e.from}_${e.to}">\n${wp}\n      </bpmndi:BPMNEdge>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:warm="${WARM_NS}"
  targetNamespace="http://pivotos/bpmn">
  <bpmn:process id="${esc(graph.flowCode)}" name="${esc(graph.flowName)}" isExecutable="false">
${nodeXml}
${flowXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram_${esc(graph.flowCode)}">
    <bpmndi:BPMNPlane id="plane_${esc(graph.flowCode)}" bpmnElement="${esc(graph.flowCode)}">
${shapes}
${edgeDi}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

/** BPMN XML → DefJson 一步到位（一票否决验证主链路） */
export function bpmnXmlToDefJson(xml: string, opts?: { id?: number | string }): WarmDefJson {
  return graphToDefJson(bpmnXmlToGraph(xml), opts);
}

/** DefJson → BPMN XML 一步到位（回显链路） */
export function defJsonToBpmnXml(def: WarmDefJson): string {
  return graphToBpmnXml(defJsonToGraph(def));
}

// ---------- 一票否决验证用示例（对齐 14 号清单：开始→审批→结束 + 互斥网关 le@@days|3） ----------

export const SAMPLE_VETO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:warm="${WARM_NS}"
  targetNamespace="http://pivotos/bpmn">
  <bpmn:process id="leave_tier_s103" name="请假分档审批-S103映射验证" isExecutable="false">
    <bpmn:startEvent id="start" name="开始">
      <bpmn:outgoing>flow_start_apply</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="apply" name="提交申请" warm:permissionFlag="1">
      <bpmn:incoming>flow_start_apply</bpmn:incoming>
      <bpmn:outgoing>flow_apply_gw</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="gw" name="天数分档">
      <bpmn:incoming>flow_apply_gw</bpmn:incoming>
      <bpmn:outgoing>flow_gw_leader</bpmn:outgoing>
      <bpmn:outgoing>flow_gw_director</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="leader" name="主管审批" warm:permissionFlag="1">
      <bpmn:incoming>flow_gw_leader</bpmn:incoming>
      <bpmn:outgoing>flow_leader_end</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="director" name="部门负责人审批" warm:permissionFlag="1">
      <bpmn:incoming>flow_gw_director</bpmn:incoming>
      <bpmn:outgoing>flow_director_end</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="end" name="结束">
      <bpmn:incoming>flow_leader_end</bpmn:incoming>
      <bpmn:incoming>flow_director_end</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow_start_apply" sourceRef="start" targetRef="apply" name="提交" />
    <bpmn:sequenceFlow id="flow_apply_gw" sourceRef="apply" targetRef="gw" name="提交" />
    <bpmn:sequenceFlow id="flow_gw_leader" sourceRef="gw" targetRef="leader" name="3天以内">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">le@@days|3</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_gw_director" sourceRef="gw" targetRef="director" name="3天以上">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">gt@@days|3</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_leader_end" sourceRef="leader" targetRef="end" name="同意" />
    <bpmn:sequenceFlow id="flow_director_end" sourceRef="director" targetRef="end" name="同意" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram_leave_tier_s103">
    <bpmndi:BPMNPlane id="plane_leave_tier_s103" bpmnElement="leave_tier_s103">
      <bpmndi:BPMNShape id="di_start" bpmnElement="start"><dc:Bounds x="80" y="240" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="di_apply" bpmnElement="apply"><dc:Bounds x="180" y="218" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="di_gw" bpmnElement="gw"><dc:Bounds x="340" y="233" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="di_leader" bpmnElement="leader"><dc:Bounds x="450" y="158" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="di_director" bpmnElement="director"><dc:Bounds x="450" y="278" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="di_end" bpmnElement="end"><dc:Bounds x="640" y="240" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="di_flow_start_apply" bpmnElement="flow_start_apply"><di:waypoint x="116" y="258" /><di:waypoint x="180" y="258" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="di_flow_apply_gw" bpmnElement="flow_apply_gw"><di:waypoint x="280" y="258" /><di:waypoint x="340" y="258" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="di_flow_gw_leader" bpmnElement="flow_gw_leader"><di:waypoint x="390" y="258" /><di:waypoint x="450" y="198" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="di_flow_gw_director" bpmnElement="flow_gw_director"><di:waypoint x="390" y="258" /><di:waypoint x="450" y="318" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="di_flow_leader_end" bpmnElement="flow_leader_end"><di:waypoint x="550" y="198" /><di:waypoint x="658" y="240" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="di_flow_director_end" bpmnElement="flow_director_end"><di:waypoint x="550" y="318" /><di:waypoint x="658" y="276" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
