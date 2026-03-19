export type ParamName =
  | 'lightness'
  | 'specular'
  | 'halfLambert'
  | 'fresnel'
  | 'facing'
  | 'r' | 'g' | 'b'
  | 'h' | 's' | 'v'
  | 'texU' | 'texV';

export interface StepModel {
  id: number;
  lutId: string;
  blendMode: string;
  xParam: ParamName;
  yParam: ParamName;
  ops: Record<string, string>;
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
