/**
 * context pad 白名单裁剪（S105，S104 遗留收口）：选中图元的快捷创建弹层只保留映射支持的图元。
 * 默认 provider 的 append 通用 task / 中间事件 / 文本注释、replace 换类型弹层均可造出
 * 映射层不支持的图元（保存时才显式报错），同名覆盖 contextPadProvider 后从创建入口剔除。
 *
 * 保留条目：append（审批/结束/三类网关）+ connect（连线）+ delete（删除）。
 * 白名单与 warmPalette 同源。
 */

interface ContextPadLike {
  registerProvider(provider: { getContextPadEntries(element: PadElement): PadEntries }): void;
}
interface CreateLike {
  start(event: Event, shape: unknown, context?: { source: unknown }): void;
}
interface ElementFactoryLike {
  createShape(options: { type: string }): unknown;
}
interface ConnectLike {
  start(event: Event, element: unknown): void;
}
interface ModelingLike {
  removeElements(elements: unknown[]): void;
}

interface PadElement {
  id: string;
  type: string;
}
interface PadEntry {
  group: string;
  className: string;
  title: string;
  action: { click?: (event: Event, element: PadElement) => void; dragstart?: (event: Event, element: PadElement) => void };
}
type PadEntries = Record<string, PadEntry>;

/** append 白名单：图元类型 → [条目名, 图标, 标题]（与 palette 创建条目同构） */
const APPEND_WHITELIST: Array<[string, string, string, string]> = [
  ['bpmn:UserTask', 'append.user-task', 'bpmn-icon-user-task', '追加审批节点'],
  ['bpmn:ExclusiveGateway', 'append.exclusive-gateway', 'bpmn-icon-gateway-xor', '追加互斥网关'],
  ['bpmn:ParallelGateway', 'append.parallel-gateway', 'bpmn-icon-gateway-parallel', '追加并行网关'],
  ['bpmn:InclusiveGateway', 'append.inclusive-gateway', 'bpmn-icon-gateway-or', '追加包容网关'],
  ['bpmn:EndEvent', 'append.end-event', 'bpmn-icon-end-event-none', '追加结束节点'],
];

/** 可向后追加/连线的图元（结束节点、边、标签除外） */
const APPENDABLE_TYPES = new Set([
  'bpmn:StartEvent',
  'bpmn:UserTask',
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:InclusiveGateway',
]);

export default class WarmContextPadProvider {
  static $inject = ['contextPad', 'modeling', 'elementFactory', 'connect', 'create'];

  constructor(
    contextPad: ContextPadLike,
    private modeling: ModelingLike,
    private elementFactory: ElementFactoryLike,
    private connect: ConnectLike,
    private create: CreateLike,
  ) {
    contextPad.registerProvider(this);
  }

  getContextPadEntries(element: PadElement): PadEntries {
    const entries: PadEntries = {};

    if (APPENDABLE_TYPES.has(element.type)) {
      for (const [type, key, className, title] of APPEND_WHITELIST) {
        const appendStart = (event: Event, source: PadElement): void => {
          const shape = this.elementFactory.createShape({ type });
          this.create.start(event, shape, { source });
        };
        entries[key] = {
          group: 'model',
          className,
          title,
          action: { click: appendStart, dragstart: appendStart },
        };
      }
      entries.connect = {
        group: 'connect',
        className: 'bpmn-icon-connection-multi',
        title: '连线到其他节点',
        action: {
          click: (event, el) => this.connect.start(event, el),
          dragstart: (event, el) => this.connect.start(event, el),
        },
      };
    }

    // 删除保留给所有图元（含边/标签）
    entries.delete = {
      group: 'edit',
      className: 'bpmn-icon-trash',
      title: '删除',
      action: { click: (_event, el) => this.modeling.removeElements([el]) },
    };

    return entries;
  }
}

/** Modeler additionalModules 注册片段（同名覆盖默认 contextPadProvider） */
export const warmContextPadModule = {
  __init__: ['contextPadProvider'],
  contextPadProvider: ['type', WarmContextPadProvider],
};
