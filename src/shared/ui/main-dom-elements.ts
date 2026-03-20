export interface MainDomElements {
  pipelineWorkspaceEl: HTMLElement;
  stepListEl: HTMLElement;
  lutStripListEl: HTMLElement;
  paramNodeListEl: HTMLElement;
  connectionLayerEl: SVGSVGElement;
  lightGizmoLayerEl: SVGSVGElement;
  lightGizmoOriginEl: SVGCircleElement;
  lightGizmoTipEl: SVGCircleElement;
  lightGizmoLabelEl: SVGTextElement;
  axisGizmoLayerEl: SVGSVGElement;
  axisGizmoOriginEl: SVGCircleElement;
  axisGizmoLineXEl: SVGPathElement;
  axisGizmoLineYEl: SVGPathElement;
  axisGizmoLineZEl: SVGPathElement;
  axisGizmoTipXEl: SVGCircleElement;
  axisGizmoTipYEl: SVGCircleElement;
  axisGizmoTipZEl: SVGCircleElement;
  axisGizmoLabelXEl: SVGTextElement;
  axisGizmoLabelYEl: SVGTextElement;
  axisGizmoLabelZEl: SVGTextElement;
  paramColumnEl: HTMLElement;
}

export interface ResolveMainDomElementsOptions {
  select: <T extends Element>(selector: string) => T;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureOptions(value: unknown): asserts value is ResolveMainDomElementsOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('DOM 要素解決オプションが不正です。');
  }

  const options = value as Partial<ResolveMainDomElementsOptions>;
  ensureFunction(options.select, 'DOM 要素解決オプション: select');
}

export function resolveMainDomElements(options: ResolveMainDomElementsOptions): MainDomElements {
  ensureOptions(options);

  const select = options.select;
  return {
    pipelineWorkspaceEl: select<HTMLElement>('#pipeline-workspace'),
    stepListEl: select<HTMLElement>('#step-list'),
    lutStripListEl: select<HTMLElement>('#lut-strip-list'),
    paramNodeListEl: select<HTMLElement>('#param-node-list'),
    connectionLayerEl: select<SVGSVGElement>('#connection-layer'),
    lightGizmoLayerEl: select<SVGSVGElement>('#light-gizmo-layer'),
    lightGizmoOriginEl: select<SVGCircleElement>('#light-gizmo-origin'),
    lightGizmoTipEl: select<SVGCircleElement>('#light-gizmo-tip'),
    lightGizmoLabelEl: select<SVGTextElement>('#light-gizmo-label'),
    axisGizmoLayerEl: select<SVGSVGElement>('#axis-gizmo-layer'),
    axisGizmoOriginEl: select<SVGCircleElement>('#axis-gizmo-origin'),
    axisGizmoLineXEl: select<SVGPathElement>('#axis-gizmo-line-x'),
    axisGizmoLineYEl: select<SVGPathElement>('#axis-gizmo-line-y'),
    axisGizmoLineZEl: select<SVGPathElement>('#axis-gizmo-line-z'),
    axisGizmoTipXEl: select<SVGCircleElement>('#axis-gizmo-tip-x'),
    axisGizmoTipYEl: select<SVGCircleElement>('#axis-gizmo-tip-y'),
    axisGizmoTipZEl: select<SVGCircleElement>('#axis-gizmo-tip-z'),
    axisGizmoLabelXEl: select<SVGTextElement>('#axis-gizmo-label-x'),
    axisGizmoLabelYEl: select<SVGTextElement>('#axis-gizmo-label-y'),
    axisGizmoLabelZEl: select<SVGTextElement>('#axis-gizmo-label-z'),
    paramColumnEl: select<HTMLElement>('.param-column'),
  };
}
