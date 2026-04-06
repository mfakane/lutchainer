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
    requires: ['lambert'],
    evaluate: (_current, context) => context.lambert,
  },
  specular: {
    requires: ['specular'],
    evaluate: (_current, context) => context.specular,
  },
  halfLambert: {
    requires: ['halfLambert'],
    evaluate: (_current, context) => context.halfLambert,
  },
  fresnel: {
    requires: ['fresnel'],
    evaluate: (_current, context) => context.fresnel,
  },
  facing: {
    requires: ['facing'],
    evaluate: (_current, context) => context.facing,
  },
  nDotH: {
    requires: ['nDotH'],
    evaluate: (_current, context) => context.nDotH,
  },
  linearDepth: {
    requires: ['linearDepth'],
    evaluate: (_current, context) => context.linearDepth,
  },
  r: {
    requires: [],
    evaluate: current => current[0],
  },
  g: {
    requires: [],
    evaluate: current => current[1],
  },
  b: {
    requires: [],
    evaluate: current => current[2],
  },
  h: {
    requires: [],
    evaluate: current => rgbToHsv(current)[0],
  },
  s: {
    requires: [],
    evaluate: current => rgbToHsv(current)[1],
  },
  v: {
    requires: [],
    evaluate: current => rgbToHsv(current)[2],
  },
  texU: {
    requires: ['texcoord'],
    evaluate: (_current, context) => context.texU,
  },
  texV: {
    requires: ['texcoord'],
    evaluate: (_current, context) => context.texV,
  },
  zero: {
    requires: [],
    evaluate: () => 0,
  },
  one: {
    requires: [],
    evaluate: () => 1,
  },
};

export function evaluateStepParam(param: ParamName, current: Color, context: StepParamContext): number {
  const evaluator = PARAM_EVALUATORS[param];
  const value = evaluator.evaluate(current, context);
  return Number.isFinite(value) ? value : 0;
}
