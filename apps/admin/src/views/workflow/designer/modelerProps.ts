/**
 * 属性面板读写助手（S104）。
 * warm 扩展属性经 moddle 注册后直接挂在 businessObject 上（node 探针实证：
 * bo.get('permissionFlag') 读、写后序列化为 warm:permissionFlag 属性）。
 */
import type Modeler from 'bpmn-js/lib/Modeler';

/** 面板用的最小图元结构（避免耦合 bpmn-js 内部类型） */
export interface PanelElement {
  id: string;
  type: string;
  businessObject: {
    get(name: string): unknown;
  };
}

interface ModelingLike {
  updateProperties(element: unknown, props: Record<string, unknown>): void;
  updateModdleProperties(element: unknown, moddleElement: unknown, props: Record<string, unknown>): void;
}
interface ModdleLike {
  create(type: string, attrs: Record<string, unknown>): unknown;
}

function modelingOf(modeler: Modeler): ModelingLike {
  return modeler.get('modeling') as ModelingLike;
}

export function readName(el: PanelElement): string {
  const v = el.businessObject.get('name');
  return typeof v === 'string' ? v : '';
}

export function writeName(modeler: Modeler, el: PanelElement, name: string): void {
  modelingOf(modeler).updateProperties(el, { name });
}

/** 读 warm 扩展属性（permissionFlag/nodeRatio/skipType），缺省空串 */
export function readWarmAttr(el: PanelElement, name: string): string {
  const v = el.businessObject.get(name);
  return typeof v === 'string' ? v : '';
}

/** 写 warm 扩展属性；空值置 undefined 移除属性（PASS 等缺省值不落 XML，保持干净） */
export function writeWarmAttr(modeler: Modeler, el: PanelElement, name: string, value: string): void {
  modelingOf(modeler).updateModdleProperties(el, el.businessObject, { [name]: value || undefined });
}

/** 读 sequenceFlow 条件表达式文本（格式 `le@@days|3`） */
export function readCondition(el: PanelElement): string {
  const expr = el.businessObject.get('conditionExpression') as { body?: string } | undefined;
  return expr?.body ?? '';
}

/** 写 sequenceFlow 条件表达式；空串移除 */
export function writeCondition(modeler: Modeler, el: PanelElement, condition: string): void {
  const moddle = modeler.get('moddle') as ModdleLike;
  const expr = condition ? moddle.create('bpmn:FormalExpression', { body: condition }) : undefined;
  modelingOf(modeler).updateModdleProperties(el, el.businessObject, { conditionExpression: expr });
}
