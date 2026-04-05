export type BlendMode =
  | 'none'
  | 'replace'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'value'
  | 'selfBlend'
  | 'customRgb'
  | 'customHsv';

export type BlendOp = 'none' | 'replace' | 'add' | 'subtract' | 'multiply';
export type ChannelName = 'r' | 'g' | 'b' | 'h' | 's' | 'v';
export type ParamName =
  | 'lightness'
  | 'specular'
  | 'halfLambert'
  | 'fresnel'
  | 'facing'
  | 'nDotH'
  | 'linearDepth'
  | 'r'
  | 'g'
  | 'b'
  | 'h'
  | 's'
  | 'v'
  | 'texU'
  | 'texV'
  | 'zero'
  | 'one';

export type Color = [number, number, number];
export type ColorWithHasChroma = [number, number, number, boolean?];
export type ColorWithAlpha = [number, number, number, number?];
export interface StepModel {
  id: string;
  lutId: string;
  label?: string;
  muted: boolean;
  blendMode: BlendMode;
  xParam: ParamName;
  yParam: ParamName;
  ops: Record<ChannelName, BlendOp>;
}

export interface LutModel {
  id: string;
  name: string;
  image: HTMLCanvasElement;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  thumbUrl: string;
  /** Present only for LUTs created/edited via the color ramp editor. Absent for file-imported LUTs. */
  ramp2dData?: import('../lut-editor/lut-editor-model.ts').ColorRamp2dLutData;
}

export interface BlendModeDef {
  key: BlendMode;
  label: string;
}

export interface StepRuntimeModel {
  step: StepModel;
  lut: LutModel | null;
  lutIndex: number;
}

export interface StepParamContext {
  lambert: number;
  halfLambert: number;
  specular: number;
  fresnel: number;
  facing: number;
  nDotH: number;
  linearDepth: number;
  texU: number;
  texV: number;
}

export interface BlendModeApplyInput {
  current: Color;
  lutColor: Color;
  lutAlpha: number;
  ops: Record<ChannelName, BlendOp>;
}

export interface BlendModeEmitInput {
  lutColorVar: string;
  lutAlphaVar: string;
  targetColorVar: string;
  hsvCurVar: string;
  hsvLutVar: string;
  ops: Record<ChannelName, BlendOp>;
}

export interface BlendModeStrategy {
  editableChannels: readonly ChannelName[];
  selectableChannelBlendOps: readonly BlendOp[];
  applyCpu: (input: BlendModeApplyInput) => Color;
  emitGlsl: (input: BlendModeEmitInput) => string[];
  emitHlsl: (input: BlendModeEmitInput) => string[];
}

export type ShaderLocalKey =
  | 'N'
  | 'L'
  | 'NdotL'
  | 'cameraPos'
  | 'V'
  | 'H'
  | 'lambert'
  | 'halfLambert'
  | 'nDotH'
  | 'specular'
  | 'facing'
  | 'fresnel'
  | 'linearDepth'
  | 'texcoord';

export interface ParamShaderInfo {
  glslExpr: string;
  hlslExpr: string;
  requires: readonly ShaderLocalKey[];
}

export interface ParamEvaluator {
  shader: ParamShaderInfo;
  evaluate: (current: Color, context: StepParamContext) => number;
}

export const CHANNELS: ChannelName[] = ['r', 'g', 'b', 'h', 's', 'v'];
export const BLEND_OPS: BlendOp[] = ['none', 'replace', 'add', 'subtract', 'multiply'];
export const MAX_STEP_LABEL_LENGTH = 40;

export const BLEND_MODES: BlendModeDef[] = [
  { key: 'none', label: 'None' },
  { key: 'replace', label: 'Replace' },
  { key: 'add', label: 'Add' },
  { key: 'subtract', label: 'Subtract' },
  { key: 'multiply', label: 'Multiply' },
  { key: 'hue', label: 'Hue' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'color', label: 'Color' },
  { key: 'value', label: 'Value' },
  { key: 'selfBlend', label: 'Self Blend' },
  { key: 'customRgb', label: 'Custom RGB' },
  { key: 'customHsv', label: 'Custom HSV' },
];

export const CUSTOM_RGB_CHANNELS: Array<'r' | 'g' | 'b'> = ['r', 'g', 'b'];
export const CUSTOM_HSV_CHANNELS: Array<'h' | 's' | 'v'> = ['h', 's', 'v'];

export const DEFAULT_OPS: Record<ChannelName, BlendOp> = {
  r: 'none',
  g: 'none',
  b: 'none',
  h: 'none',
  s: 'none',
  v: 'none',
};
