import {
  createGizmoOverlayController,
  type GizmoOverlayController,
} from '../gizmo-overlay.ts';
import type { LightSettings, MaterialSettings } from '../../../features/pipeline/pipeline-model.ts';
import {
  createRenderSystem,
  type RenderSystemController,
} from '../../../platforms/webgl/render-system.ts';
import { Renderer } from '../../../platforms/webgl/renderer.ts';
import type { CustomParamModel } from '../../../features/step/step-model.ts';

interface GizmoLightElements {
  layer: SVGSVGElement;
  origin: SVGCircleElement;
  tip: SVGCircleElement;
  label: SVGTextElement;
}

interface GizmoAxisElements {
  layer: SVGSVGElement;
  origin: SVGCircleElement;
  lineX: SVGPathElement;
  lineY: SVGPathElement;
  lineZ: SVGPathElement;
  tipX: SVGCircleElement;
  tipY: SVGCircleElement;
  tipZ: SVGCircleElement;
  labelX: SVGTextElement;
  labelY: SVGTextElement;
  labelZ: SVGTextElement;
}

interface OrbitState {
  orbitPitchDeg: number;
  orbitYawDeg: number;
  orbitDist: number;
}

interface SetupMainRenderPipelineOptions {
  renderer: Renderer;
  lightGizmoElements: GizmoLightElements;
  axisGizmoElements: GizmoAxisElements;
  getCameraOrbit: () => OrbitState;
  getLightSettings: () => LightSettings;
  getLightDirectionWorld: () => [number, number, number];
  getMaterialSettings: () => MaterialSettings;
  getCustomParams: () => CustomParamModel[];
  shouldSuppressLightGuide: () => boolean;
  onSettleFrameCapture: (canvas: HTMLCanvasElement) => void;
}

export interface MainRenderPipeline {
  gizmoOverlayController: GizmoOverlayController;
  renderSystem: RenderSystemController;
}

function assertSvgElement<T extends SVGElement>(value: unknown, name: string, ctor: new (...args: unknown[]) => T): asserts value is T {
  if (!(value instanceof ctor)) {
    throw new Error(`${name} must be a ${ctor.name}.`);
  }
}

function assertRendererInstance(value: unknown): asserts value is Renderer {
  if (!(value instanceof Renderer)) {
    throw new Error('Main render pipeline renderer must be a Renderer instance.');
  }
}

function assertCallbackFn(value: unknown, name: string): void {
  if (typeof value !== 'function') {
    throw new Error(`Main render pipeline ${name} must be a function.`);
  }
}

function assertRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function assertGizmoLightElements(elements: unknown): asserts elements is GizmoLightElements {
  assertRecord(elements, 'Light gizmo elements');
  const e = elements as Partial<GizmoLightElements>;
  assertSvgElement(e.layer, 'Light gizmo layer', SVGSVGElement);
  assertSvgElement(e.origin, 'Light gizmo origin', SVGCircleElement);
  assertSvgElement(e.tip, 'Light gizmo tip', SVGCircleElement);
  assertSvgElement(e.label, 'Light gizmo label', SVGTextElement);
}

function assertGizmoAxisElements(elements: unknown): asserts elements is GizmoAxisElements {
  assertRecord(elements, 'Axis gizmo elements');
  const e = elements as Partial<GizmoAxisElements>;
  assertSvgElement(e.layer, 'Axis gizmo layer', SVGSVGElement);
  assertSvgElement(e.origin, 'Axis gizmo origin', SVGCircleElement);
  assertSvgElement(e.lineX, 'Axis gizmo lineX', SVGPathElement);
  assertSvgElement(e.lineY, 'Axis gizmo lineY', SVGPathElement);
  assertSvgElement(e.lineZ, 'Axis gizmo lineZ', SVGPathElement);
  assertSvgElement(e.tipX, 'Axis gizmo tipX', SVGCircleElement);
  assertSvgElement(e.tipY, 'Axis gizmo tipY', SVGCircleElement);
  assertSvgElement(e.tipZ, 'Axis gizmo tipZ', SVGCircleElement);
  assertSvgElement(e.labelX, 'Axis gizmo labelX', SVGTextElement);
  assertSvgElement(e.labelY, 'Axis gizmo labelY', SVGTextElement);
  assertSvgElement(e.labelZ, 'Axis gizmo labelZ', SVGTextElement);
}

function assertSetupMainRenderPipelineOptions(options: SetupMainRenderPipelineOptions): void {
  assertRecord(options, 'Main render pipeline options');
  assertRendererInstance(options.renderer);
  assertGizmoLightElements(options.lightGizmoElements);
  assertGizmoAxisElements(options.axisGizmoElements);
  assertCallbackFn(options.getCameraOrbit, 'getCameraOrbit');
  assertCallbackFn(options.getLightSettings, 'getLightSettings');
  assertCallbackFn(options.getLightDirectionWorld, 'getLightDirectionWorld');
  assertCallbackFn(options.getMaterialSettings, 'getMaterialSettings');
  assertCallbackFn(options.getCustomParams, 'getCustomParams');
  assertCallbackFn(options.shouldSuppressLightGuide, 'shouldSuppressLightGuide');
  assertCallbackFn(options.onSettleFrameCapture, 'onSettleFrameCapture');
}

export function setupMainRenderPipeline(
  options: SetupMainRenderPipelineOptions,
): MainRenderPipeline {
  assertSetupMainRenderPipelineOptions(options);

  const {
    renderer,
    lightGizmoElements,
    axisGizmoElements,
    getCameraOrbit,
    getLightSettings,
    getLightDirectionWorld,
    getMaterialSettings,
    getCustomParams,
    shouldSuppressLightGuide,
    onSettleFrameCapture,
  } = options;

  const gizmoOverlayController = createGizmoOverlayController({
    light: lightGizmoElements,
    axis: axisGizmoElements,
  });

  const renderSystem = createRenderSystem({
    renderer,
    getCameraOrbit,
    getLightSettings,
    getLightDirectionWorld,
    getMaterialSettings,
    getCustomParams,
    shouldSuppressLightGuide,
    onAfterDraw: ({ view, proj, canvas, lightDirection, lightSettings }) => {
      onSettleFrameCapture(canvas);

      gizmoOverlayController.updateLightDirectionGizmo({
        view,
        proj,
        canvas,
        lightDirectionWorld: lightDirection,
        showGizmo: lightSettings.showGizmo,
      });
      gizmoOverlayController.updateAxisGizmo({ view });
    },
  });

  return {
    gizmoOverlayController,
    renderSystem,
  };
}
