/**
 * BPMN ↔ warm-flow 映射·DefJson 段（S105 拆分自原 bpmnDefJson.ts，保留原文件名）：
 * warm-flow DefJson 结构（对齐 1.8.7 DTO）+ IR ↔ DefJson 双向转换。
 * IR 类型与映射表见 bpmnIr.ts；XML 双向见 bpmnXml.ts。
 */
import type { FlowGraph, WarmNodeType, FlowGraphEdge } from './bpmnIr';

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
  const nodes = def.nodeList.map((n) => {
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
