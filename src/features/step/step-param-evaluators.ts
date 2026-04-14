import type {
  Color,
  ParamEvaluator,
  ParamName,
  ParamRef,
  StepParamContext,
} from './step-model.ts';
import { parseCustomParamRef } from './step-model.ts';
import { clamp01, rgbToHsv } from '../../shared/utils/color.ts';

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

export function evaluateStepParam(param: ParamRef, current: Color, context: StepParamContext): number {
  const customParamId = parseCustomParamRef(param);
  if (customParamId) {
    const customValue = context.customParamValues[customParamId];
    return Number.isFinite(customValue) ? clamp01(customValue) : 0;
  }

  const evaluator = PARAM_EVALUATORS[param as ParamName];
  const value = evaluator.evaluate(current, context);
  return Number.isFinite(value) ? value : 0;
}
