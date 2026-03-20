import type {
  Color,
  ParamEvaluator,
  ParamName,
  StepParamContext,
} from './step-model';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function rgbToHsv(c: Color): Color {
  const r = c[0];
  const g = c[1];
  const b = c[2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const s = max <= 1e-6 ? 0 : d / max;
  const v = max;
  return [clamp01(h), clamp01(s), clamp01(v)];
}

export const PARAM_EVALUATORS: Record<ParamName, ParamEvaluator> = {
  lightness: {
    shader: { glslExpr: 'lambert', hlslExpr: 'lambert', requires: ['lambert'] },
    evaluate: (_current, context) => context.lambert,
  },
  specular: {
    shader: { glslExpr: 'specular', hlslExpr: 'specular', requires: ['specular'] },
    evaluate: (_current, context) => context.specular,
  },
  halfLambert: {
    shader: { glslExpr: 'halfLambert', hlslExpr: 'halfLambert', requires: ['halfLambert'] },
    evaluate: (_current, context) => context.halfLambert,
  },
  fresnel: {
    shader: { glslExpr: 'fresnel', hlslExpr: 'fresnel', requires: ['fresnel'] },
    evaluate: (_current, context) => context.fresnel,
  },
  facing: {
    shader: { glslExpr: 'facing', hlslExpr: 'facing', requires: ['facing'] },
    evaluate: (_current, context) => context.facing,
  },
  nDotH: {
    shader: { glslExpr: 'nDotH', hlslExpr: 'nDotH', requires: ['nDotH'] },
    evaluate: (_current, context) => context.nDotH,
  },
  linearDepth: {
    shader: { glslExpr: 'linearDepth', hlslExpr: 'linearDepth', requires: ['linearDepth'] },
    evaluate: (_current, context) => context.linearDepth,
  },
  r: {
    shader: { glslExpr: 'color.r', hlslExpr: 'color.r', requires: [] },
    evaluate: current => current[0],
  },
  g: {
    shader: { glslExpr: 'color.g', hlslExpr: 'color.g', requires: [] },
    evaluate: current => current[1],
  },
  b: {
    shader: { glslExpr: 'color.b', hlslExpr: 'color.b', requires: [] },
    evaluate: current => current[2],
  },
  h: {
    shader: { glslExpr: 'rgb2hsv(color).x', hlslExpr: 'RgbToHsv(color).x', requires: [] },
    evaluate: current => rgbToHsv(current)[0],
  },
  s: {
    shader: { glslExpr: 'rgb2hsv(color).y', hlslExpr: 'RgbToHsv(color).y', requires: [] },
    evaluate: current => rgbToHsv(current)[1],
  },
  v: {
    shader: { glslExpr: 'rgb2hsv(color).z', hlslExpr: 'RgbToHsv(color).z', requires: [] },
    evaluate: current => rgbToHsv(current)[2],
  },
  texU: {
    shader: { glslExpr: 'v_texcoord.x', hlslExpr: 'input.texcoord.x', requires: ['texcoord'] },
    evaluate: (_current, context) => context.texU,
  },
  texV: {
    shader: { glslExpr: 'v_texcoord.y', hlslExpr: 'input.texcoord.y', requires: ['texcoord'] },
    evaluate: (_current, context) => context.texV,
  },
};

export function paramExprGlsl(param: ParamName): string {
  return PARAM_EVALUATORS[param].shader.glslExpr;
}

export function paramExprHlsl(param: ParamName): string {
  return PARAM_EVALUATORS[param].shader.hlslExpr;
}

export function evaluateStepParam(param: ParamName, current: Color, context: StepParamContext): number {
  const evaluator = PARAM_EVALUATORS[param];
  const value = evaluator.evaluate(current, context);
  return Number.isFinite(value) ? value : 0;
}