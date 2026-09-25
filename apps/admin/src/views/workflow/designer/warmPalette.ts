/**
 * S104 palette 白名单裁剪：只保留映射模块支持的图元（开始/审批 userTask/结束/互斥网关）+ 画布工具。
 * 默认 palette 的 pool / data object / 通用 task 等图元，bpmnDefJson 映射层会显式报错
 * （S103 K 口径：不静默丢语义），直接从创建入口剔除，避免用户走到保存才报错。
 *
 * 勘误（S104 开工简报第二节）：warm-flow 无「抄送」节点类型，palette 不含抄送图元。
 */

interface PaletteLike {
  registerProvider(provider: { getPaletteEntries(): PaletteEntries }): void;
}
interface CreateLike {
  start(event: Event, shape: unknown): void;
}
interface ElementFactoryLike {
  createShape(options: { type: string }): unknown;
}
interface HandToolLike {
  activateHand(event: Event): void;
}
interface SelectionToolLike {
  activateSelection(event: Event): void;
}

interface PaletteEntry {
  group: string;
  className?: string;
  title?: string;
  separator?: boolean;
  action?: { dragstart?: (event: Event) => void; click?: (event: Event) => void };
}
type PaletteEntries = Record<string, PaletteEntry>;

export default class WarmPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'handTool', 'lassoTool', 'spaceTool'];

  constructor(
    palette: PaletteLike,
    private create: CreateLike,
    private elementFactory: ElementFactoryLike,
    private handTool: HandToolLike,
    private lassoTool: SelectionToolLike,
    private spaceTool: SelectionToolLike,
  ) {
    palette.registerProvider(this);
  }

  getPaletteEntries(): PaletteEntries {
    const createAction = (type: string, group: string, className: string, title: string): PaletteEntry => {
      const start = (event: Event): void => {
        this.create.start(event, this.elementFactory.createShape({ type }));
      };
      return { group, className, title, action: { dragstart: start, click: start } };
    };
    return {
      'hand-tool': {
        group: 'tools',
        className: 'bpmn-icon-hand-tool',
        title: '抓手（平移画布）',
        action: { click: (e) => this.handTool.activateHand(e) },
      },
      'lasso-tool': {
        group: 'tools',
        className: 'bpmn-icon-lasso-tool',
        title: '套索（框选）',
        action: { click: (e) => this.lassoTool.activateSelection(e) },
      },
      'space-tool': {
        group: 'tools',
        className: 'bpmn-icon-space-tool',
        title: '空间工具（调整间距）',
        action: { click: (e) => this.spaceTool.activateSelection(e) },
      },
      'tool-separator': { group: 'tools', separator: true },
      'create.start-event': createAction('bpmn:StartEvent', 'event', 'bpmn-icon-start-event-none', '开始'),
      'create.user-task': createAction('bpmn:UserTask', 'activity', 'bpmn-icon-user-task', '审批'),
      'create.exclusive-gateway': createAction('bpmn:ExclusiveGateway', 'gateway', 'bpmn-icon-gateway-xor', '互斥网关'),
      'create.end-event': createAction('bpmn:EndEvent', 'event', 'bpmn-icon-end-event-none', '结束'),
    };
  }
}

/** Modeler additionalModules 注册片段（同名覆盖默认 paletteProvider） */
export const warmPaletteModule = {
  __init__: ['paletteProvider'],
  paletteProvider: ['type', WarmPaletteProvider],
};
