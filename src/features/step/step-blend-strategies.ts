import {
  CUSTOM_HSV_CHANNELS,
  CUSTOM_RGB_CHANNELS,
  type BlendMode,
  type BlendModeStrategy,
  type BlendOp,
  type ChannelName,
  type Color,
} from './step-model.ts';
import { clamp01, hsvToRgb, rgbToHsv } from '../../shared/utils/color.ts';

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

export const BLEND_MODE_STRATEGIES: Record<BlendMode, BlendModeStrategy> = {
  none: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current }) => [current[0], current[1], current[2]],
  },
  replace: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, [clamp01(lutColor[0]), clamp01(lutColor[1]), clamp01(lutColor[2])], lutAlpha),
  },
  add: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current, lutColor, lutAlpha }) => {
      const a = clamp01(Number.isFinite(lutAlpha) ? lutAlpha : 1);
      return [
        clamp01(current[0] + lutColor[0] * a),
        clamp01(current[1] + lutColor[1] * a),
        clamp01(current[2] + lutColor[2] * a),
      ];
    },
  },
  subtract: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current, lutColor, lutAlpha }) => {
      const a = clamp01(Number.isFinite(lutAlpha) ? lutAlpha : 1);
      return [
        clamp01(current[0] - lutColor[0] * a),
        clamp01(current[1] - lutColor[1] * a),
        clamp01(current[2] - lutColor[2] * a),
      ];
    },
  },
  multiply: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current, lutColor, lutAlpha }) => {
      const a = clamp01(Number.isFinite(lutAlpha) ? lutAlpha : 1);
      return [
        clamp01(current[0] * (1 - a + lutColor[0] * a)),
        clamp01(current[1] * (1 - a + lutColor[1] * a)),
        clamp01(current[2] * (1 - a + lutColor[2] * a)),
      ];
    },
  },
  hue: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, applyHsvLayerColor(current, lutColor, true, false, false), lutAlpha),
  },
  saturation: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, applyHsvLayerColor(current, lutColor, false, true, false), lutAlpha),
  },
  color: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, applyHsvLayerColor(current, lutColor, true, true, false), lutAlpha),
  },
  value: {
    editableChannels: [],
    selectableChannelBlendOps: [],
    applyCpu: ({ current, lutColor, lutAlpha }) =>
      blendWithLutAlpha(current, applyHsvLayerColor(current, lutColor, false, false, true), lutAlpha),
  },
  selfBlend: {
    editableChannels: CUSTOM_RGB_CHANNELS,
    selectableChannelBlendOps: ['none', 'add', 'subtract', 'multiply'],
    applyCpu: ({ current, lutColor, lutAlpha, ops }) =>
      blendWithLutAlpha(current,
        [
          clamp01(lerpNumber(current[0], applyBlend(current[0], current[0], ops.r), lutColor[0])),
          clamp01(lerpNumber(current[1], applyBlend(current[1], current[1], ops.g), lutColor[1])),
          clamp01(lerpNumber(current[2], applyBlend(current[2], current[2], ops.b), lutColor[2])),
        ],
        lutAlpha),
  },
  customRgb: {
    editableChannels: CUSTOM_RGB_CHANNELS,
    selectableChannelBlendOps: ['none', 'replace', 'add', 'subtract', 'multiply'],
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
  },
  customHsv: {
    editableChannels: CUSTOM_HSV_CHANNELS,
    selectableChannelBlendOps: ['none', 'replace', 'add', 'subtract', 'multiply'],
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
  },
};

export function getBlendModeStrategy(blendMode: BlendMode): BlendModeStrategy {
  return BLEND_MODE_STRATEGIES[blendMode] ?? BLEND_MODE_STRATEGIES.none;
}

export function getCustomChannelsForBlendMode(blendMode: BlendMode): ChannelName[] {
  return [...getBlendModeStrategy(blendMode).editableChannels];
}

export function getSelectableBlendOpsForChannel(blendMode: BlendMode): BlendOp[] {
  return [...getBlendModeStrategy(blendMode).selectableChannelBlendOps]; 
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
