export const DEFAULT_MATERIAL_SETTINGS = { color: [1, 1, 1] };
export const DEFAULT_LIGHT_SETTINGS = { color: [1, 1, 1], direction: [0, 0, 1] };
export const loadPipelineData = (data: any) => data;

// Required exports for main.ts compatibility
export const parseStepId = (id: string | number) => String(id);
export const parseLutId = (id: string) => id;
export const isValidParamName = (name: any): name is ParamName => {
  const validNames: ParamName[] = ['lightness', 'specular', 'halfLambert', 'fresnel', 'facing', 'r', 'g', 'b', 'h', 's', 'v', 'texU', 'texV'];
  return validNames.includes(name);
};
export const createBuiltinLuts = (): LutModel[] => [];
export const createLutFromFile = async (file: File): Promise<LutModel | null> => null;
export const MAX_LUTS = 16;
export const MAX_PIPELINE_FILE_BYTES = 10 * 1024 * 1024;
export const STEP_PREVIEW_LIGHT_DIR = [0, 0, 1] as const;
export const STEP_PREVIEW_VIEW_DIR = [0, 0, 1] as const;

export type LoadedPipelineData = any;

export const getLightDirectionWorld = (settings: any): [number, number, number] => [0, 0, 1];
export const getStepById = (steps: StepModel[], id: any): StepModel | undefined => undefined;
export const normalizeSteps = (steps: StepModel[], luts: LutModel[]) => {};
export const createPipelineStep = (steps: StepModel[], luts: LutModel[], nextId: number) => null;
export const removeStepFromPipeline = (steps: StepModel[], stepId: any) => ({ steps: [] });
export const removeLutFromPipeline = (luts: LutModel[], steps: StepModel[], lutId: string) => ({ luts: [] });
export const serializePipelineAsZip = (steps: StepModel[], luts: LutModel[], filename?: string): Blob => new Blob();
export const buildPipelineDownloadFilename = (): string => 'pipeline.zip';
export const loadPipelineFromZip = (file: File): Promise<LoadedPipelineData> => Promise.resolve(null);
export const isZipLikeFile = (file: File): boolean => file.type === 'application/zip';
export const isJsonLikeFile = (file: File): boolean => file.type === 'application/json';
export const toErrorMessage = (error: any): string => String(error?.message || error);
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
  | 'r'
  | 'g'
  | 'b'
  | 'h'
  | 's'
  | 'v'
  | 'texU'
  | 'texV';

export type Color = [number, number, number];

export interface StepModel {
  id: number;
  lutId: string;
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
  applyCpu: (input: BlendModeApplyInput) => Color;
  emitGlsl: (input: BlendModeEmitInput) => string[];
  emitHlsl: (input: BlendModeEmitInput) => string[];
}

export interface ParamEvaluator {
  glslExpr: string;
  hlslExpr: string;
  evaluate: (current: Color, context: StepParamContext) => number;
}

export const CHANNELS: ChannelName[] = ['r', 'g', 'b', 'h', 's', 'v'];
export const BLEND_OPS: BlendOp[] = ['none', 'replace', 'add', 'subtract', 'multiply'];

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
