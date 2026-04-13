import type { MaterialSettings } from '../pipeline/pipeline-model.ts';
import type {
  BlendMode,
  BlendModeEmitInput,
  ParamRef,
  ShaderLocalKey,
} from '../step/step-model.ts';

export type ShaderLanguage = 'glsl' | 'hlsl' | 'mme';
export type ShaderOutputKind = 'fragment' | 'previewFragment';

export interface ShaderLanguageBackend {
  language: ShaderLanguage;
  displayName: string;
  sampleType: string;
  colorType: string;
  hsvType: string;
  uvType: string;
  sampleFunctionName: string;
  whiteColor: string;
  clampUnit: (expression: string) => string;
  clampColor: (expression: string) => string;
  lerp: (from: string, to: string, alpha: string) => string;
  hsvFromColor: (expression: string) => string;
  hsvToColor: (expression: string) => string;
  getParamExpr: (param: ParamRef) => string;
  emitLocalDeclaration: (
    key: ShaderLocalKey,
    outputKind: ShaderOutputKind,
    material?: MaterialSettings,
  ) => readonly string[];
}

function opExpr(op: string, left: string, right: string): string | undefined {
  switch (op) {
    case 'none':
      return undefined;
    case 'replace':
      return right;
    case 'add':
      return `(${left} + ${right})`;
    case 'subtract':
      return `(${left} - ${right})`;
    case 'multiply':
      return `(${left} * ${right})`;
    default:
      throw new Error(`Unsupported blend op: ${op}`);
  }
}

function emitColorLerp(
  backend: ShaderLanguageBackend,
  targetColorVar: string,
  lutAlphaVar: string,
): string[] {
  return [`color = ${backend.lerp('color', targetColorVar, backend.clampUnit(lutAlphaVar))};`];
}

function emitTargetColorWithLerp(
  backend: ShaderLanguageBackend,
  targetColorVar: string,
  targetExpr: string,
  lutAlphaVar: string,
): string[] {
  return [
    `${backend.colorType} ${targetColorVar} = ${backend.clampColor(targetExpr)};`,
    ...emitColorLerp(backend, targetColorVar, lutAlphaVar),
  ];
}

function emitHsvLayer(
  backend: ShaderLanguageBackend,
  input: BlendModeEmitInput,
  useHue: boolean,
  useSaturation: boolean,
  useValue: boolean,
): string[] {
  const lines = [
    `${backend.hsvType} ${input.hsvCurVar} = ${backend.hsvFromColor('color')};`,
    `${backend.hsvType} ${input.hsvLutVar} = ${backend.hsvFromColor(input.lutColorVar)};`,
  ];
  if (useHue) {
    lines.push(`${input.hsvCurVar}.x = ${input.hsvLutVar}.x;`);
  }
  if (useSaturation) {
    lines.push(`${input.hsvCurVar}.y = ${input.hsvLutVar}.y;`);
  }
  if (useValue) {
    lines.push(`${input.hsvCurVar}.z = ${input.hsvLutVar}.z;`);
  }
  lines.push(`${backend.colorType} ${input.targetColorVar} = ${backend.clampColor(backend.hsvToColor(input.hsvCurVar))};`);
  lines.push(...emitColorLerp(backend, input.targetColorVar, input.lutAlphaVar));
  return lines;
}

export function emitBlendModeCode(
  backend: ShaderLanguageBackend,
  blendMode: BlendMode,
  input: BlendModeEmitInput,
): string[] {
  switch (blendMode) {
    case 'none':
      return [];
    case 'replace':
      return emitTargetColorWithLerp(backend, input.targetColorVar, input.lutColorVar, input.lutAlphaVar);
    case 'add':
      return [`color += ${input.lutColorVar} * ${input.lutAlphaVar};`];
    case 'subtract':
      return [`color -= ${input.lutColorVar} * ${input.lutAlphaVar};`];
    case 'multiply':
      return [`color *= ${backend.lerp(backend.whiteColor, input.lutColorVar, input.lutAlphaVar)};`];
    case 'hue':
      return emitHsvLayer(backend, input, true, false, false);
    case 'saturation':
      return emitHsvLayer(backend, input, false, true, false);
    case 'color':
      return emitHsvLayer(backend, input, true, true, false);
    case 'value':
      return emitHsvLayer(backend, input, false, false, true);
    case 'selfBlend': {
      const lines = [`${backend.colorType} ${input.targetColorVar} = color;`];
      for (const channel of ['r', 'g', 'b'] as const) {
        const expression = opExpr(input.ops[channel], `${input.targetColorVar}.${channel}`, `${input.targetColorVar}.${channel}`);
        if (expression === undefined) {
          continue;
        }
        lines.push(
          `${input.targetColorVar}.${channel} = ${backend.lerp(
            `${input.targetColorVar}.${channel}`,
            expression,
            `${input.lutColorVar}.${channel}`,
          )};`,
        );
      }
      lines.push(...emitColorLerp(backend, input.targetColorVar, input.lutAlphaVar));
      return lines;
    }
    case 'customRgb': {
      const lines = [`${backend.colorType} ${input.targetColorVar} = color;`];
      for (const channel of ['r', 'g', 'b'] as const) {
        const expression = opExpr(input.ops[channel], `${input.targetColorVar}.${channel}`, `${input.lutColorVar}.${channel}`);
        if (expression === undefined) {
          continue;
        }
        lines.push(`${input.targetColorVar}.${channel} = ${expression};`);
      }
      lines.push(...emitColorLerp(backend, input.targetColorVar, input.lutAlphaVar));
      return lines;
    }
    case 'customHsv': {
      const lines = [
        `${backend.hsvType} ${input.hsvCurVar} = ${backend.hsvFromColor('color')};`,
        `${backend.hsvType} ${input.hsvLutVar} = ${backend.hsvFromColor(input.lutColorVar)};`,
      ];
      for (const channel of ['h', 's', 'v'] as const) {
        const component = channel === 'h' ? 'x' : channel === 's' ? 'y' : 'z';
        const expression = opExpr(input.ops[channel], `${input.hsvCurVar}.${component}`, `${input.hsvLutVar}.${component}`);
        if (expression === undefined) {
          continue;
        }
        lines.push(`${input.hsvCurVar}.${component} = ${expression};`);
      }
      lines.push(`${backend.colorType} ${input.targetColorVar} = ${backend.hsvToColor(input.hsvCurVar)};`);
      lines.push(...emitColorLerp(backend, input.targetColorVar, input.lutAlphaVar));
      return lines;
    }
    default:
      throw new Error(`Unsupported blend mode: ${blendMode satisfies never}`);
  }
}
