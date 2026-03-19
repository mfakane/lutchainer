import {
  CUSTOM_HSV_CHANNELS,
  CUSTOM_RGB_CHANNELS,
  type BlendMode,
  type BlendModeStrategy,
  type BlendOp,
  type ChannelName,
  type Color,
  type LutModel,
  type ParamEvaluator,
  type ParamName,
  type StepModel,
  type StepParamContext,
  type StepRuntimeModel,
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

function hsvToRgb(c: Color): Color {
  const h = (c[0] % 1 + 1) % 1;
  const s = clamp01(c[1]);
  const v = clamp01(c[2]);

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

function applyBlend(cur: number, lut: number, op: BlendOp): number {
  switch (op) {
    case 'none':
      return cur;
    case 'replace':
      return lut;
    case 'add':
      return cur + lut;
    case 'subtract':
      return cur - lut;
    case 'multiply':
      return cur * lut;
  }
}

function lerpNumber(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function blendWithLutAlpha(current: Color, target: Color, lutAlpha: number): Color {
  const alpha = clamp01(Number.isFinite(lutAlpha) ? lutAlpha : 1);
  return [
    clamp01(lerpNumber(current[0], target[0], alpha)),
    clamp01(lerpNumber(current[1], target[1], alpha)),
    clamp01(lerpNumber(current[2], target[2], alpha)),
  ];
}

function emitColorLerpGlsl(targetColorVar: string, lutAlphaVar: string): string[] {
  return [`color = mix(color, ${targetColorVar}, clamp(${lutAlphaVar}, 0.0, 1.0));`];
}

function emitColorLerpHlsl(targetColorVar: string, lutAlphaVar: string): string[] {
  return [`color = lerp(color, ${targetColorVar}, saturate(${lutAlphaVar}));`];
}

function emitTargetColorWithLerpGlsl(
  targetColorVar: string,
  targetExpr: string,
  lutAlphaVar: string,
): string[] {
  return [
    `vec3 ${targetColorVar} = clamp(${targetExpr}, 0.0, 1.0);`,
    ...emitColorLerpGlsl(targetColorVar, lutAlphaVar),
  ];
}

function emitTargetColorWithLerpHlsl(
  targetColorVar: string,
  targetExpr: string,
  lutAlphaVar: string,
): string[] {
  return [
    `float3 ${targetColorVar} = saturate(${targetExpr});`,
    ...emitColorLerpHlsl(targetColorVar, lutAlphaVar),
  ];
}

export function opExprGlsl(op: BlendOp, left: string, right: string): string {
  return opExpr(op, left, right);
}

export function opExprHlsl(op: BlendOp, left: string, right: string): string {
  return opExpr(op, left, right);
}

function opExpr(op: BlendOp, left: string, right: string): string {
  switch (op) {
    case 'none':
      return left;
    case 'replace':
      return right;
    case 'add':
      return `(${left} + ${right})`;
    case 'subtract':
      return `(${left} - ${right})`;
    case 'multiply':
      return `(${left} * ${right})`;
  }
}

function applyHsvLayerColor(
  current: Color,
  lutColor: Color,
  useHue: boolean,
  useSaturation: boolean,
  useValue: boolean,
): Color {
  const hsvCur = rgbToHsv(current);
  const hsvLut = rgbToHsv(lutColor);
  const mixed: Color = [hsvCur[0], hsvCur[1], hsvCur[2]];
  if (useHue) mixed[0] = hsvLut[0];
  if (useSaturation) mixed[1] = hsvLut[1];
  if (useValue) mixed[2] = hsvLut[2];
  return hsvToRgb([clamp01(mixed[0]), clamp01(mixed[1]), clamp01(mixed[2])]);
}

function emitHsvLayerGlsl(
  lutColorVar: string,
  hsvCurVar: string,
  hsvLutVar: string,
  targetColorVar: string,
  lutAlphaVar: string,
  useHue: boolean,
  useSaturation: boolean,
  useValue: boolean,
): string[] {
  const lines = [`vec3 ${hsvCurVar} = rgb2hsv(color);`, `vec3 ${hsvLutVar} = rgb2hsv(${lutColorVar});`];
  if (useHue) lines.push(`${hsvCurVar}.x = ${hsvLutVar}.x;`);
  if (useSaturation) lines.push(`${hsvCurVar}.y = ${hsvLutVar}.y;`);
  if (useValue) lines.push(`${hsvCurVar}.z = ${hsvLutVar}.z;`);
  lines.push(`vec3 ${targetColorVar} = clamp(hsv2rgb(${hsvCurVar}), 0.0, 1.0);`);
  lines.push(...emitColorLerpGlsl(targetColorVar, lutAlphaVar));
  return lines;
}

function emitHsvLayerHlsl(
  lutColorVar: string,
  hsvCurVar: string,
  hsvLutVar: string,
  targetColorVar: string,
  lutAlphaVar: string,
  useHue: boolean,
  useSaturation: boolean,
  useValue: boolean,
): string[] {
  const lines = [`float3 ${hsvCurVar} = RgbToHsv(color);`, `float3 ${hsvLutVar} = RgbToHsv(${lutColorVar});`];
  if (useHue) lines.push(`${hsvCurVar}.x = ${hsvLutVar}.x;`);
  if (useSaturation) lines.push(`${hsvCurVar}.y = ${hsvLutVar}.y;`);
  if (useValue) lines.push(`${hsvCurVar}.z = ${hsvLutVar}.z;`);
  lines.push(`float3 ${targetColorVar} = saturate(HsvToRgb(${hsvCurVar}));`);
  lines.push(...emitColorLerpHlsl(targetColorVar, lutAlphaVar));
  return lines;
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

export const BLEND_MODE_STRATEGIES: Record<BlendMode, BlendModeStrategy> = {
  none: {
    editableChannels: [],
    applyCpu: ({ current }) => [current[0], current[1], current[2]],
    emitGlsl: () => [],
    emitHlsl: () => [],
  },
  replace: {
    editableChannels: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, [clamp01(lutColor[0]), clamp01(lutColor[1]), clamp01(lutColor[2])], lutAlpha),
    emitGlsl: ({ lutColorVar, lutAlphaVar, targetColorVar }) =>
      emitTargetColorWithLerpGlsl(targetColorVar, lutColorVar, lutAlphaVar),
    emitHlsl: ({ lutColorVar, lutAlphaVar, targetColorVar }) =>
      emitTargetColorWithLerpHlsl(targetColorVar, lutColorVar, lutAlphaVar),
  },
  add: {
    editableChannels: [],
    applyCpu: ({ current, lutColor, lutAlpha }) => {
      const a = clamp01(Number.isFinite(lutAlpha) ? lutAlpha : 1);
      return [
        clamp01(current[0] + lutColor[0] * a),
        clamp01(current[1] + lutColor[1] * a),
        clamp01(current[2] + lutColor[2] * a),
      ];
    },
    emitGlsl: ({ lutColorVar, lutAlphaVar }) =>
      [`color += ${lutColorVar} * clamp(${lutAlphaVar}, 0.0, 1.0);`],
    emitHlsl: ({ lutColorVar, lutAlphaVar }) =>
      [`color += ${lutColorVar} * saturate(${lutAlphaVar});`],
  },
  subtract: {
    editableChannels: [],
    applyCpu: ({ current, lutColor, lutAlpha }) => {
      const a = clamp01(Number.isFinite(lutAlpha) ? lutAlpha : 1);
      return [
        clamp01(current[0] - lutColor[0] * a),
        clamp01(current[1] - lutColor[1] * a),
        clamp01(current[2] - lutColor[2] * a),
      ];
    },
    emitGlsl: ({ lutColorVar, lutAlphaVar }) =>
      [`color -= ${lutColorVar} * clamp(${lutAlphaVar}, 0.0, 1.0);`],
    emitHlsl: ({ lutColorVar, lutAlphaVar }) =>
      [`color -= ${lutColorVar} * saturate(${lutAlphaVar});`],
  },
  multiply: {
    editableChannels: [],
    applyCpu: ({ current, lutColor, lutAlpha }) => {
      const a = clamp01(Number.isFinite(lutAlpha) ? lutAlpha : 1);
      return [
        clamp01(current[0] * (1 - a + lutColor[0] * a)),
        clamp01(current[1] * (1 - a + lutColor[1] * a)),
        clamp01(current[2] * (1 - a + lutColor[2] * a)),
      ];
    },
    emitGlsl: ({ lutColorVar, lutAlphaVar }) =>
      [`color *= mix(vec3(1.0), ${lutColorVar}, clamp(${lutAlphaVar}, 0.0, 1.0));`],
    emitHlsl: ({ lutColorVar, lutAlphaVar }) =>
      [`color *= lerp(float3(1.0, 1.0, 1.0), ${lutColorVar}, saturate(${lutAlphaVar}));`],
  },
  hue: {
    editableChannels: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, applyHsvLayerColor(current, lutColor, true, false, false), lutAlpha),
    emitGlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar }) =>
      emitHsvLayerGlsl(lutColorVar, hsvCurVar, hsvLutVar, targetColorVar, lutAlphaVar, true, false, false),
    emitHlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar }) =>
      emitHsvLayerHlsl(lutColorVar, hsvCurVar, hsvLutVar, targetColorVar, lutAlphaVar, true, false, false),
  },
  saturation: {
    editableChannels: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, applyHsvLayerColor(current, lutColor, false, true, false), lutAlpha),
    emitGlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar }) =>
      emitHsvLayerGlsl(lutColorVar, hsvCurVar, hsvLutVar, targetColorVar, lutAlphaVar, false, true, false),
    emitHlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar }) =>
      emitHsvLayerHlsl(lutColorVar, hsvCurVar, hsvLutVar, targetColorVar, lutAlphaVar, false, true, false),
  },
  color: {
    editableChannels: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, applyHsvLayerColor(current, lutColor, true, true, false), lutAlpha),
    emitGlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar }) =>
      emitHsvLayerGlsl(lutColorVar, hsvCurVar, hsvLutVar, targetColorVar, lutAlphaVar, true, true, false),
    emitHlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar }) =>
      emitHsvLayerHlsl(lutColorVar, hsvCurVar, hsvLutVar, targetColorVar, lutAlphaVar, true, true, false),
  },
  value: {
    editableChannels: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, applyHsvLayerColor(current, lutColor, false, false, true), lutAlpha),
    emitGlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar }) =>
      emitHsvLayerGlsl(lutColorVar, hsvCurVar, hsvLutVar, targetColorVar, lutAlphaVar, false, false, true),
    emitHlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar }) =>
      emitHsvLayerHlsl(lutColorVar, hsvCurVar, hsvLutVar, targetColorVar, lutAlphaVar, false, false, true),
  },
  customRgb: {
    editableChannels: CUSTOM_RGB_CHANNELS,
    applyCpu: ({ current, lutColor, lutAlpha, ops }) =>
      blendWithLutAlpha(
        current,
        [
          clamp01(applyBlend(current[0], lutColor[0], ops.r)),
          clamp01(applyBlend(current[1], lutColor[1], ops.g)),
          clamp01(applyBlend(current[2], lutColor[2], ops.b)),
        ],
        lutAlpha,
      ),
    emitGlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, ops }) => {
      const lines = [`vec3 ${targetColorVar} = color;`];
      for (const channel of CUSTOM_RGB_CHANNELS) {
        lines.push(
          `${targetColorVar}.${channel} = clamp(${opExprGlsl(ops[channel], `${targetColorVar}.${channel}`, `${lutColorVar}.${channel}`)}, 0.0, 1.0);`,
        );
      }
      lines.push(...emitColorLerpGlsl(targetColorVar, lutAlphaVar));
      return lines;
    },
    emitHlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, ops }) => {
      const lines = [`float3 ${targetColorVar} = color;`];
      for (const channel of CUSTOM_RGB_CHANNELS) {
        lines.push(
          `${targetColorVar}.${channel} = saturate(${opExprHlsl(ops[channel], `${targetColorVar}.${channel}`, `${lutColorVar}.${channel}`)});`,
        );
      }
      lines.push(...emitColorLerpHlsl(targetColorVar, lutAlphaVar));
      return lines;
    },
  },
  customHsv: {
    editableChannels: CUSTOM_HSV_CHANNELS,
    applyCpu: ({ current, lutColor, lutAlpha, ops }) => {
      const hsvCur = rgbToHsv(current);
      const hsvLut = rgbToHsv(lutColor);
      const hsvMixed: Color = [
        clamp01(applyBlend(hsvCur[0], hsvLut[0], ops.h)),
        clamp01(applyBlend(hsvCur[1], hsvLut[1], ops.s)),
        clamp01(applyBlend(hsvCur[2], hsvLut[2], ops.v)),
      ];
      return blendWithLutAlpha(current, hsvToRgb(hsvMixed), lutAlpha);
    },
    emitGlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar, ops }) => {
      const lines = [`vec3 ${hsvCurVar} = rgb2hsv(color);`, `vec3 ${hsvLutVar} = rgb2hsv(${lutColorVar});`];
      for (const channel of CUSTOM_HSV_CHANNELS) {
        const component = channel === 'h' ? 'x' : channel === 's' ? 'y' : 'z';
        lines.push(
          `${hsvCurVar}.${component} = clamp(${opExprGlsl(ops[channel], `${hsvCurVar}.${component}`, `${hsvLutVar}.${component}`)}, 0.0, 1.0);`,
        );
      }
      lines.push(`vec3 ${targetColorVar} = clamp(hsv2rgb(${hsvCurVar}), 0.0, 1.0);`);
      lines.push(...emitColorLerpGlsl(targetColorVar, lutAlphaVar));
      return lines;
    },
    emitHlsl: ({ lutColorVar, lutAlphaVar, targetColorVar, hsvCurVar, hsvLutVar, ops }) => {
      const lines = [`float3 ${hsvCurVar} = RgbToHsv(color);`, `float3 ${hsvLutVar} = RgbToHsv(${lutColorVar});`];
      for (const channel of CUSTOM_HSV_CHANNELS) {
        const component = channel === 'h' ? 'x' : channel === 's' ? 'y' : 'z';
        lines.push(
          `${hsvCurVar}.${component} = saturate(${opExprHlsl(ops[channel], `${hsvCurVar}.${component}`, `${hsvLutVar}.${component}`)});`,
        );
      }
      lines.push(`float3 ${targetColorVar} = saturate(HsvToRgb(${hsvCurVar}));`);
      lines.push(...emitColorLerpHlsl(targetColorVar, lutAlphaVar));
      return lines;
    },
  },
};

export function getBlendModeStrategy(blendMode: BlendMode): BlendModeStrategy {
  return BLEND_MODE_STRATEGIES[blendMode] ?? BLEND_MODE_STRATEGIES.none;
}

export function getCustomChannelsForBlendMode(blendMode: BlendMode): ChannelName[] {
  return [...getBlendModeStrategy(blendMode).editableChannels];
}

export function applyStepColor(
  current: Color,
  lutColor: Color,
  lutAlpha: number,
  blendMode: BlendMode,
  ops: Record<ChannelName, BlendOp>,
): Color {
  return getBlendModeStrategy(blendMode).applyCpu({ current, lutColor, lutAlpha, ops });
}

export function sanitizePreviewColor(color: Color): Color {
  const r = Number.isFinite(color[0]) ? clamp01(color[0]) : 0.5;
  const g = Number.isFinite(color[1]) ? clamp01(color[1]) : 0.5;
  const b = Number.isFinite(color[2]) ? clamp01(color[2]) : 0.5;
  return [r, g, b];
}

export interface LutColorSample {
  color: Color;
  alpha: number;
}

export function sampleLutColorLinear(lut: LutModel, u: number, v: number): LutColorSample {
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    return { color: [1, 1, 1], alpha: 1 };
  }
  if (!Number.isInteger(lut.width) || !Number.isInteger(lut.height) || lut.width < 1 || lut.height < 1) {
    return { color: [1, 1, 1], alpha: 1 };
  }
  if (lut.pixels.length < lut.width * lut.height * 4) {
    return { color: [1, 1, 1], alpha: 1 };
  }

  const clampedU = clamp01(u);
  const clampedV = clamp01(v);
  const x = clampedU * Math.max(0, lut.width - 1);
  const y = clampedV * Math.max(0, lut.height - 1);

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(lut.width - 1, x0 + 1);
  const y1 = Math.min(lut.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;

  const readPixel = (px: number, py: number): [number, number, number, number] => {
    const idx = (py * lut.width + px) * 4;
    const data = lut.pixels;
    return [
      (data[idx + 0] ?? 0) / 255,
      (data[idx + 1] ?? 0) / 255,
      (data[idx + 2] ?? 0) / 255,
      (data[idx + 3] ?? 255) / 255,
    ];
  };

  const c00 = readPixel(x0, y0);
  const c10 = readPixel(x1, y0);
  const c01 = readPixel(x0, y1);
  const c11 = readPixel(x1, y1);

  const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const r0 = mix(c00[0], c10[0], tx);
  const g0 = mix(c00[1], c10[1], tx);
  const b0 = mix(c00[2], c10[2], tx);
  const r1 = mix(c01[0], c11[0], tx);
  const g1 = mix(c01[1], c11[1], tx);
  const b1 = mix(c01[2], c11[2], tx);
  const a0 = mix(c00[3], c10[3], tx);
  const a1 = mix(c01[3], c11[3], tx);

  return {
    color: [
      clamp01(mix(r0, r1, ty)),
      clamp01(mix(g0, g1, ty)),
      clamp01(mix(b0, b1, ty)),
    ],
    alpha: clamp01(mix(a0, a1, ty)),
  };
}

export function resolveStepRuntimeModels(
  steps: readonly StepModel[],
  luts: readonly LutModel[],
  targetStepIndex = steps.length - 1,
): StepRuntimeModel[] {
  if (!Number.isInteger(targetStepIndex)) {
    return [];
  }

  const clampedLast = Math.max(-1, Math.min(targetStepIndex, steps.length - 1));
  if (clampedLast < 0) {
    return [];
  }

  return steps.slice(0, clampedLast + 1).map(step => {
    const lutIndex = Math.max(0, luts.findIndex(lut => lut.id === step.lutId));
    const lut = luts[lutIndex] ?? null;
    return { step, lut, lutIndex };
  });
}

export function composeColorFromSteps(
  stepModels: readonly StepRuntimeModel[],
  baseColor: Color,
  context: StepParamContext,
): Color {
  let color: Color = [baseColor[0], baseColor[1], baseColor[2]];

  for (const stepModel of stepModels) {
    const step = stepModel.step;
    const xRaw = evaluateStepParam(step.xParam, color, context);
    const yRaw = evaluateStepParam(step.yParam, color, context);
    const xVal = clamp01(Number.isFinite(xRaw) ? xRaw : 0);
    const yVal = clamp01(Number.isFinite(yRaw) ? yRaw : 0);

    const lutSample = stepModel.lut
      ? sampleLutColorLinear(stepModel.lut, xVal, yVal)
      : { color: [1, 1, 1] as Color, alpha: 1 };
    color = applyStepColor(color, lutSample.color, lutSample.alpha, step.blendMode, step.ops);
  }

  return sanitizePreviewColor(color);
}
